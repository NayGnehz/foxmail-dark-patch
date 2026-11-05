using System;using System.IO;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Web.Script.Serialization;
class EraseDiagnosticCheck {
 [DllImport("kernel32")]static extern IntPtr VirtualAlloc(IntPtr a,UIntPtr n,uint t,uint p);
 [DllImport("kernel32",CharSet=CharSet.Ansi)]static extern IntPtr LoadLibrary(string s);
 [DllImport("kernel32",CharSet=CharSet.Ansi)]static extern IntPtr GetProcAddress(IntPtr h,string s);
 [DllImport("gdi32")]static extern IntPtr CreateCompatibleDC(IntPtr dc);
 [DllImport("gdi32")]static extern IntPtr CreateDIBSection(IntPtr dc,IntPtr bi,uint usage,out IntPtr bits,IntPtr sec,uint off);
 [DllImport("gdi32")]static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
 [DllImport("gdi32")]static extern bool DeleteObject(IntPtr obj);
 [DllImport("gdi32")]static extern bool DeleteDC(IntPtr dc);
 [DllImport("gdi32")]static extern bool GdiFlush();
 [DllImport("gdi32")]static extern IntPtr CreateSolidBrush(uint c);
 [DllImport("gdi32")]static extern IntPtr GetCurrentObject(IntPtr dc,uint type);
 [DllImport("gdi32")]static extern uint GetTextColor(IntPtr dc);
 [DllImport("gdi32")]static extern uint GetBkColor(IntPtr dc);
 [DllImport("gdi32")]static extern int GetBkMode(IntPtr dc);
 [DllImport("gdi32")]static extern int GetMapMode(IntPtr dc);
 [DllImport("gdi32")]static extern int GetROP2(IntPtr dc);
 [DllImport("gdi32")]static extern int GetGraphicsMode(IntPtr dc);
 [DllImport("gdi32")]static extern uint GetLayout(IntPtr dc);
 [DllImport("gdi32")]static extern int SetBkMode(IntPtr dc,int mode);
 [DllImport("gdi32")]static extern int SetMapMode(IntPtr dc,int mode);
 [DllImport("gdi32")]static extern int SetROP2(IntPtr dc,int mode);
 [DllImport("gdi32")]static extern int SetGraphicsMode(IntPtr dc,int mode);
 [DllImport("gdi32")]static extern uint SetLayout(IntPtr dc,uint mode);
 [DllImport("gdi32")]static extern bool MoveToEx(IntPtr dc,int x,int y,IntPtr old);
 [DllImport("gdi32")]static extern bool GetCurrentPositionEx(IntPtr dc,out POINT pt);
 [DllImport("gdi32")]static extern IntPtr CreateRectRgn(int l,int t,int r,int b);
 [DllImport("gdi32")]static extern int SelectClipRgn(IntPtr dc,IntPtr rgn);
 [DllImport("gdi32")]static extern int CombineRgn(IntPtr a,IntPtr b,IntPtr c,int mode);
 [DllImport("gdi32")]static extern IntPtr CreateBitmap(int w,int h,uint planes,uint bits,IntPtr data);
 [DllImport("gdi32")]static extern uint GetPixel(IntPtr dc,int x,int y);
 [DllImport("gdi32")]static extern bool PatBlt(IntPtr dc,int x,int y,int w,int h,uint rop);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int Invoke(IntPtr fn,IntPtr self,IntPtr msg,IntPtr regs);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate void Entry();
 struct POINT{public int x,y;}
 static int checks;
 static void Check(bool v,string text){if(!v)throw new Exception(text);checks++;}
 static int I(byte[] b,int p){return BitConverter.ToInt32(b,p);}static int Num(object o){return Convert.ToInt32(o);}
 static IntPtr Stub(byte[] b){var p=VirtualAlloc(IntPtr.Zero,(UIntPtr)b.Length,0x3000,0x40);Marshal.Copy(b,0,p,b.Length);return p;}
 class PE{
  public IntPtr mem;public Dictionary<string,int> iats=new Dictionary<string,int>();
  public PE(string path){var b=File.ReadAllBytes(path);int pe=I(b,60),op=pe+24;mem=VirtualAlloc(IntPtr.Zero,(UIntPtr)I(b,op+56),0x3000,0x40);if(mem==IntPtr.Zero)throw new Exception("PE allocation");Marshal.Copy(b,0,mem,I(b,op+60));int ns=BitConverter.ToUInt16(b,pe+6),sh=op+BitConverter.ToUInt16(b,pe+20);
   for(int s=0;s<ns;s++){int p=sh+s*40,n=I(b,p+16);if(n>0)Marshal.Copy(b,I(b,p+20),A(I(b,p+12)),n);}
   int delta=unchecked(mem.ToInt32()-I(b,op+28)),rel=I(b,op+136),end=rel+I(b,op+140);while(rel!=0&&rel<end){int page=R(rel),block=R(rel+4);if(block<8)break;for(int p=rel+8;p<rel+block;p+=2){ushort x=(ushort)Marshal.ReadInt16(A(p));if((x>>12)==3){int at=page+(x&4095);W(at,unchecked(R(at)+delta));}}rel+=block;}
   for(int d=I(b,op+104);R(d+12)!=0;d+=20){string dll=Marshal.PtrToStringAnsi(A(R(d+12)));int iat=R(d+16),table=R(d);if(table==0)table=iat;bool allow=dll.Equals("kernel32.dll",StringComparison.OrdinalIgnoreCase)||dll.Equals("user32.dll",StringComparison.OrdinalIgnoreCase)||dll.Equals("gdi32.dll",StringComparison.OrdinalIgnoreCase);IntPtr lib=allow?LoadLibrary(dll):IntPtr.Zero;for(int n=0;R(table+n*4)!=0;n++){int v=R(table+n*4);if(v<0)continue;string name=Marshal.PtrToStringAnsi(A(v+2));iats[name]=iat+n*4;if(allow)Marshal.WriteIntPtr(A(iat+n*4),GetProcAddress(lib,name));}}
   // No application initialization. Only theme availability queries in the
   // original button handler are stubbed so its actual true branch executes.
   Marshal.Copy(new byte[]{0xb8,1,0,0,0,0xc3},0,A(0x29d4a0),6);Marshal.Copy(new byte[]{0xb8,1,0,0,0,0xc3},0,A(0x29d5cc),6);
   // The settings form's real list-backed no-erase branch is exercised with
   // only its external composition-availability query replaced in test memory.
   Marshal.Copy(new byte[]{0x31,0xc0,0xc3},0,A(0x61b598),3);
  }
  public IntPtr A(int r){return IntPtr.Add(mem,r);}public int R(int r){return Marshal.ReadInt32(A(r));}public void W(int r,int v){Marshal.WriteInt32(A(r),v);}
 }
 class Surface:IDisposable{
  public IntPtr dc,bits,bmp,old;public int clip;
  public Surface(int c){clip=c;dc=CreateCompatibleDC(IntPtr.Zero);var bi=Marshal.AllocHGlobal(40);for(int i=0;i<40;i++)Marshal.WriteByte(bi,i,0);Marshal.WriteInt32(bi,40);Marshal.WriteInt32(bi,4,64);Marshal.WriteInt32(bi,8,-64);Marshal.WriteInt16(bi,12,1);Marshal.WriteInt16(bi,14,32);bmp=CreateDIBSection(dc,bi,0,out bits,IntPtr.Zero,0);Marshal.FreeHGlobal(bi);old=SelectObject(dc,bmp);Clear();
   if(c>0){var r=CreateRectRgn(5,7,c==3?5:20,23);if(c==2){var r2=CreateRectRgn(28,31,45,48);CombineRgn(r,r,r2,2);DeleteObject(r2);}SelectClipRgn(dc,r);DeleteObject(r);}
  }
  public bool Inside(int x,int y){return clip==0||(clip!=3&&x>=5&&x<20&&y>=7&&y<23)||(clip==2&&x>=28&&x<45&&y>=31&&y<48);}
  public void Clear(){GdiFlush();for(int i=0;i<4096;i++)Marshal.WriteInt32(bits,i*4,0xffffff);MoveToEx(dc,9,11,IntPtr.Zero);}
  public int[] Pixels(){GdiFlush();var a=new int[4096];Marshal.Copy(bits,a,0,4096);return a;}
  public void Dispose(){SelectObject(dc,old);DeleteObject(bmp);DeleteDC(dc);}
 }
 static string State(IntPtr dc){POINT pt;GetCurrentPositionEx(dc,out pt);return GetCurrentObject(dc,1)+","+GetCurrentObject(dc,2)+","+GetCurrentObject(dc,6)+","+GetCurrentObject(dc,7)+","+GetTextColor(dc)+","+GetBkColor(dc)+","+GetBkMode(dc)+","+GetMapMode(dc)+","+GetROP2(dc)+","+GetGraphicsMode(dc)+","+GetLayout(dc)+","+pt.x+","+pt.y;}
 static Invoke MakeInvoke(){var c=new List<byte>();Action<byte[]> e=a=>c.AddRange(a);Action<int>d=v=>e(BitConverter.GetBytes(v));
  e(new byte[]{0x55,0x8b,0xec,0x53,0x56,0x57,0x83,0xec,4,0x89,0x2c,0x24,0xbb});d(0x12345678);e(new byte[]{0xbe});d(0x23456789);e(new byte[]{0xbf});d(0x3456789a);
  e(new byte[]{0x8b,0x45,12,0x8b,0x55,16,0xb9});d(0x456789ab);e(new byte[]{0xff,0x55,8,0x50,0x8b,0x45,20,0x89,0x50,4,0x89,0x48,8,0x5a,0x89,0x10,0x31,0xc0});
  e(new byte[]{0x81,0xfb});d(0x12345678);e(new byte[]{0x74,3,0x83,0xc8,1,0x81,0xfe});d(0x23456789);e(new byte[]{0x74,3,0x83,0xc8,2,0x81,0xff});d(0x3456789a);e(new byte[]{0x74,3,0x83,0xc8,4,0x3b,0x2c,0x24,0x74,3,0x83,0xc8,8,0x8d,0x4d,0xf0,0x3b,0xe1,0x74,3,0x83,0xc8,16,0x8b,0xe1,0x83,0xc4,4,0x5f,0x5e,0x5b,0x5d,0xc2,16,0});return (Invoke)Marshal.GetDelegateForFunctionPointer(Stub(c.ToArray()),typeof(Invoke));
 }
 static Invoke call;static IntPtr self,msg,regs,layoutList;
 static int[] Run(PE p,int fn,int vmt,IntPtr dc,int message){Marshal.WriteIntPtr(self,p.A(vmt));Marshal.Copy(new int[]{message,dc.ToInt32(),0x1234321,0x7777777},0,msg,4);Check(call(p.A(fn),self,msg,regs)==0,"ABI register/stack preservation");Check(Marshal.ReadInt32(msg)==message&&Marshal.ReadIntPtr(msg,4)==dc&&Marshal.ReadInt32(msg,8)==0x1234321&&Marshal.ReadInt32(msg,12)==1,"Message mutation");var r=new int[3];Marshal.Copy(regs,r,0,3);return r;}
 static void Case(PE orig,PE cand,Dictionary<string,object> site,int vmt,int clip,int mode,bool expected,int message){using(var s=new Surface(clip)){
  if(mode==1)SetROP2(s.dc,7);if(mode==2)SetMapMode(s.dc,8);if(mode==3)SetGraphicsMode(s.dc,2);if(mode==4)SetLayout(s.dc,1);if(mode==5)SetBkMode(s.dc,1);
  string state=State(s.dc);int[] a=Run(orig,Num(site["originalRva"]),vmt,s.dc,message),ap=s.Pixels();Check(Array.TrueForAll(ap,x=>(x&0xffffff)==0xffffff),"original erase unexpectedly painted");int[] b=Run(cand,Num(site["originalRva"]),vmt,s.dc,message);Check(State(s.dc)==state,"DC state changed");Check(a[0]==b[0]&&a[1]==b[1]&&a[2]==b[2],"original volatile register behavior changed");var bp=s.Pixels();for(int y=0;y<64;y++)for(int x=0;x<64;x++)if((bp[y*64+x]&0xffffff)!=(expected&&s.Inside(x,y)?0x202020:0xffffff))throw new Exception("prefill coverage mode="+mode+" clip="+clip+" x="+x+" y="+y);checks++;
 }}
 static PE diag;static Dictionary<string,object> dmeta;static int headerRva,counterRva,ringRva;
 static uint U(int r){return unchecked((uint)diag.R(r));}
 static int FirstVmt(Dictionary<string,object> site){foreach(var v in (System.Collections.IEnumerable)site["vmtRvas"])return Num(v);throw new Exception("empty VMT list");}
 static uint[] ReadEvent(){uint seq=U(headerRva+16);var a=new uint[16];for(int i=0;i<16;i++)a[i]=U(ringRva+(int)((seq-1)&255)*64+i*4);return a;}
 static Invoke MakeDiagInvoke(){var c=new List<byte>();Action<byte[]> e=a=>c.AddRange(a);Action<int>d=v=>e(BitConverter.GetBytes(v));
  e(new byte[]{0x55,0x8b,0xec,0x53,0x56,0x57,0x83,0xec,4,0x89,0x2c,0x24,0xbb});d(0x12345678);e(new byte[]{0xbe});d(0x23456789);e(new byte[]{0xbf});d(0x3456789a);
  e(new byte[]{0x68});d(0x5b35);e(new byte[]{0xb8});d(GetProcAddress(LoadLibrary("kernel32.dll"),"SetLastError").ToInt32());e(new byte[]{0xff,0xd0});
  e(new byte[]{0x8b,0x45,12,0x8b,0x55,16,0xb9});d(0x456789ab);e(new byte[]{0xff,0x55,8,0x50,0x8b,0x45,20,0x89,0x50,4,0x89,0x48,8,0x5a,0x89,0x10,0x50,0xb8});d(GetProcAddress(LoadLibrary("kernel32.dll"),"GetLastError").ToInt32());e(new byte[]{0xff,0xd0,0x5a,0x89,0x42,12,0x31,0xc0});
  e(new byte[]{0x81,0xfb});d(0x12345678);e(new byte[]{0x74,3,0x83,0xc8,1,0x81,0xfe});d(0x23456789);e(new byte[]{0x74,3,0x83,0xc8,2,0x81,0xff});d(0x3456789a);e(new byte[]{0x74,3,0x83,0xc8,4,0x3b,0x2c,0x24,0x74,3,0x83,0xc8,8,0x8d,0x4d,0xf0,0x3b,0xe1,0x74,3,0x83,0xc8,16,0x8b,0xe1,0x83,0xc4,4,0x5f,0x5e,0x5b,0x5d,0xc2,16,0});return (Invoke)Marshal.GetDelegateForFunctionPointer(Stub(c.ToArray()),typeof(Invoke));
 }
 static uint[] Event(Dictionary<string,object> site,int id,int vmt,IntPtr dc,int message,int reason,bool nullSelf,bool nullMessage){
  uint seq=U(headerRva+16),committed=U(headerRva+20),count=U(counterRva+(id*32+reason)*4);
  Marshal.WriteIntPtr(self,diag.A(vmt));Marshal.Copy(new int[]{message,dc.ToInt32(),0x1234321,0x7777777},0,msg,4);
  Check(call(diag.A(Num(site["originalRva"])),nullSelf?IntPtr.Zero:self,nullMessage?IntPtr.Zero:msg,regs)==0,"diagnostic ABI");
  Check(Marshal.ReadInt32(regs,12)==0x5b35,"diagnostic LastError preservation");
  Check(U(headerRva+16)==seq+1&&U(headerRva+20)==committed+1,"sequence and committed counts");
  if(ReadEvent()[4]!=(uint)reason)Console.WriteLine("Actual event: "+string.Join(",",Array.ConvertAll(ReadEvent(),x=>x.ToString())));
  Check(U(counterRva+(id*32+reason)*4)==count+1,"reason counter");
  var e=ReadEvent();Check(e[0]==seq+1&&e[1]==id&&e[4]==reason,"event commit/site/reason");
  Check(e[2]==(nullSelf?0:(uint)vmt)&&e[3]==(nullSelf?0:unchecked((uint)self.ToInt32())),"actual VMT/Self recorded even for class mismatch");
  Check(e[15]==(nullSelf||nullMessage?uint.MaxValue:(uint)message),"message identifier");
  Check(e[14]==(reason<=4?uint.MaxValue:unchecked((uint)dc.ToInt32())),"HDC field");
  Check(Marshal.ReadInt32(msg)==message&&Marshal.ReadIntPtr(msg,4)==dc&&Marshal.ReadInt32(msg,8)==0x1234321&&Marshal.ReadInt32(msg,12)==0x7777777,"diagnostic did not mutate Message");
  return e;
 }
 static uint[] Event(Dictionary<string,object> site,int id,int vmt,IntPtr dc,int reason){return Event(site,id,vmt,dc,0x14,reason,false,false);}
 static void Slot(int rva,int value,Action run){int saved=diag.R(rva);diag.W(rva,value);try{run();}finally{diag.W(rva,saved);}}
 static int Constant(int value,int bytes){var b=new List<byte>{0xb8};b.AddRange(BitConverter.GetBytes(value));b.Add(0xc2);b.Add((byte)bytes);b.Add(0);return Stub(b.ToArray()).ToInt32();}
 static void VerifyHeader(){Check(U(headerRva)==0x58444645&&U(headerRva+4)==1,"diagnostic magic/schema");Check(U(headerRva+8)==256&&U(headerRva+12)==64&&U(headerRva+24)==4&&U(headerRva+28)==32,"diagnostic shape");Check(Num(dmeta["byteLength"])==16928,"finite buffer size");}
 static void Main(string[] args){try{Execute(args);}catch(Exception ex){Console.Error.WriteLine(ex.GetType().Name+": "+ex.Message);Environment.ExitCode=1;}}
 static void Execute(string[] args){diag=new PE(args[0]);var meta=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(args[1]));var native=(Dictionary<string,object>)meta[meta.ContainsKey("nativeInitialErase")?"nativeInitialErase":"nativeErase"];dmeta=(Dictionary<string,object>)native["diagnostics"];headerRva=Num(dmeta["headerRva"]);counterRva=Num(dmeta["countersRva"]);ringRva=Num(dmeta["ringRva"]);VerifyHeader();
  var dyn=(Dictionary<string,object>)native["dynamicSlots"];foreach(var kv in dyn)Marshal.WriteIntPtr(diag.A(Num(kv.Value)),GetProcAddress(LoadLibrary("gdi32.dll"),kv.Key));
  int brushRva;if(meta.ContainsKey("brushRva"))brushRva=Num(meta["brushRva"]);else{var hooks=(System.Collections.ICollection)meta["hooks"];brushRva=Num(meta["sectionRVA"])+Num(meta["slots"])+hooks.Count*4+5*4;}
  var brush=CreateSolidBrush(0x202020);diag.W(brushRva,brush.ToInt32());call=MakeDiagInvoke();self=Marshal.AllocHGlobal(0x500);for(int i=0;i<0x500;i++)Marshal.WriteByte(self,i,0);msg=Marshal.AllocHGlobal(16);regs=Marshal.AllocHGlobal(16);
  var sites=new List<Dictionary<string,object>>();foreach(var x in (System.Collections.IEnumerable)native["sites"])sites.Add((Dictionary<string,object>)x);
  for(int id=0;id<sites.Count;id++){var site=sites[id];byte[] tail=(string)site["name"]=="settingsButtons"?new byte[]{0x5e,0x5b,0xc3}:new byte[]{0xc9,0xc3};Marshal.Copy(tail,0,diag.A(Num(site["originalRva"])+6),tail.Length);
   int vmt=0;foreach(var x in (System.Collections.IEnumerable)site["vmtRvas"]){vmt=Num(x);break;}
   using(var s=new Surface(0)){
    Event(site,id,vmt,s.dc,0x14,1,true,false);Event(site,id,vmt,s.dc,0x14,2,false,true);Event(site,id,vmt,s.dc,0x15,3,false,false);Event(site,id,vmt+4,s.dc,4);Event(site,id,vmt,IntPtr.Zero,5);
    Slot(diag.iats["GetDeviceCaps"],Constant(2,8),()=>{var e=Event(site,id,vmt,s.dc,6);Check(e[5]==2&&e[6]==uint.MaxValue,"technology skip record");});
    Slot(Num(dyn["GetLayout"]),0,()=>{var e=Event(site,id,vmt,s.dc,7);Check(e[5]==1&&e[6]==uint.MaxValue,"missing resolver skip record");});
    Slot(Num(dyn["GetObjectType"]),Constant(2,4),()=>{var e=Event(site,id,vmt,s.dc,8);Check(e[6]==2&&e[7]==uint.MaxValue,"HDC type record");});
    Slot(diag.iats["GetCurrentObject"],Constant(0,8),()=>Event(site,id,vmt,s.dc,9));
    Slot(diag.iats["GetObjectA"],Constant(0,12),()=>Event(site,id,vmt,s.dc,10));
    SetMapMode(s.dc,8);Check(Event(site,id,vmt,s.dc,12)[8]==8,"map mode record");SetMapMode(s.dc,1);
    SetROP2(s.dc,7);Check(Event(site,id,vmt,s.dc,13)[9]==7,"ROP record");SetROP2(s.dc,13);
    SetGraphicsMode(s.dc,2);Check(Event(site,id,vmt,s.dc,14)[10]==2,"graphics mode record");SetGraphicsMode(s.dc,1);
    SetLayout(s.dc,1);Check(Event(site,id,vmt,s.dc,12)[8]==8,"real RTL DC first fails map mode guard");SetLayout(s.dc,0);SetMapMode(s.dc,1);
    Slot(Num(dyn["GetLayout"]),Constant(1,4),()=>Check(Event(site,id,vmt,s.dc,15)[11]==1,"layout record after preceding guards pass"));
    Slot(diag.iats["GetClipBox"],Constant(0,8),()=>Check(Event(site,id,vmt,s.dc,16)[12]==0,"clip failure record"));
    Slot(brushRva,0,()=>Event(site,id,vmt,s.dc,17));Slot(brushRva,-1,()=>Event(site,id,vmt,s.dc,17));
    Slot(diag.iats["FillRect"],Constant(0,12),()=>Check(Event(site,id,vmt,s.dc,18)[13]==0,"failed fill result"));
    string state=State(s.dc);var filled=Event(site,id,vmt,s.dc,19);Check(filled[5]==1&&filled[6]==10&&filled[7]==32&&filled[8]==1&&filled[9]==13&&filled[10]==1&&filled[11]==0&&filled[12]>=2&&filled[13]!=0&&filled[13]!=uint.MaxValue,"complete successful state");Check(State(s.dc)==state,"successful logger preserves DC");Check(Array.TrueForAll(s.Pixels(),p=>(p&0xffffff)==0x202020),"successful fill remains dark");
    Slot(Num(dyn["GetObjectType"]),Constant(3,4),()=>{var e=Event(site,id,vmt,s.dc,19);Check(e[6]==3&&e[7]>8,"display DC branch values");});
    var capStub=Stub(new byte[]{0x83,0x7c,0x24,8,2,0x75,8,0xb8,1,0,0,0,0xc2,8,0,0xb8,8,0,0,0,0xc2,8,0});
    Slot(Num(dyn["GetObjectType"]),Constant(3,4),()=>Slot(diag.iats["GetDeviceCaps"],capStub.ToInt32(),()=>Check(Event(site,id,vmt,s.dc,11)[7]==8,"display low-bpp record")));
   }
   using(var s=new Surface(3))Check(Event(site,id,vmt,s.dc,16)[12]==1,"empty clip record");
   var mono=CreateCompatibleDC(IntPtr.Zero);var bitmap=CreateBitmap(64,64,1,1,IntPtr.Zero);var old=SelectObject(mono,bitmap);Check(Event(site,id,vmt,mono,11)[7]==1,"monochrome record");SelectObject(mono,old);DeleteObject(bitmap);DeleteDC(mono);
   Console.WriteLine("PASS "+site["name"]+" all 19 reasons, numeric state, ABI, LastError and message preservation");
  }
  using(var s=new Surface(0)){
   string before=State(s.dc);var e=Event(sites[3],3,0xbdc9b0,s.dc,20);
   Check(e[6]==10&&e[7]==32&&e[12]>=2&&e[13]==uint.MaxValue,"main-form observation has real DC state and no fill result");
   Check(State(s.dc)==before,"main-form observation preserves DC state");
   Check(Array.TrueForAll(s.Pixels(),p=>(p&0xffffff)==0xffffff),"main-form observation does not draw");
  }
  Console.WriteLine("PASS main-form diagnostic observation without prefill");
  var first=sites[0];int fvmt=FirstVmt(first);for(int n=0;n<600;n++)Event(first,0,fvmt+4,IntPtr.Zero,4);uint seqAfterWrap=U(headerRva+16);for(uint n=seqAfterWrap-255;n<=seqAfterWrap;n++)Check(U(ringRva+(int)((n-1)&255)*64)==n,"sequential ring wrap/commit");
  uint totalBefore=U(headerRva+16),commitBefore=U(headerRva+20);var expectedCounts=new uint[4];for(int i=0;i<4;i++)expectedCounts[i]=U(counterRva+(i*32+4)*4);
  int bad=0;var workers=new List<System.Threading.Thread>();for(int i=0;i<4;i++){int id=i;var t=new System.Threading.Thread(()=>{var site=sites[id];int v=FirstVmt(site)+4;IntPtr localSelf=Marshal.AllocHGlobal(4),localMsg=Marshal.AllocHGlobal(16),localRegs=Marshal.AllocHGlobal(16);Marshal.WriteIntPtr(localSelf,diag.A(v));Marshal.Copy(new int[]{0x14,0,0,0},0,localMsg,4);for(int j=0;j<4000;j++)if(call(diag.A(Num(site["originalRva"])),localSelf,localMsg,localRegs)!=0||Marshal.ReadInt32(localRegs,12)!=0x5b35)System.Threading.Interlocked.Increment(ref bad);Marshal.FreeHGlobal(localSelf);Marshal.FreeHGlobal(localMsg);Marshal.FreeHGlobal(localRegs);});workers.Add(t);t.Start();}foreach(var t in workers)t.Join();
  Check(bad==0,"concurrent ABI and LastError");Check(U(headerRva+16)==totalBefore+16000&&U(headerRva+20)==commitBefore+16000,"atomic concurrent total counters");for(int i=0;i<4;i++)Check(U(counterRva+(i*32+4)*4)==expectedCounts[i]+4000,"atomic concurrent per-site counters");
  uint latest=U(headerRva+16);int valid=0;for(int slot=0;slot<256;slot++){uint sq=U(ringRva+slot*64);if(sq>=latest-255&&sq<=latest){Check(((sq-1)&255)==slot,"ring slot/sequence");Check(U(ringRva+slot*64+4)<4&&U(ringRva+slot*64+16)==4,"committed concurrent event shape");valid++;}}Check(valid>0,"readable committed events after concurrency");
  uint sum=0;for(int n=0;n<128;n++)sum+=U(counterRva+n*4);Check(sum==U(headerRva+20),"reason counts sum to committed events");VerifyHeader();
  DeleteObject(brush);Marshal.FreeHGlobal(self);Marshal.FreeHGlobal(msg);Marshal.FreeHGlobal(regs);Console.WriteLine("PASS "+checks+" diagnostic checks, "+latest+" records including 16,000 concurrent entries; no application initialization.");
 }
}
