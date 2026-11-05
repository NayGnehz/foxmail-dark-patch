using System;
using System.IO;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Diagnostics;
class GradientCheck {
 [DllImport("kernel32")] static extern IntPtr VirtualAlloc(IntPtr a,UIntPtr n,uint t,uint p);
 [DllImport("kernel32",CharSet=CharSet.Ansi)] static extern IntPtr LoadLibrary(string s);
 [DllImport("kernel32",CharSet=CharSet.Ansi)] static extern IntPtr GetProcAddress(IntPtr h,string s);
 [DllImport("gdi32")] static extern IntPtr CreateCompatibleDC(IntPtr d);
 [DllImport("gdi32")] static extern bool DeleteDC(IntPtr d);
 [DllImport("gdi32")] static extern IntPtr CreateDIBSection(IntPtr dc,IntPtr bi,uint usage,out IntPtr bits,IntPtr sec,uint offset);
 [DllImport("gdi32")] static extern IntPtr SelectObject(IntPtr d,IntPtr o);
 [DllImport("gdi32")] static extern bool DeleteObject(IntPtr o);
 [DllImport("gdi32")] static extern bool GdiFlush();
 [DllImport("gdi32")] static extern IntPtr CreatePen(int style,int width,uint color);
 [DllImport("gdi32")] static extern IntPtr GetCurrentObject(IntPtr dc,uint type);
 [DllImport("gdi32")] static extern bool GetCurrentPositionEx(IntPtr dc,out POINT p);
 [DllImport("gdi32")] static extern bool MoveToEx(IntPtr dc,int x,int y,IntPtr old);
 [DllImport("gdi32")] static extern int SetROP2(IntPtr dc,int mode);
 [DllImport("gdi32")] static extern int GetROP2(IntPtr dc);
 [DllImport("gdi32")] static extern int SetMapMode(IntPtr dc,int mode);
 [DllImport("gdi32")] static extern int GetMapMode(IntPtr dc);
 [DllImport("gdi32")] static extern IntPtr CreateRectRgn(int l,int t,int r,int b);
 [DllImport("gdi32")] static extern int SelectClipRgn(IntPtr dc,IntPtr region);
 [DllImport("gdi32")] static extern int SetGraphicsMode(IntPtr dc,int mode);
 [DllImport("gdi32")] static extern uint SetLayout(IntPtr dc,uint layout);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int Invoke(IntPtr fn,IntPtr dc,IntPtr rect,int direction,uint start,uint end);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate void Entry();
 struct POINT { public int x,y; }
 class PE {
  public byte[] b; public IntPtr mem; public int pe,op,size; public Dictionary<string,int> iats=new Dictionary<string,int>(StringComparer.OrdinalIgnoreCase);
  public PE(string path) {
   b=File.ReadAllBytes(path);pe=I(b,60);op=pe+24;size=I(b,op+56);mem=VirtualAlloc(IntPtr.Zero,(UIntPtr)size,0x3000,0x40);if(mem==IntPtr.Zero)throw new Exception("alloc");
   Marshal.Copy(b,0,mem,I(b,op+60));int ns=BitConverter.ToUInt16(b,pe+6),sh=op+BitConverter.ToUInt16(b,pe+20);
   for(int s=0;s<ns;s++){int p=sh+s*40,raw=I(b,p+20),n=I(b,p+16);if(n>0)Marshal.Copy(b,raw,A(I(b,p+12)),n);}
   int delta=unchecked(mem.ToInt32()-I(b,op+28)),rel=I(b,op+136),end=rel+I(b,op+140);
   while(rel!=0&&rel<end){int page=R(rel),block=R(rel+4);if(block<8)break;for(int p=rel+8;p<rel+block;p+=2){ushort v=(ushort)Marshal.ReadInt16(A(p));if((v>>12)==3){int at=page+(v&4095);W(at,unchecked(R(at)+delta));}}rel+=block;}
   int imp=I(b,op+104);
   for(int d=imp;R(d+12)!=0;d+=20){string dll=Marshal.PtrToStringAnsi(A(R(d+12)));int iat=R(d+16),table=R(d);if(table==0)table=iat;bool allow=dll.Equals("kernel32.dll",StringComparison.OrdinalIgnoreCase)||dll.Equals("user32.dll",StringComparison.OrdinalIgnoreCase)||dll.Equals("gdi32.dll",StringComparison.OrdinalIgnoreCase)||dll.Equals("msimg32.dll",StringComparison.OrdinalIgnoreCase);IntPtr lib=allow?LoadLibrary(dll):IntPtr.Zero;
    for(int n=0;R(table+4*n)!=0;n++){int v=R(table+4*n);if(v<0)continue;string name=Marshal.PtrToStringAnsi(A(v+2));iats[name]=iat+4*n;if(allow){IntPtr f=GetProcAddress(lib,name);if(f==IntPtr.Zero)throw new Exception("missing "+name);Marshal.WriteIntPtr(A(iat+4*n),f);}}
   }
  }
  public IntPtr A(int r){return IntPtr.Add(mem,r);} public int R(int r){return Marshal.ReadInt32(A(r));} public void W(int r,int v){Marshal.WriteInt32(A(r),v);}
 }
 class Surface : IDisposable {
  public IntPtr dc,bmp,bits,old,pen,oldpen;public const int N=64;
  public Surface(){dc=CreateCompatibleDC(IntPtr.Zero);IntPtr bi=Marshal.AllocHGlobal(40);for(int i=0;i<40;i++)Marshal.WriteByte(bi,i,0);Marshal.WriteInt32(bi,40);Marshal.WriteInt32(bi,4,N);Marshal.WriteInt32(bi,8,-N);Marshal.WriteInt16(bi,12,1);Marshal.WriteInt16(bi,14,32);bmp=CreateDIBSection(dc,bi,0,out bits,IntPtr.Zero,0);Marshal.FreeHGlobal(bi);if(bmp==IntPtr.Zero)throw new Exception("DIB");old=SelectObject(dc,bmp);pen=CreatePen(0,1,0x1234ff);oldpen=SelectObject(dc,pen);Clear();}
  public void Clear(){GdiFlush();for(int i=0;i<N*N;i++)Marshal.WriteInt32(bits,i*4,0x00c3b2a1);MoveToEx(dc,7,9,IntPtr.Zero);}
  public int[] Pixels(){GdiFlush();int[] p=new int[N*N];Marshal.Copy(bits,p,0,p.Length);return p;}
  public void Clip(){IntPtr r=CreateRectRgn(5,7,20,23);SelectClipRgn(dc,r);DeleteObject(r);}
  public void Dispose(){SelectObject(dc,oldpen);DeleteObject(pen);SelectObject(dc,old);DeleteObject(bmp);DeleteDC(dc);}
 }
 static int I(byte[] b,int p){return BitConverter.ToInt32(b,p);}static int Num(object o){return Convert.ToInt32(o);}
 static Invoke makeInvoke(){
  // Six stdcall args -> Delphi EAX/EDX/CL + two stack colors. Check all callee-saved registers and stack.
  var c=new List<byte>();Action<byte[]> emit=a=>c.AddRange(a);Action<int> d=v=>emit(BitConverter.GetBytes(v));
  emit(new byte[]{0x55,0x8b,0xec,0x53,0x56,0x57,0x83,0xec,4,0x89,0x2c,0x24,0xbb});d(0x12345678);emit(new byte[]{0xbe});d(0x23456789);emit(new byte[]{0xbf});d(0x3456789a);
  emit(new byte[]{0x8b,0x45,12,0x8b,0x55,16,0x8b,0x4d,20,0xff,0x75,24,0xff,0x75,28,0xff,0x55,8,0x31,0xc0});
  emit(new byte[]{0x81,0xfb});d(0x12345678);emit(new byte[]{0x74,3,0x83,0xc8,1,0x81,0xfe});d(0x23456789);emit(new byte[]{0x74,3,0x83,0xc8,2,0x81,0xff});d(0x3456789a);emit(new byte[]{0x74,3,0x83,0xc8,4,0x3b,0x2c,0x24,0x74,3,0x83,0xc8,8,0x8d,0x4d,0xf0,0x3b,0xe1,0x74,3,0x83,0xc8,16,0x8b,0xe1,0x83,0xc4,4,0x5f,0x5e,0x5b,0x5d,0xc2,24,0});
  IntPtr p=VirtualAlloc(IntPtr.Zero,(UIntPtr)c.Count,0x3000,0x40);Marshal.Copy(c.ToArray(),0,p,c.Count);return (Invoke)Marshal.GetDelegateForFunctionPointer(p,typeof(Invoke));
 }
 static Invoke invoke;static int checks;
 static void Check(bool ok,string s){if(!ok){Console.WriteLine("FAIL: "+s);Environment.Exit(2);}checks++;}
 static int Run(PE pe,int fn,Surface s,int[] rect,int direction,uint start,uint end){IntPtr r=Marshal.AllocHGlobal(16);Marshal.Copy(rect,0,r,4);int status=invoke(pe.A(fn),s.dc,r,direction,start,end);Check(status==0,"ABI flags "+status);for(int i=0;i<4;i++)Check(Marshal.ReadInt32(r,i*4)==rect[i],"RECT changed");Check(GetCurrentObject(s.dc,1)==s.pen,"selected pen changed");Marshal.FreeHGlobal(r);return status;}
 static int diff(int[] a,int[] b){int max=0;for(int i=0;i<a.Length;i++)for(int s=0;s<24;s+=8)max=Math.Max(max,Math.Abs(((a[i]>>s)&255)-((b[i]>>s)&255)));return max;}
 static void Compare(PE original,PE candidate,int fn,string label,int[] rect,int direction,uint start,uint end,int mode,bool clip,int tolerance){using(var a=new Surface())using(var b=new Surface()){
  if(clip){a.Clip();b.Clip();}if(mode==1){SetROP2(a.dc,7);SetROP2(b.dc,7);}if(mode==2){SetMapMode(a.dc,8);SetMapMode(b.dc,8);}if(mode==3){SetGraphicsMode(a.dc,2);SetGraphicsMode(b.dc,2);}if(mode==4){SetLayout(a.dc,1);SetLayout(b.dc,1);}
  Run(original,0x4b62d4,a,rect,direction,start,end);Run(candidate,fn,b,rect,direction,start,end);int[] ap=a.Pixels(),bp=b.Pixels();int delta=diff(ap,bp);bool coverage=true;for(int i=0;i<ap.Length;i++)if(((ap[i]&0xffffff)==0xc3b2a1)!=((bp[i]&0xffffff)==0xc3b2a1))coverage=false;Check(coverage,label+" clipping/coverage changed");Check(delta<=tolerance,label+" raster delta "+delta);
  POINT pa,pb;GetCurrentPositionEx(a.dc,out pa);GetCurrentPositionEx(b.dc,out pb);Check(pa.x==pb.x&&pa.y==pb.y,label+" current position "+pa.x+","+pa.y+" vs "+pb.x+","+pb.y);Check(GetROP2(a.dc)==GetROP2(b.dc),"ROP2 changed");Check(GetMapMode(a.dc)==GetMapMode(b.dc),"map mode changed");Console.WriteLine("PASS "+label+" (max channel delta="+delta+")");
 }}
 static void Bench(PE p,int fn,string label){using(var s=new Surface()){IntPtr rect=Marshal.AllocHGlobal(16);Marshal.Copy(new int[]{0,0,64,32},0,rect,4);for(int n=0;n<100;n++)invoke(p.A(fn),s.dc,rect,1,0x322b26,0x28221e);GdiFlush();var sw=Stopwatch.StartNew();for(int n=0;n<5000;n++)invoke(p.A(fn),s.dc,rect,1,0x322b26,0x28221e);GdiFlush();sw.Stop();Console.WriteLine("BENCH "+label+": 5000 64x32 gradients "+sw.ElapsedMilliseconds+" ms");Marshal.FreeHGlobal(rect);}}
 static IntPtr Stub(byte[] bytes){IntPtr p=VirtualAlloc(IntPtr.Zero,(UIntPtr)bytes.Length,0x3000,0x40);Marshal.Copy(bytes,0,p,bytes.Length);return p;}
 static void Main(string[] args){
  Console.WriteLine("Mapping original");var original=new PE(args[0]);Console.WriteLine("Mapping candidate");var candidate=new PE(args[1]);Console.WriteLine("Reading metadata");var meta=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(args[2]));var bridge=(Dictionary<string,object>)meta["nativeGradient"];int fn=Num(bridge["entryRva"]),section=Num(meta["sectionRVA"]),slots=Num(meta["slots"]);
  foreach(var x in (System.Collections.IEnumerable)meta["hooks"]){var h=(Dictionary<string,object>)x;string dll=(string)h["dll"],name=(string)h["name"];IntPtr proc=GetProcAddress(LoadLibrary(dll),name);Marshal.WriteIntPtr(candidate.A(section+slots+Num(h["slot"])*4),proc);}
  var dynamic=(Dictionary<string,object>)bridge["dynamicSlots"];foreach(var item in dynamic)Marshal.WriteIntPtr(candidate.A(Num(item.Value)),GetProcAddress(LoadLibrary("gdi32.dll"),item.Key));
  Console.WriteLine("Creating thunk");invoke=makeInvoke();Console.WriteLine("Testing helpers");
  Compare(original,candidate,fn,"dark gradient",new[]{2,3,46,40},1,0x322b26,0x28221e,0,false,2);
  Compare(original,candidate,fn,"clipped gradient",new[]{2,3,46,40},1,0x322b26,0x28221e,0,true,2);
  Compare(original,candidate,fn,"saturated channels",new[]{1,2,32,33},1,0x0000ff,0xff0000,0,false,4);
  Compare(original,candidate,fn,"1x1",new[]{4,5,5,6},1,0x322b26,0x28221e,0,false,0);
  Compare(original,candidate,fn,"1px wide",new[]{4,5,5,40},1,0x322b26,0x28221e,0,false,2);
  Compare(original,candidate,fn,"zero height",new[]{4,5,25,5},1,0x322b26,0x28221e,0,false,0);
  Compare(original,candidate,fn,"horizontal fallback",new[]{2,3,40,30},0,0x322b26,0x28221e,0,false,0);
  Compare(original,candidate,fn,"ROP2 fallback",new[]{2,3,40,30},1,0x322b26,0x28221e,1,false,0);
  Compare(original,candidate,fn,"map-mode fallback",new[]{2,3,40,30},1,0x322b26,0x28221e,2,false,0);
  Compare(original,candidate,fn,"graphics-mode fallback",new[]{2,3,40,30},1,0x322b26,0x28221e,3,false,0);
  Compare(original,candidate,fn,"RTL fallback",new[]{2,3,40,30},1,0x322b26,0x28221e,4,false,0);
  Compare(original,candidate,fn,"zero-width fallback",new[]{4,5,4,30},1,0x322b26,0x28221e,0,false,0);
  int gradSlot=0;foreach(var x in (System.Collections.IEnumerable)meta["hooks"]){var h=(Dictionary<string,object>)x;if((string)h["name"]=="GradientFill")gradSlot=section+slots+Num(h["slot"])*4;}
  int saved=candidate.R(gradSlot);candidate.W(gradSlot,Stub(new byte[]{0x31,0xc0,0xc2,24,0}).ToInt32());
  Compare(original,candidate,fn,"GradientFill failure fallback",new[]{2,3,40,30},1,0x322b26,0x28221e,0,false,0);candidate.W(gradSlot,saved);
  int ropSlot=Num(dynamic["GetROP2"]);saved=candidate.R(ropSlot);candidate.W(ropSlot,0);
  Compare(original,candidate,fn,"missing resolver fallback",new[]{2,3,40,30},1,0x322b26,0x28221e,0,false,0);candidate.W(ropSlot,saved);
  int cap=candidate.iats["GetDeviceCaps"];saved=candidate.R(cap);candidate.W(cap,Stub(new byte[]{0xb8,2,0,0,0,0xc2,8,0}).ToInt32());
  Compare(original,candidate,fn,"non-display capability fallback",new[]{2,3,40,30},1,0x322b26,0x28221e,0,false,0);candidate.W(cap,saved);
  foreach(var x in (System.Collections.IEnumerable)meta["hooks"]){var h=(Dictionary<string,object>)x;if((string)h["name"]=="GetSysColor")candidate.W(Num(h["iat"]),candidate.A(section+Num(h["start"])).ToInt32());}
  using(var s=new Surface()){Run(candidate,fn,s,new[]{3,4,30,35},1,0x8000000f,0x8000000f);int[] pixels=s.Pixels();Check((pixels[4*64+3]&0xffffff)==0x262b32,"system TColor to dark panel");Check((pixels[2*64+3]&0xffffff)==0xc3b2a1,"system TColor outside bounds");Console.WriteLine("PASS system TColor resolution");}
  Bench(original,0x4b62d4,"original scanline");Bench(candidate,fn,"candidate native");
  Marshal.WriteIntPtr(candidate.A(candidate.iats["GetSysColor"]),GetProcAddress(LoadLibrary("user32.dll"),"GetSysColor"));
  Marshal.WriteByte(candidate.A(Num(meta["originalEntryRVA"])),0xc3);
  ((Entry)Marshal.GetDelegateForFunctionPointer(candidate.A(section+Num(meta["entry"])),typeof(Entry)))();
  foreach(var item in dynamic)Check(Marshal.ReadIntPtr(candidate.A(Num(item.Value)))==GetProcAddress(LoadLibrary("gdi32.dll"),item.Key),"startup dynamic cache "+item.Key);
  Console.WriteLine("PASS startup dynamic API cache; original entry replaced with RET in test memory");
  Console.WriteLine("PASS "+checks+" isolated checks; no application initialization executed.");
 }
}
