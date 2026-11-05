using System;using System.IO;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Web.Script.Serialization;
class EarlyPaintDiagnosticCheck {
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
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern IntPtr CreateWindowEx(uint ex,string cls,string title,uint style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr inst,IntPtr param);
 [DllImport("user32.dll")]static extern bool DestroyWindow(IntPtr h);
 [DllImport("user32.dll")]static extern bool InvalidateRect(IntPtr h,IntPtr r,bool erase);
 [DllImport("user32.dll")]static extern IntPtr BeginPaint(IntPtr h,IntPtr ps);
 [DllImport("user32.dll")]static extern bool EndPaint(IntPtr h,IntPtr ps);
 static IntPtr PixelSpy(IntPtr count,IntPtr target){var c=new List<byte>{0x9c,0xff,5};c.AddRange(BitConverter.GetBytes(count.ToInt32()));c.AddRange(new byte[]{0x9d,0xff,0x25});var p=Stub(new byte[32]);c.AddRange(BitConverter.GetBytes(IntPtr.Add(p,24).ToInt32()));Marshal.Copy(c.ToArray(),0,p,c.Count);Marshal.WriteIntPtr(p,24,target);return p;}
 static void Main(string[] args){try{Run(args);}catch(Exception ex){Console.Error.WriteLine(ex);Environment.ExitCode=1;}}
 static void Run(string[] args){var p=new PE(args[0]);var all=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(args[1]));var meta=(Dictionary<string,object>)all["nativePaintPhase"];var diag=(Dictionary<string,object>)meta["diagnostics"];int h=Num(diag["headerRva"]),ring=Num(diag["ringRva"]);
  // Integrated artifacts initialize only the appended diagnostic/theme entry.
  // Replace the original application entry with RET solely in mapped test memory.
  int init;if(all.ContainsKey("initRva"))init=Num(all["initRva"]);else{Marshal.WriteByte(p.A(Num(all["originalEntryRVA"])),0xc3);init=Num(all["sectionRVA"])+Num(all["entry"]);}
  ((Entry)Marshal.GetDelegateForFunctionPointer(p.A(init),typeof(Entry)))();var sites=(System.Collections.IList)meta["sites"];var early=(Dictionary<string,object>)sites[12];var dyn=(Dictionary<string,object>)meta["dynamicSlots"];int typeSlot=Num(dyn["GetObjectType"]),pixelSlot=Num(dyn["GetPixel"]),realType=p.R(typeSlot),realPixel=p.R(pixelSlot);
  var self=Marshal.AllocHGlobal(4);var output=Marshal.AllocHGlobal(20);var count=Marshal.AllocHGlobal(4);var fail=Marshal.AllocHGlobal(4);var queries=Marshal.AllocHGlobal(4);Marshal.WriteInt32(count,0);Marshal.WriteInt32(fail,0);p.W(pixelSlot,PixelSpy(queries,new IntPtr(realPixel)).ToInt32());
  using(var s=new Surface(0)){
   // Final-memory positive case: corners dark except one bright-only corner;
   // interior strip crosses three fixed sample points, without any text.
   foreach(int id in new[]{2,5}){var site=(Dictionary<string,object>)sites[id];Marshal.WriteIntPtr(self,p.A(Num(site["vmtRva"])));for(int n=0;n<4096;n++)Marshal.WriteInt32(s.bits,n*4,0x202020);Marshal.WriteInt32(s.bits,0,0xe6e6e6);for(int x=0;x<64;x++)Marshal.WriteInt32(s.bits,(32*64+x)*4,0xfafafa);Marshal.Copy(Mock(count,fail,9),0,p.A(Num(site["originalTargetRva"])),Mock(count,fail,9).Length);Marshal.WriteInt32(queries,0);int seq=p.R(h+16);string state=State(s.dc);int[] pixels=s.Pixels();Check(MakeCall(9)(p.A(Num(site["entryRva"])),self,s.dc,output)==0,"final memory ABI");int ev=ring+(seq&255)*128;Check(p.R(ev+104)==9&&p.R(ev+108)==4&&p.R(ev+112)==3,"interior catches white strip with mostly dark corners");Check(p.R(ev+116)==2&&p.R(ev+120)>=2&&p.R(ev+124)==0,"memory aggregate metadata");Check(Marshal.ReadInt32(queries)==9,"memory max9 pixel calls");Check(State(s.dc)==state&&string.Join(",",pixels)==string.Join(",",s.Pixels()),"memory sampler leaves DC and pixels unchanged");}
   // Test-only type getter exercises the display-specific algorithm against a
   // real color DIB with known clip and pixel values; it is never installed.
   p.W(typeSlot,Stub(new byte[]{0xb8,3,0,0,0,0xc2,4,0}).ToInt32());
   for(int mode=0;mode<6;mode++){for(int n=0;n<4096;n++)Marshal.WriteInt32(s.bits,n*4,0x202020);Marshal.WriteInt32(s.bits,(32*64+32)*4,0xffffff);Marshal.WriteIntPtr(self,p.A(0x692008+(mode==1?4:0)));IntPtr returned=mode==2?IntPtr.Zero:mode==3?new IntPtr(0x1234):s.dc;if(mode==3)p.W(typeSlot,realType);if(mode==4)SetMapMode(s.dc,8);if(mode==5)MoveOrigin(s.dc,1,2);
    var mock=Mock(count,fail,2); // retain exactly-once and two-argument checks
    // Change only EAX final value in this test stub, retaining ECX/EDX/flags.
    for(int i=0;i<mock.Length-5;i++)if(mock[i]==0xb8&&BitConverter.ToInt32(mock,i+1)==0x11112222){Array.Copy(BitConverter.GetBytes(returned.ToInt32()),0,mock,i+1,4);break;}
    Marshal.Copy(mock,0,p.A(0x8870),mock.Length);Marshal.WriteInt32(queries,0);int seq=p.R(h+16),old=Marshal.ReadInt32(count);string state=State(s.dc);int[] pixels=s.Pixels();Check(MakeCall(2)(p.A(Num(early["entryRva"])),self,s.dc,output)==0,"BeginPaint stdcall stack/nonvolatile ABI");Check(Marshal.ReadInt32(count)==old+1&&Marshal.ReadInt32(fail)==0,"original once, both stdcall arguments intact");Check(Marshal.ReadInt32(output)==returned.ToInt32()&&Marshal.ReadInt32(output,4)==0x55556666&&Marshal.ReadInt32(output,8)==0x33334444,"BeginPaint full result registers");Check(Marshal.ReadInt32(output,12)==0x5b36&&(Marshal.ReadInt32(output,16)&0xcd5)==0x445,"BeginPaint flags and LastError");
    Check(p.R(h+16)==seq+(mode==1?0:1),"BeginPaint exact class guard");if(mode==0){int ev=ring+(seq&255)*128;Check(p.R(ev+4)==12&&p.R(ev+104)==9&&p.R(ev+108)==1&&p.R(ev+112)==1&&p.R(ev+116)==1&&p.R(ev+124)==0,"BeginPaint3x3 aggregate known colors");Check(Marshal.ReadInt32(queries)==9,"BeginPaint max9 queries");}else Check(Marshal.ReadInt32(queries)==0,"BeginPaint skip zero pixel calls");Check(State(s.dc)==state&&string.Join(",",pixels)==string.Join(",",s.Pixels()),"BeginPaint probe read-only");if(mode==4)SetMapMode(s.dc,1);if(mode==5)MoveOrigin(s.dc,0,0);p.W(typeSlot,Stub(new byte[]{0xb8,3,0,0,0,0xc2,4,0}).ToInt32());
   }
  }
  // A complex clip has holes inside its bounding box. PtVisible excludes
  // seven screen-grid candidates; the memory grid also rejects its holes.
  using(var complex=new Surface(2)){for(int n=0;n<4096;n++)Marshal.WriteInt32(complex.bits,n*4,0x202020);Marshal.WriteIntPtr(self,p.A(0x692008));var cm=Mock(count,fail,2);for(int i=0;i<cm.Length-5;i++)if(cm[i]==0xb8&&BitConverter.ToInt32(cm,i+1)==0x11112222){Array.Copy(BitConverter.GetBytes(complex.dc.ToInt32()),0,cm,i+1,4);break;}Marshal.Copy(cm,0,p.A(0x8870),cm.Length);p.W(typeSlot,Stub(new byte[]{0xb8,3,0,0,0,0xc2,4,0}).ToInt32());int seq=p.R(h+16);Marshal.WriteInt32(queries,0);Check(MakeCall(2)(p.A(Num(early["entryRva"])),self,complex.dc,output)==0,"complex early ABI");int ev=ring+(seq&255)*128;Check(p.R(ev+104)==2&&p.R(ev+120)==3&&Marshal.ReadInt32(queries)==2,"complex screen clip holes excluded");p.W(typeSlot,realType);var finalSite=(Dictionary<string,object>)sites[2];seq=p.R(h+16);Marshal.WriteInt32(queries,0);Check(MakeCall(9)(p.A(Num(finalSite["entryRva"])),self,complex.dc,output)==0,"complex memory ABI");ev=ring+(seq&255)*128;Check(p.R(ev+104)==2&&p.R(ev+120)==3&&Marshal.ReadInt32(queries)==6,"complex memory candidate holes excluded; legacy4corners unchanged");}
  // Separate frames and DCs across threads, no global current-control/HDC.
  p.W(typeSlot,realType);int beforeThreads=p.R(h+16),bad=0;var workers=new List<System.Threading.Thread>();foreach(int id in new[]{2,5}){int localId=id;var t=new System.Threading.Thread(()=>{var st=(Dictionary<string,object>)sites[localId];using(var sf=new Surface(0)){var obj=Marshal.AllocHGlobal(4);var result=Marshal.AllocHGlobal(20);Marshal.WriteIntPtr(obj,p.A(Num(st["vmtRva"])));var call=MakeCall(9);for(int n=0;n<100;n++)if(call(p.A(Num(st["entryRva"])),obj,sf.dc,result)!=0||Marshal.ReadInt32(result,12)!=0x5b36)System.Threading.Interlocked.Increment(ref bad);Marshal.FreeHGlobal(obj);Marshal.FreeHGlobal(result);}});workers.Add(t);t.Start();}foreach(var t in workers)t.Join();Check(bad==0&&p.R(h+16)==beforeThreads+200,"concurrent independent frames/DCs and atomic ring sequence");
  // Real hidden-window BeginPaint lifecycle: valid display DC; no visible UI,
  // and typically an empty visible clip. No acquisition of unrelated windows.
  p.W(typeSlot,realType);var hwnd=CreateWindowEx(0,"STATIC","",0,0,0,64,64,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);Check(hwnd!=IntPtr.Zero,"hidden test window");var ps=Marshal.AllocHGlobal(64);InvalidateRect(hwnd,IntPtr.Zero,true);var dcReal=BeginPaint(hwnd,ps);Check(dcReal!=IntPtr.Zero,"real BeginPaint returns valid DC");var realMock=Mock(count,fail,2);for(int i=0;i<realMock.Length-5;i++)if(realMock[i]==0xb8&&BitConverter.ToInt32(realMock,i+1)==0x11112222){Array.Copy(BitConverter.GetBytes(dcReal.ToInt32()),0,realMock,i+1,4);break;}Marshal.Copy(realMock,0,p.A(0x8870),realMock.Length);Marshal.WriteIntPtr(self,p.A(0x690898));Marshal.WriteInt32(queries,0);int sq=p.R(h+16);string before=State(dcReal);Check(MakeCall(2)(p.A(Num(early["entryRva"])),self,dcReal,output)==0,"real BeginPaint-HDC probe ABI");int eventAt=ring+(sq&255)*128;Check(p.R(eventAt+20)==3&&p.R(eventAt+24)>8,"real screen DC display classification");Check(Marshal.ReadInt32(queries)<=9&&State(dcReal)==before,"real DC clip bounded and unchanged");int qBefore=Marshal.ReadInt32(queries);EndPaint(hwnd,ps);Check(Marshal.ReadInt32(queries)==qBefore,"no GetPixel after EndPaint");DestroyWindow(hwnd);Marshal.FreeHGlobal(ps);
  Console.WriteLine("PASS "+checks+" early/memory aggregate checks: <=9 queries, stdcall ABI, original args/results/flags/LastError, guards, known DIB strip and real hidden BeginPaint lifecycle");
 }
 [DllImport("gdi32")]static extern bool SetWindowOrgEx(IntPtr dc,int x,int y,IntPtr old);
 static void MoveOrigin(IntPtr dc,int x,int y){SetWindowOrgEx(dc,x,y,IntPtr.Zero);}
}
