using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// Read-only, external metadata inspection. No UIA, injection, input or message sending.
class FoxmailPaintDiagnostic : Form {
 const uint READ=0x10, QUERY=0x400;
 delegate bool EnumProc(IntPtr h,IntPtr p);
 [StructLayout(LayoutKind.Sequential)] struct RECT {public int l,t,r,b;}
 [StructLayout(LayoutKind.Sequential)] struct POINT {public int x,y;}
 [StructLayout(LayoutKind.Sequential)] struct MBI {public IntPtr BaseAddress,AllocationBase;public uint AllocationProtect;public UIntPtr RegionSize;public uint State,Protect,Type;}
 [DllImport("user32")] static extern bool EnumWindows(EnumProc f,IntPtr p);
 [DllImport("user32")] static extern bool EnumChildWindows(IntPtr h,EnumProc f,IntPtr p);
 [DllImport("user32")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder b,int n);
 [DllImport("user32",EntryPoint="GetWindowLongW",SetLastError=true)] static extern int GetWindowLong(IntPtr h,int n);
 [DllImport("user32",EntryPoint="GetClassLongW",SetLastError=true)] static extern uint GetClassLong(IntPtr h,int n);
 [DllImport("user32")] static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32")] static extern bool GetClientRect(IntPtr h,out RECT r);
 [DllImport("user32")] static extern bool ClientToScreen(IntPtr h,ref POINT p);
 [DllImport("user32")] static extern IntPtr GetParent(IntPtr h);
 [DllImport("user32")] static extern IntPtr GetWindow(IntPtr h,uint n);
 [DllImport("user32")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("gdi32",EntryPoint="GetObjectW")] static extern int GetObject(IntPtr h,int n,byte[] data);
 [DllImport("kernel32",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32",SetLastError=true)] static extern bool ReadProcessMemory(IntPtr p,IntPtr a,byte[] b,int n,out IntPtr read);
 [DllImport("kernel32")] static extern UIntPtr VirtualQueryEx(IntPtr p,IntPtr a,out MBI info,UIntPtr n);
 [DllImport("kernel32",CharSet=CharSet.Unicode)] static extern uint GetModuleFileName(IntPtr h,StringBuilder b,int n);
 static string Hex(long n){return "0x"+unchecked((uint)n).ToString("X8");}
 static string Hash(byte[] b){using(var s=SHA256.Create())return BitConverter.ToString(s.ComputeHash(b)).Replace("-","");}
 static byte[] Read(IntPtr p,uint a,int size){
  if(a<65536||size<1||size>4096)return null;MBI m;
  if(VirtualQueryEx(p,new IntPtr(unchecked((int)a)),out m,(UIntPtr)Marshal.SizeOf(typeof(MBI)))==UIntPtr.Zero||m.State!=0x1000||(m.Protect&0x101)!=0)return null;
  ulong start=unchecked((uint)m.BaseAddress.ToInt32()),end=start+m.RegionSize.ToUInt64();if((ulong)a+ (uint)size>end)return null;
  var b=new byte[size];IntPtr n;if(!ReadProcessMemory(p,new IntPtr(unchecked((int)a)),b,size,out n)||n.ToInt32()!=size)return null;return b;
 }
 static uint Ptr(IntPtr p,uint a){var b=Read(p,a,4);return b==null?0:BitConverter.ToUInt32(b,0);}
 static object Theme(IntPtr p,uint image){
  uint obj=Ptr(p,image+0xef5d48),vmt=Ptr(p,obj),name=Ptr(p,vmt-44);var len=Read(p,name,1);string cls=null;
  if(len!=null&&len[0]>0&&len[0]<=80){var b=Read(p,name+1,len[0]);if(b!=null)cls=Encoding.ASCII.GetString(b);}
  return new {objectAddress=Hex(obj),vmt=Hex(vmt),className=cls,ncSizeFunction=Hex(Ptr(p,vmt+0x20)),ncPaintFunction=Hex(Ptr(p,vmt+0x80))};
 }
 static object WindowInfo(IntPtr h){return WindowInfo(h,IntPtr.Zero,0);}
 static object WindowInfo(IntPtr h,IntPtr process,uint image){
  var cls=new StringBuilder(128);GetClassName(h,cls,128);RECT w,c;POINT origin=new POINT();
  bool wr=GetWindowRect(h,out w),cr=GetClientRect(h,out c),pt=ClientToScreen(h,ref origin);
  uint brush=GetClassLong(h,-10);var lb=new byte[12];int bs=GetObject(new IntPtr(unchecked((int)brush)),12,lb);
  return new {handle=Hex(h.ToInt64()),className=cls.ToString(),parent=Hex(GetParent(h).ToInt64()),owner=Hex(GetWindow(h,4).ToInt64()),
   visible=IsWindowVisible(h),style=Hex(GetWindowLong(h,-16)),exStyle=Hex(GetWindowLong(h,-20)),windowProc=Hex(GetWindowLong(h,-4)),classProc=Hex(GetClassLong(h,-24)),
   width=w.r-w.l,height=w.b-w.t,clientWidth=c.r-c.l,clientHeight=c.b-c.t,
   nonClient=(wr&&cr&&pt)?new int[]{origin.x-w.l,origin.y-w.t,w.r-origin.x-(c.r-c.l),w.b-origin.y-(c.b-c.t)}:null,
   classBrush=Hex(brush),classBrushStyle=bs==12?(int?)BitConverter.ToInt32(lb,0):null,classBrushColor=bs==12?Hex(BitConverter.ToUInt32(lb,4)):null,
   vcl=process==IntPtr.Zero?null:VclControlMetadata.Read(process,image,h)};
 }
 class Target:IDisposable {public int pid;public uint image;public IntPtr process;public object identity;public EraseDiagnosticReader erase;public RingDiagnosticReader paintPhase;public HashSet<string> seen=new HashSet<string>();public void Dispose(){if(process!=IntPtr.Zero)CloseHandle(process);}}
 static JavaScriptSerializer json=new JavaScriptSerializer(){MaxJsonLength=128*1024*1024};
 List<Target> targets=new List<Target>();List<object> events=new List<object>();List<string> errors=new List<string>();
 HashSet<int> seenPids=new HashSet<int>();Stopwatch watch=Stopwatch.StartNew();Timer timer=new Timer();Label status=new Label();
 string output=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Foxmail预绘制诊断结果.json");bool finishing=false;int ticks;
 FoxmailPaintDiagnostic(){
  Text="Foxmail 预绘制诊断";Width=570;Height=210;StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;
  var instructions=new Label(){Left=16,Top=15,Width=530,Height=72,Text="请保持 Foxmail 运行，并依次：\r\n1. 打开设置，在常用、账号、写邮件之间切换两次\r\n2. 关闭设置，最小化及关闭到托盘后分别恢复\r\n仅记录控件状态及背景颜色值，不保存邮件、文字或截图。"};Controls.Add(instructions);
  status.SetBounds(16,95,530,25);Controls.Add(status);
  var finish=new Button(){Text="完成并保存",Left=405,Top=125,Width=130};finish.Click+=(s,e)=>Finish();Controls.Add(finish);
  timer.Interval=200;timer.Tick+=(s,e)=>Poll();Shown+=(s,e)=>{Poll();timer.Start();};FormClosing+=(s,e)=>{if(!finishing)Finish();};
 }
 void Discover(){
  foreach(var p in Process.GetProcesses())using(p){try{
   string name=p.ProcessName;if(name!="Foxmail"&&name!="Foxmail深色")continue;if(!seenPids.Add(p.Id))continue;
   IntPtr handle=OpenProcess(READ|QUERY,false,p.Id);var t=new Target(){pid=p.Id,process=handle};
   string path=p.MainModule.FileName;t.image=unchecked((uint)p.MainModule.BaseAddress.ToInt32());string diskHash=null;
   try{using(var s=SHA256.Create())using(var f=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite))diskHash=BitConverter.ToString(s.ComputeHash(f)).Replace("-","");}catch(Exception e){errors.Add("hash: "+e.GetType().Name);}
   uint darkRva=0,darkSize=0;
   object code=null;var dos=Read(handle,t.image,64);if(dos!=null&&dos[0]==77&&dos[1]==90){uint pe=t.image+BitConverter.ToUInt32(dos,60);var hdr=Read(handle,pe,256);if(hdr!=null&&BitConverter.ToUInt32(hdr,0)==0x4550){int count=BitConverter.ToUInt16(hdr,6),opt=BitConverter.ToUInt16(hdr,20);for(int i=0;i<Math.Min(count,32);i++){var sec=Read(handle,pe+24+(uint)opt+(uint)(40*i),40);if(sec==null)continue;string sn=Encoding.ASCII.GetString(sec,0,8).TrimEnd('\0');if(sn==".fxdark"){darkRva=BitConverter.ToUInt32(sec,12);darkSize=BitConverter.ToUInt32(sec,8);var prefix=Read(handle,t.image+darkRva,64);code=new{sectionRva=Hex(darkRva),sectionSize=darkSize,prefixSHA256=prefix==null?null:Hash(prefix)};}}}}
   try{
    string metaPath=Path.Combine(Path.GetDirectoryName(path),"DarkModeBackup","build-info.json");
    if(File.Exists(metaPath)){
     var metadata=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(metaPath));
     var erase=(Dictionary<string,object>)metadata["nativeInitialErase"];
     if(darkRva!=0&&darkSize!=0&&erase.ContainsKey("diagnostics"))t.erase=new EraseDiagnosticReader((Dictionary<string,object>)erase["diagnostics"],darkRva,darkSize);
     if(darkRva!=0&&darkSize!=0&&metadata.ContainsKey("nativePaintPhase")&&metadata["nativePaintPhase"]!=null){
      var phase=(Dictionary<string,object>)metadata["nativePaintPhase"];
      t.paintPhase=new RingDiagnosticReader((Dictionary<string,object>)phase["diagnostics"],darkRva,darkSize);
     }
    }
   }catch(Exception ex){errors.Add("diagnostic metadata: "+ex.GetType().Name);}
   t.identity=new{pid=p.Id,executable=path,diskSHA256=diskHash,imageBase=Hex(t.image),loadedDarkCode=code,readable=handle!=IntPtr.Zero,hasEraseDiagnostics=t.erase!=null,hasPaintPhaseDiagnostics=t.paintPhase!=null};targets.Add(t);
  }catch(Exception e){errors.Add("discover: "+e.GetType().Name);}}
 }
 void Poll(){
  try{
   if(ticks++%7==0)Discover();
   foreach(var t in targets){
    if(t.erase!=null)t.erase.Sample(t.process,t.image);
    if(t.paintPhase!=null)t.paintPhase.Sample(t.process,t.image);
    if((ticks-1)%5!=0)continue; // Control metadata at 1 Hz; paint ring at 5 Hz.
    var windows=new List<object>();var handles=new HashSet<IntPtr>();
    EnumProc add=(h,x)=>{uint pid;GetWindowThreadProcessId(h,out pid);if(pid==(uint)t.pid&&IsWindowVisible(h)&&handles.Add(h))windows.Add(WindowInfo(h,t.process,t.image));return true;};
    EnumWindows((h,x)=>{uint pid;GetWindowThreadProcessId(h,out pid);if(pid==(uint)t.pid){add(h,x);EnumChildWindows(h,add,IntPtr.Zero);}return true;},IntPtr.Zero);
    var state=new{pid=t.pid,theme=Theme(t.process,t.image),windows=windows};string key=json.Serialize(state);
    if(t.seen.Add(key)&&events.Count<500)events.Add(new{elapsedMs=watch.ElapsedMilliseconds,state=state});
   }
   int attached=0;foreach(var t in targets)if(t.paintPhase!=null&&t.paintPhase.connected)attached++;
   status.Text="已识别 "+targets.Count+" 个进程，已连接 "+attached+" 个预绘制记录；剩余 "+Math.Max(0,600-(int)watch.Elapsed.TotalSeconds)+" 秒";
   if(ticks%14==0)Save();if(watch.Elapsed.TotalSeconds>=600)Finish();
  }catch(Exception e){if(errors.Count<30)errors.Add("poll: "+e.GetType().Name);}
 }
 void Save(){var identities=new List<object>();var paint=new List<object>();var paintPhases=new List<object>();foreach(var t in targets){identities.Add(t.identity);if(t.erase!=null)paint.Add(new{pid=t.pid,data=t.erase.Export()});if(t.paintPhase!=null)paintPhases.Add(new{pid=t.pid,data=t.paintPhase.Export()});}File.WriteAllText(output,json.Serialize(new{schema=4,scope="Read-only control metadata, paint counters and bounded bitmap corner colors; no captions, mail, pixel arrays, screenshots or input",processes=identities,events=events,paint=paint,paintPhases=paintPhases,errors=errors}),new UTF8Encoding(false));}
 void Finish(){if(finishing)return;finishing=true;timer.Stop();try{Save();}catch(Exception e){MessageBox.Show("保存失败："+e.Message);}foreach(var t in targets)t.Dispose();Close();}
 [STAThread] static void Main(string[] args){
  if(args.Length>0&&args[0]=="--self-test"){
   using(var f=new Form()){var h=f.Handle;var info=WindowInfo(h);string s=json.Serialize(info);if(!s.Contains("nonClient"))throw new Exception("window metadata");
    using(var p=Process.GetCurrentProcess()){var ph=OpenProcess(READ|QUERY,false,p.Id);try{var b=Read(ph,unchecked((uint)p.MainModule.BaseAddress.ToInt32()),2);if(b==null||b[0]!=77||b[1]!=90)throw new Exception("memory read");if(Read(ph,0,4)!=null)throw new Exception("invalid memory guard");}finally{CloseHandle(ph);}}
    Console.WriteLine("PASS read-only HWND geometry, class/style/brush metadata and guarded memory reading");}return;
  }
  Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new FoxmailPaintDiagnostic());
 }
}

