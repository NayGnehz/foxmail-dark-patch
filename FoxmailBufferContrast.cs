using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

class FoxmailBufferContrast:Form {
 const string PathExact=@"D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe", ClassExact="TFoxMainFrm.UnicodeClass";
 const int Composite=0x02000000,Child=0x40000000,Layered=0x80000,NoRedirect=0x00200000;
 delegate bool EnumProc(IntPtr h,IntPtr arg);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f,IntPtr arg);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h,int index);
 [DllImport("user32.dll",SetLastError=true)] static extern int SetWindowLong(IntPtr h,int index,int value);
 [DllImport("user32.dll")] static extern uint GetClassLong(IntPtr h,int index);
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll",SetLastError=true)] static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int cx,int cy,uint flags);
 [DllImport("kernel32.dll")] static extern void SetLastError(uint error);
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateWindowEx(int ex,string cls,string title,int style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
 [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr h);
 delegate IntPtr NativeWindowProc(IntPtr h,uint message,IntPtr w,IntPtr l);
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct WindowClass {public uint style;public NativeWindowProc proc;public int classExtra,windowExtra;public IntPtr instance,icon,cursor,background;public string menu,className;}
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern ushort RegisterClass(ref WindowClass cls);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern bool UnregisterClass(string cls,IntPtr instance);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr DefWindowProc(IntPtr h,uint message,IntPtr w,IntPtr l);
 readonly Label status=new Label(); readonly Timer timer=new Timer(); readonly List<object> actions=new List<object>();
 readonly string output=System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Foxmail缓冲对照结果.json");
 Process target; IntPtr hwnd; uint pid,tid; string created; int original; uint classStyle; bool changed; DateTime enabledAt;
 static string ClassOf(IntPtr h){var s=new StringBuilder(256);GetClassName(h,s,s.Capacity);return s.ToString();}
 static bool TargetWindowShape(IntPtr h){return ClassOf(h)==ClassExact&&(GetWindowLong(h,-16)&Child)==0;}
 static bool SafeStyles(int style,int ex,uint cls){return (style&Child)==0&&(ex&(Layered|NoRedirect))==0&&(cls&0xE0)==0;}
 FoxmailBufferContrast(){
  Text="Foxmail 主窗口缓冲对照";ClientSize=new Size(650,250);StartPosition=FormStartPosition.CenterScreen;
  Controls.Add(new Label {Left=16,Top=15,Width=615,Height=70,Text="默认不改动样式。请手动开启，再对比主窗口最小化/托盘恢复及滚动流畅度。\r\n本工具只对主窗口临时开启缓冲；关闭工具会恢复，开启10分钟后自动恢复。\r\n若恢复失败，请重试；或自行重启Foxmail后再结束工具。"});
  status.SetBounds(16,90,615,75);Controls.Add(status);
  Button on=new Button {Left=16,Top=185,Width=190,Text="开启主窗口缓冲"},off=new Button{Left=225,Top=185,Width=170,Text="恢复原样"},done=new Button{Left=415,Top=185,Width=200,Text="恢复并结束"};
  Controls.AddRange(new Control[]{on,off,done});on.Click+=(s,e)=>Enable();off.Click+=(s,e)=>Restore("userRestore");done.Click+=(s,e)=>Close();
  timer.Interval=1000;timer.Tick+=(s,e)=>{if(changed&&(DateTime.UtcNow-enabledAt).TotalMinutes>=10)Restore("automatic10minutes");};timer.Start();
  FormClosing+=(s,e)=>{if(!Restore("closing")){e.Cancel=true;return;}timer.Stop();if(target!=null)target.Dispose();};
  string reason;status.Text=Connect(out reason)?"已核对唯一主窗口，当前未改动。\r\n"+reason:reason;Log("initial",null,null,reason);
 }
 bool Connect(out string reason){
  if(changed){reason="已有待恢复的改动。";return false;}
  if(target!=null){target.Dispose();target=null;}hwnd=IntPtr.Zero;
  var matches=new List<Tuple<Process,IntPtr,uint>>();var retained=new List<Process>();
  foreach(Process p in Process.GetProcessesByName("Foxmail深色")){bool keep=false;try{
   if(!String.Equals(System.IO.Path.GetFullPath(p.MainModule.FileName),PathExact,StringComparison.OrdinalIgnoreCase))continue;
   IntPtr handle=p.Handle; if(p.HasExited)continue; retained.Add(p);keep=true;
   EnumWindows((h,a)=>{uint id;uint thread=GetWindowThreadProcessId(h,out id);if(id==(uint)p.Id&&ClassOf(h)==ClassExact&&(GetWindowLong(h,-16)&Child)==0)matches.Add(Tuple.Create(p,h,thread));return true;},IntPtr.Zero);
  }catch{}finally{if(!keep)p.Dispose();}}
  if(matches.Count!=1){foreach(Process p in retained)p.Dispose();reason="拒绝操作：必须找到且仅找到一个指定路径、指定类的主窗口；当前匹配 "+matches.Count+" 个。";return false;}
  target=matches[0].Item1;hwnd=matches[0].Item2;tid=matches[0].Item3;pid=(uint)target.Id;created=target.StartTime.ToUniversalTime().ToString("o");foreach(Process p in retained)if(p!=target)p.Dispose();
  classStyle=GetClassLong(hwnd,-26);original=GetWindowLong(hwnd,-20);
  if(!SafeStyles(GetWindowLong(hwnd,-16),original,classStyle)){reason="拒绝操作：窗口具有不兼容的类样式或扩展样式。";return false;}
  if((original&Composite)!=0){reason="主窗口缓冲原本已开启，不进行对照或修改。";return false;}
  reason="可开启主窗口缓冲。";return true;
 }
 // Identity is checked immediately before each mutation, including recovery.
 bool Identity(out bool gone){gone=false;if(target==null)return false;try{if(target.HasExited){gone=true;return false;}if(target.StartTime.ToUniversalTime().ToString("o")!=created)return false;}catch{return false;}
  if(!IsWindow(hwnd)){gone=true;return false;}uint id;uint thread=GetWindowThreadProcessId(hwnd,out id);return id==pid&&thread==tid&&TargetWindowShape(hwnd);
 }
 static bool WriteBit(IntPtr h,bool enable,out int before,out int after,out string error){
  before=GetWindowLong(h,-20);int wanted=enable?before|Composite:before&~Composite;SetLastError(0);int returned=SetWindowLong(h,-20,wanted);int setError=Marshal.GetLastWin32Error();after=GetWindowLong(h,-20);
  bool setterOk=returned!=0||setError==0;
  if(!setterOk||after!=wanted){error="SetWindowLong returned="+returned+", error="+setError+", readback="+after;return false;}
  SetLastError(0);bool refreshed=SetWindowPos(h,IntPtr.Zero,0,0,0,0,0x0020|0x0002|0x0001|0x0004|0x0010|0x4000);int refreshError=Marshal.GetLastWin32Error();after=GetWindowLong(h,-20);
  if(!refreshed){error="SetWindowPos error="+refreshError;return false;}
  if(after!=wanted){error="刷新后的样式复核失败：wanted="+wanted+", actual="+after;return false;}
  error=null;return true;
 }
 void Enable(){string why;if(!Connect(out why)){status.Text=why;Log("enableRejected",null,null,why);return;}bool gone;if(!Identity(out gone)||!SafeStyles(GetWindowLong(hwnd,-16),GetWindowLong(hwnd,-20),GetClassLong(hwnd,-26))){status.Text="身份或兼容性复核失败，未修改。";Log("enableRejected",null,null,status.Text);return;}
  int before,after;string error;bool ok=WriteBit(hwnd,true,out before,out after,out error);changed=(before&Composite)==0;enabledAt=DateTime.UtcNow;Log("enable",before,after,error);
  if(!ok){status.Text="开启或刷新失败，正在回退。";Restore("enableFailureRollback");return;}status.Text="主窗口缓冲已开启。请对比恢复过程和滚动；10分钟后自动恢复。";
 }
 bool Restore(string cause){if(!changed)return true;bool gone;if(!Identity(out gone)){if(gone){Log(cause,null,null,"进程已退出或原窗口已销毁，无需恢复。");changed=false;status.Text="原窗口已不存在，无需恢复。";return true;}status.Text="恢复失败：窗口身份不匹配。请重试，或自行重启Foxmail后结束工具。";Log(cause,null,null,status.Text);return false;}
  int before,after;string error;bool ok=WriteBit(hwnd,false,out before,out after,out error);Log(cause,before,after,error);
  if(!ok){bool goneAgain;if(Identity(out goneAgain)){int retryBefore,retryAfter;string retryError;ok=WriteBit(hwnd,false,out retryBefore,out retryAfter,out retryError);Log(cause+"Retry",retryBefore,retryAfter,retryError);}}
  if(ok){changed=false;Log(cause+"Complete",null,GetWindowLong(hwnd,-20),null);status.Text="已恢复原样，仅清除本工具开启的缓冲位。";return true;}status.Text="恢复或刷新失败。请重试；或自行重启Foxmail，再结束工具。";return false;
 }
 void Log(string action,int? before,int? after,string error){actions.Add(new {at=DateTimeOffset.Now.ToString("o"),action=action,path=PathExact,pid=pid,createdAt=created,hwnd=hwnd.ToInt64().ToString("X"),threadId=tid,className=ClassExact,classStyle=classStyle,originalExStyle=original,mutatedBit=Composite,before=before,after=after,error=error,pendingRestore=changed});try{File.WriteAllText(output,new JavaScriptSerializer().Serialize(new{actions=actions}),Encoding.UTF8);}catch(Exception ex){status.Text="记录保存失败："+ex.Message;}}
 [STAThread] static int Main(string[] args){if(args.Length>0&&args[0]=="--self-test")return SelfTest();Application.EnableVisualStyles();Application.Run(new FoxmailBufferContrast());return 0;}
 static int SelfTest(){string name="FoxmailBufferSelfTest_"+Process.GetCurrentProcess().Id;NativeWindowProc proc=DefWindowProc;var cls=new WindowClass{className=name,proc=proc};if(RegisterClass(ref cls)==0)return 1;IntPtr h=CreateWindowEx(0,name,"",unchecked((int)0x80000000),0,0,1,1,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);if(h==IntPtr.Zero){UnregisterClass(name,IntPtr.Zero);return 1;}try{
  SetLastError(0);int zeroReturn=SetWindowLong(h,-20,0);int zeroError=Marshal.GetLastWin32Error();bool zeroPreparation=(zeroReturn!=0||zeroError==0)&&GetWindowLong(h,-20)==0;
  int b,a;string error;bool enabled=WriteBit(h,true,out b,out a,out error);bool zero=zeroPreparation&&enabled&&b==0&&(a&Composite)!=0;
  SetLastError(0);SetWindowLong(h,-20,GetWindowLong(h,-20)|0x80);bool restore=WriteBit(h,false,out b,out a,out error)&&(a&Composite)==0&&(a&0x80)!=0;
  bool guards=!SafeStyles(0,0,0x20)&&!SafeStyles(0,0,0x40)&&!SafeStyles(0,0,0x80)&&!TargetWindowShape(h);
  bool pass=zero&&restore&&guards;Console.WriteLine(pass?"SELF-TEST PASS: hidden native zero-style setter, enable/restore preserving other bits, DC guards, non-target class":"SELF-TEST FAIL");return pass?0:1;
 }finally{DestroyWindow(h);UnregisterClass(name,IntPtr.Zero);GC.KeepAlive(proc);}}
}
