using System;using System.IO;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Web.Script.Serialization;
class NativePaintDiagnosticCheck {
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
 static Invoke MakeNativeCall(){var c=new List<byte>();Action<byte[]> e=a=>c.AddRange(a);Action<int>d=v=>e(BitConverter.GetBytes(v));
  // Isolated painter-shaped frame; fn,self,HDC,output passed via stdcall.
  e(new byte[]{0x55,0x8b,0xec,0x83,0xec,16,0x53,0x56,0x57,0x8b,0x45,12,0x89,0x45,0xfc,0x8b,0x55,16,0x89,0x55,0xf8});
  e(new byte[]{0xbb});d(0x12345678);e(new byte[]{0xbe});d(0x23456789);e(new byte[]{0xbf});d(0x3456789a);
  e(new byte[]{0x64,0xc7,5,0x34,0,0,0});d(0x5b35);
  for(int n=0;n>0;n--){e(new byte[]{0x68});d(0x700+n);}
  e(new byte[]{0x8b,0x45,12});e(new byte[]{0xb9});d(0x33333333);e(new byte[]{0xf9,0xff,0x55,8,0x9c,0x50,0x8b,0x45,20,0x89,0x50,4,0x89,0x48,8,0x5a,0x89,0x10,0x5a,0x89,0x50,16,0xfc,0x64,0x8b,0x15,0x34,0,0,0,0x89,0x50,12,0x31,0xc0});
  foreach(var pair in new[]{new int[]{0xfb,0x12345678,1},new int[]{0xfe,0x23456789,2},new int[]{0xff,0x3456789a,4}}){e(new byte[]{0x81,(byte)pair[0]});d(pair[1]);e(new byte[]{0x74,3,0x83,0xc8,(byte)pair[2]});}
  e(new byte[]{0x8d,0x4d,0xe4,0x3b,0xe1,0x74,3,0x83,0xc8,8,0x8d,0x65,0xe4,0x5f,0x5e,0x5b,0xc9,0xc2,16,0});return (Invoke)Marshal.GetDelegateForFunctionPointer(Stub(c.ToArray()),typeof(Invoke));
 }
 static byte[] Mock(IntPtr counter,IntPtr failure,int argc){var c=new List<byte>();Action<byte[]>e=a=>c.AddRange(a);Action<int>d=v=>e(BitConverter.GetBytes(v));e(new byte[]{0xff,5});d(counter.ToInt32());
  e(new byte[]{0x64,0x81,0x3d,0x34,0,0,0});d(0x5b35);e(new byte[]{0x74,10,0xc7,5});d(failure.ToInt32());d(1);
  for(int n=1;n<=argc;n++){e(new byte[]{0x81,0x7c,0x24,(byte)(n*4)});d(0x700+n);e(new byte[]{0x74,10,0xc7,5});d(failure.ToInt32());d(1);}
  e(new byte[]{0xb8});d(0x11112222);e(new byte[]{0xb9});d(0x33334444);e(new byte[]{0xba});d(0x55556666);e(new byte[]{0x64,0xc7,5,0x34,0,0,0});d(0x5b36);e(new byte[]{0x68,0x47,6,0,0,0x9d,0xc2,(byte)(argc*4),0});return c.ToArray();
 }
 [DllImport("gdi32")]static extern uint SetBkColor(IntPtr dc,uint c);
 static void Main(string[] args){try{Run(args);}catch(Exception ex){Console.Error.WriteLine(ex);Environment.ExitCode=1;}}
 static void Run(string[] args){var p=new PE(args[0]);var all=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(args[1]));var meta=(Dictionary<string,object>)all["nativePaintPhase"];var diag=(Dictionary<string,object>)meta["diagnostics"];int h=Num(diag["headerRva"]),ring=Num(diag["ringRva"]);
  int init;if(all.ContainsKey("initRva"))init=Num(all["initRva"]);else{Marshal.WriteByte(p.A(Num(all["originalEntryRVA"])),0xc3);init=Num(all["sectionRVA"])+Num(all["entry"]);}
  ((Entry)Marshal.GetDelegateForFunctionPointer(p.A(init),typeof(Entry)))();var sites=(System.Collections.IList)meta["sites"];var native=(Dictionary<string,object>)sites[9];
  var invoke=MakeNativeCall();var self=Marshal.AllocHGlobal(4);var msg=Marshal.AllocHGlobal(16);var output=Marshal.AllocHGlobal(20);var counter=Marshal.AllocHGlobal(4);var fail=Marshal.AllocHGlobal(4);Marshal.WriteInt32(counter,0);Marshal.WriteInt32(fail,0);
  // Only a test-memory default handler paints. No Foxmail initialization.
  var body=new List<byte>();Action<byte[]>e=a=>body.AddRange(a);Action<int>d=v=>e(BitConverter.GetBytes(v));
  e(new byte[]{0x64,0x81,0x3d,0x34,0,0,0});d(0x5b35);e(new byte[]{0x74,10,0xc7,5});d(fail.ToInt32());d(1);
  e(new byte[]{0x53,0x8b,0x5a,4,0x68});d(0xffffff);e(new byte[]{0x53,0xb8});d(GetProcAddress(LoadLibrary("gdi32.dll"),"SetBkColor").ToInt32());e(new byte[]{0xff,0xd0,0x68});d(0xff0062);e(new byte[]{0x6a,64,0x6a,64,0x6a,0,0x6a,0,0x53,0xb8});d(GetProcAddress(LoadLibrary("gdi32.dll"),"PatBlt").ToInt32());e(new byte[]{0xff,0xd0,0x5b});
  // Reset test expected incoming error before shared mock accounting.
  e(new byte[]{0x64,0xc7,5,0x34,0,0,0});d(0x5b35);body.AddRange(Mock(counter,fail,0));var handler=Stub(body.ToArray());
  foreach(int vmt in new[]{0x692008,0x690898,0x69200c}){p.W(vmt-16,handler.ToInt32());Marshal.WriteIntPtr(self,p.A(vmt));using(var surface=new Surface(0)){
   SetBkColor(surface.dc,0x202020);for(int n=0;n<4096;n++)Marshal.WriteInt32(surface.bits,n*4,0x202020);int seq=p.R(h+16),old=Marshal.ReadInt32(counter);Check(invoke(p.A(Num(native["originalRva"])),self,surface.dc,output)==0,"native stack and nonvolatile ABI");
   Check(Marshal.ReadInt32(counter)==old+1&&Marshal.ReadInt32(fail)==0,"native original handler once");Check(Marshal.ReadInt32(output)==0x11112222&&Marshal.ReadInt32(output,4)==0x55556666&&Marshal.ReadInt32(output,8)==0x33334444,"native volatile return");Check((Marshal.ReadInt32(output,16)&0xcd5)==0x445&&Marshal.ReadInt32(output,12)==0x5b36,"native flags and LastError");
   bool match=vmt!=0x69200c;Check(p.R(h+16)==seq+(match?2:0),"native exact class guard");
   if(match){int before=ring+(seq&255)*128,after=ring+((seq+1)&255)*128;Check(p.R(before+4)==9&&p.R(after+4)==10,"native phases");Check(p.R(before+12)==self.ToInt32()&&p.R(after+16)==surface.dc.ToInt32(),"same Self/HDC");Check(p.R(before+88)==15&&p.R(before+92)==0&&p.R(before+96)==2,"native numeric origin");Check(p.R(before+32)==0x202020&&p.R(after+32)==0xffffff,"captures native BkColor change");for(int corner=0;corner<4;corner++)Check(p.R(before+60+corner*4)==0x202020&&p.R(after+60+corner*4)==0xffffff,"captures first white corner "+corner);}
   Check(GetPixel(surface.dc,0,0)==0xffffff&&GetBkColor(surface.dc)==0xffffff,"real original mock paint occurred");
  }}
  // Screen and monochrome input get numeric records without GetPixel.
  var plain=Stub(Mock(counter,fail,0));p.W(0x692008-16,plain.ToInt32());Marshal.WriteIntPtr(self,p.A(0x692008));var dyn=(Dictionary<string,object>)meta["dynamicSlots"];int slot=Num(dyn["GetPixel"]),saved=p.R(slot);var pc=Marshal.AllocHGlobal(4);Marshal.WriteInt32(pc,0);var trap=new List<byte>{0xff,5};trap.AddRange(BitConverter.GetBytes(pc.ToInt32()));trap.AddRange(new byte[]{0x83,0xc8,0xff,0xc2,12,0});p.W(slot,Stub(trap.ToArray()).ToInt32());var screen=GetDC(IntPtr.Zero);var mono=CreateCompatibleDC(IntPtr.Zero);var mb=CreateBitmap(64,64,1,1,IntPtr.Zero);var mo=SelectObject(mono,mb);
  foreach(var dc in new[]{screen,mono,IntPtr.Zero,new IntPtr(0x1234)}){int sq=p.R(h+16);Check(invoke(p.A(Num(native["originalRva"])),self,dc,output)==0,"native skipped DC ABI");Check(p.R(h+16)==sq+2,"native skipped DC records");for(int n=0;n<2;n++)Check(p.R(ring+((sq+n)&255)*128+60)==-1,"native skipped DC no samples");}Check(Marshal.ReadInt32(pc)==0,"native no screen/mono/null/invalid GetPixel");p.W(slot,saved);ReleaseDC(IntPtr.Zero,screen);SelectObject(mono,mo);DeleteObject(mb);DeleteDC(mono);
  // Both entry prologues execute their displaced six bytes, then a test-only
  // continuation mutates Message.result. The installed EXE is never executed.
  foreach(int siteId in new[]{8,11}){var site=(Dictionary<string,object>)sites[siteId];int rva=Num(site["originalRva"]);var continuation=new List<byte>{0xc7,0x42,12};continuation.AddRange(BitConverter.GetBytes(0x7abc));var tail=Mock(counter,fail,0);continuation.AddRange(tail); // replace mock ret with LEAVE/RET after its flag restore
   continuation.RemoveRange(continuation.Count-3,3);continuation.AddRange(new byte[]{0xc9,0xc3});Marshal.Copy(continuation.ToArray(),0,p.A(rva+6),continuation.Count);
   int[] vmts=siteId==8?new[]{0x692008,0x690898,0x69200c}:new[]{0x56fa20,0x56d1fc,0x56fa24};foreach(int vmt in vmts){Marshal.WriteIntPtr(self,p.A(vmt));Marshal.Copy(new int[]{0x318,0,0x35,0x321},0,msg,4);int sq=p.R(h+16),old=Marshal.ReadInt32(counter);Check(invoke(p.A(rva),self,msg,output)==0,"entry ABI");Check(Marshal.ReadInt32(counter)==old+1&&Marshal.ReadInt32(msg,12)==0x7abc,"entry original continuation once");Check(Marshal.ReadInt32(output,12)==0x5b36&&(Marshal.ReadInt32(output,16)&0xcd5)==0x445,"entry flags and LastError");bool match=vmt==vmts[0]||vmt==vmts[1];Check(p.R(h+16)==sq+(match?1:0),"entry exact class filter");if(match){int ev=ring+(sq&255)*128;Check(p.R(ev+4)==siteId&&p.R(ev+88)==0x318&&p.R(ev+92)==0x35&&p.R(ev+100)==0x321,"entry numeric message metadata");Check(p.R(ev+96)==(siteId==8?1:3),"entry origin");}}
  }
  Console.WriteLine("PASS "+checks+" native/print checks; real DIB dark->white boundary captured; exact classes, original continuations, ABI/flags/LastError preserved");
 }
}
