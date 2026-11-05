using System;using System.IO;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Web.Script.Serialization;
class PaintDiagnosticCheck {
 [DllImport("kernel32")]static extern IntPtr VirtualAlloc(IntPtr a,UIntPtr n,uint t,uint p);
 [DllImport("kernel32",CharSet=CharSet.Ansi)]static extern IntPtr LoadLibrary(string s);
 [DllImport("kernel32",CharSet=CharSet.Ansi)]static extern IntPtr GetProcAddress(IntPtr h,string s);
 [DllImport("gdi32")]static extern IntPtr CreateCompatibleDC(IntPtr dc);
 [DllImport("gdi32")]static extern IntPtr CreateDIBSection(IntPtr dc,IntPtr bi,uint usage,out IntPtr bits,IntPtr sec,uint off);
 [DllImport("gdi32")]static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
 [DllImport("gdi32")]static extern bool DeleteObject(IntPtr obj);
 [DllImport("gdi32")]static extern bool DeleteDC(IntPtr dc);
 [DllImport("gdi32")]static extern bool GdiFlush();
 [DllImport("gdi32")]static extern IntPtr CreateHatchBrush(int hatch,uint color);
 [DllImport("user32")]static extern IntPtr GetDC(IntPtr hwnd);
 [DllImport("user32")]static extern int ReleaseDC(IntPtr hwnd,IntPtr dc);
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
 static Invoke MakeCall(int argc){var c=new List<byte>();Action<byte[]> e=a=>c.AddRange(a);Action<int>d=v=>e(BitConverter.GetBytes(v));
  // Isolated painter-shaped frame; fn,self,HDC,output passed via stdcall.
  e(new byte[]{0x55,0x8b,0xec,0x83,0xec,16,0x53,0x56,0x57,0x8b,0x45,12,0x89,0x45,0xfc,0x8b,0x55,16,0x89,0x55,0xf8});
  e(new byte[]{0xbb});d(0x12345678);e(new byte[]{0xbe});d(0x23456789);e(new byte[]{0xbf});d(0x3456789a);
  e(new byte[]{0x64,0xc7,5,0x34,0,0,0});d(0x5b35);
  for(int n=argc;n>0;n--){e(new byte[]{0x68});d(0x700+n);}
  e(new byte[]{0xb8});d(0x11111111);e(new byte[]{0xb9});d(0x33333333);e(new byte[]{0xf9,0xff,0x55,8,0x9c,0x50,0x8b,0x45,20,0x89,0x50,4,0x89,0x48,8,0x5a,0x89,0x10,0x5a,0x89,0x50,16,0xfc,0x64,0x8b,0x15,0x34,0,0,0,0x89,0x50,12,0x31,0xc0});
  foreach(var pair in new[]{new int[]{0xfb,0x12345678,1},new int[]{0xfe,0x23456789,2},new int[]{0xff,0x3456789a,4}}){e(new byte[]{0x81,(byte)pair[0]});d(pair[1]);e(new byte[]{0x74,3,0x83,0xc8,(byte)pair[2]});}
  e(new byte[]{0x8d,0x4d,0xe4,0x3b,0xe1,0x74,3,0x83,0xc8,8,0x8d,0x65,0xe4,0x5f,0x5e,0x5b,0xc9,0xc2,16,0});return (Invoke)Marshal.GetDelegateForFunctionPointer(Stub(c.ToArray()),typeof(Invoke));
 }
 static byte[] Mock(IntPtr counter,IntPtr failure,int argc){var c=new List<byte>();Action<byte[]>e=a=>c.AddRange(a);Action<int>d=v=>e(BitConverter.GetBytes(v));e(new byte[]{0xff,5});d(counter.ToInt32());
  e(new byte[]{0x64,0x81,0x3d,0x34,0,0,0});d(0x5b35);e(new byte[]{0x74,10,0xc7,5});d(failure.ToInt32());d(1);
  for(int n=1;n<=argc;n++){e(new byte[]{0x81,0x7c,0x24,(byte)(n*4)});d(0x700+n);e(new byte[]{0x74,10,0xc7,5});d(failure.ToInt32());d(1);}
  e(new byte[]{0xb8});d(0x11112222);e(new byte[]{0xb9});d(0x33334444);e(new byte[]{0xba});d(0x55556666);e(new byte[]{0x64,0xc7,5,0x34,0,0,0});d(0x5b36);e(new byte[]{0x68,0x47,6,0,0,0x9d,0xc2,(byte)(argc*4),0});return c.ToArray();
 }
 static void Main(string[] args){try{Run(args);}catch(Exception ex){Console.Error.WriteLine(ex);Environment.ExitCode=1;}}
 static void Run(string[] args){var p=new PE(args[0]);var all=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(args[1]));var meta=(Dictionary<string,object>)all["nativePaintPhase"];var diag=(Dictionary<string,object>)meta["diagnostics"];int header=Num(diag["headerRva"]),ring=Num(diag["ringRva"]);Check(p.R(header)==0x58445050&&p.R(header+4)==1&&p.R(header+8)==256&&p.R(header+12)==128,"header schema");
  int init;
  if(all.ContainsKey("initRva"))init=Num(all["initRva"]);
  else {Marshal.WriteByte(p.A(Num(all["originalEntryRVA"])),0xc3);init=Num(all["sectionRVA"])+Num(all["entry"]);}
  ((Entry)Marshal.GetDelegateForFunctionPointer(p.A(init),typeof(Entry)))();
  foreach(var x in (Dictionary<string,object>)meta["dynamicSlots"])Check(p.R(Num(x.Value))!=0,"resolved "+x.Key);
  var self=Marshal.AllocHGlobal(4);var output=Marshal.AllocHGlobal(20);var count=Marshal.AllocHGlobal(4);var fail=Marshal.AllocHGlobal(4);
  int id=0;
  foreach(Dictionary<string,object> site in (System.Collections.IEnumerable)meta["sites"]){if(id>=8)break;string phase=(string)site["phase"];int argc=phase=="beforeBitBlt"?9:phase=="beforeText"?3:0;var invoke=MakeCall(argc);var mock=Mock(count,fail,argc);Marshal.Copy(mock,0,p.A(Num(site["originalTargetRva"])),mock.Length);Marshal.WriteInt32(count,0);Marshal.WriteInt32(fail,0);
   using(var s=new Surface(0)){var brush=CreateSolidBrush(0x382716);var oldBrush=SelectObject(s.dc,brush);SetBkMode(s.dc,2);
    // Distinct known colors directly in the DIB; never read application pixels.
    Marshal.WriteInt32(s.bits,0,0x112233);Marshal.WriteInt32(s.bits,63*4,0x223344);Marshal.WriteInt32(s.bits,63*64*4,0x334455);Marshal.WriteInt32(s.bits,4095*4,0x445566);
    int[] expected={0x332211,0x443322,0x554433,0x665544};string before=State(s.dc);var pixels=s.Pixels();
    for(int mode=0;mode<7;mode++){Marshal.WriteIntPtr(self,p.A(Num(site["vmtRva"])+(mode==1?4:0)));IntPtr obj=mode==2?IntPtr.Zero:self,dc=mode==3?IntPtr.Zero:s.dc;
     int oldPixel=0;if(mode==4){var slots=(Dictionary<string,object>)meta["dynamicSlots"];int slot=Num(slots["GetPixel"]);oldPixel=p.R(slot);p.W(slot,0);}
     if(mode==5)SetMapMode(s.dc,8);
     if(mode==6)dc=new IntPtr(0x1234);
     int seq=p.R(header+16),oldCount=Marshal.ReadInt32(count);Check(invoke(p.A(Num(site["entryRva"])),obj,dc,output)==0,"nonvolatile registers and stack "+site["name"]);
     Check(Marshal.ReadInt32(count)==oldCount+1&&Marshal.ReadInt32(fail)==0,"original call exactly once, pushed args intact");Check(Marshal.ReadInt32(output)==0x11112222&&Marshal.ReadInt32(output,4)==0x55556666&&Marshal.ReadInt32(output,8)==0x33334444,"original volatile result");Check((Marshal.ReadInt32(output,16)&0xcd5)==0x445,"original arithmetic and direction flags");Check(Marshal.ReadInt32(output,12)==0x5b36,"original LastError");
     Check(p.R(header+16)==seq+1&&p.R(header+20)==seq+1,"sequence and committed");int ev=ring+(seq&255)*128;Check(p.R(ev)==seq+1&&p.R(ev+4)==id,"committed event identity");Check(p.R(ev+12)==obj.ToInt32(),"actual Self");
     if(mode==0){Check(p.R(ev+8)==p.A(Num(site["vmtRva"])).ToInt32(),"actual VMT");Check(p.R(ev+16)==dc.ToInt32()&&p.R(ev+20)==10&&p.R(ev+24)==32&&p.R(ev+28)==2,"memory DC state");Check(p.R(ev+32)==unchecked((int)GetBkColor(dc))&&p.R(ev+36)==unchecked((int)GetTextColor(dc)),"actual GDI colors");Check(p.R(ev+44)==0&&p.R(ev+48)==0x382716,"brush style/color");Check(p.R(ev+52)==64&&p.R(ev+56)==64,"bitmap dimensions");for(int n=0;n<4;n++)Check(p.R(ev+60+n*4)==expected[n],"known corner color "+n);}
     else {Check(p.R(ev+60)==-1,"guard does not sample corners mode "+mode);}
     if(mode==4)p.W(Num(((Dictionary<string,object>)meta["dynamicSlots"])["GetPixel"]),oldPixel);if(mode==5)SetMapMode(s.dc,1);
    }
    Marshal.WriteIntPtr(self,p.A(Num(site["vmtRva"])));
    var hatch=CreateHatchBrush(4,0x776655);SelectObject(s.dc,hatch);int hs=p.R(header+16);Check(invoke(p.A(Num(site["entryRva"])),self,s.dc,output)==0,"hatch ABI");int he=ring+(hs&255)*128;Check(p.R(he+44)==2&&p.R(he+48)==0x776655,"actual hatch brush style/color");SelectObject(s.dc,brush);DeleteObject(hatch);
    var mono=CreateCompatibleDC(IntPtr.Zero);var mb=CreateBitmap(64,64,1,1,IntPtr.Zero);var mo=SelectObject(mono,mb);var screen=GetDC(IntPtr.Zero);
    var dyn=(Dictionary<string,object>)meta["dynamicSlots"];int pixelSlot=Num(dyn["GetPixel"]),savedPixel=p.R(pixelSlot);var pixelCount=Marshal.AllocHGlobal(4);Marshal.WriteInt32(pixelCount,0);var trap=new List<byte>{0xff,5};trap.AddRange(BitConverter.GetBytes(pixelCount.ToInt32()));trap.AddRange(new byte[]{0x83,0xc8,0xff,0xc2,12,0});p.W(pixelSlot,Stub(trap.ToArray()).ToInt32());
    foreach(var guardedDC in new[]{mono,screen}){int sq=p.R(header+16);Check(invoke(p.A(Num(site["entryRva"])),self,guardedDC,output)==0,"guard ABI");int evg=ring+(sq&255)*128;Check(p.R(evg+60)==-1,"guard no corner result");if(guardedDC==mono)Check(p.R(evg+24)==1,"real monochrome bpp");else Check(p.R(evg+20)==3,"screen DC rejected");}Check(Marshal.ReadInt32(pixelCount)==0,"GetPixel never called for mono or screen DC");p.W(pixelSlot,savedPixel);Marshal.FreeHGlobal(pixelCount);ReleaseDC(IntPtr.Zero,screen);SelectObject(mono,mo);DeleteObject(mb);DeleteDC(mono);
    Check(State(s.dc)==before,"DC state unchanged");Check(string.Join(",",pixels)==string.Join(",",s.Pixels()),"all DIB pixels unchanged");SelectObject(s.dc,oldBrush);DeleteObject(brush);
   }Console.WriteLine("PASS "+site["name"]+" ABI, original call, flags, LastError, GDI state, corners and skip guards");id++;
  }
  // Finite ring wrap with mismatch guards; original mock executes normally.
  var first=(Dictionary<string,object>)((System.Collections.IList)meta["sites"])[0];var again=MakeCall(0);Marshal.Copy(Mock(count,fail,0),0,p.A(Num(first["originalTargetRva"])),Mock(count,fail,0).Length);Marshal.WriteIntPtr(self,p.A(Num(first["vmtRva"])+4));for(int n=0;n<600;n++)Check(again(p.A(Num(first["entryRva"])),self,IntPtr.Zero,output)==0,"wrap ABI");int latest=p.R(header+16);for(int n=latest-255;n<=latest;n++)Check(p.R(ring+((n-1)&255)*128)==n,"ring wrap commit");
  Console.WriteLine("PASS "+checks+" checks; "+latest+" bounded numeric events; no application initialization");
 }
}
