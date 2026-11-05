using System;using System.IO;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Web.Script.Serialization;
class InitialEraseCheck {
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
 static void Main(string[] args){var orig=new PE(args[0]);var cand=new PE(args[1]);var meta=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(args[2]));var native=(Dictionary<string,object>)meta[meta.ContainsKey("nativeInitialErase")?"nativeInitialErase":"nativeErase"];var dyn=(Dictionary<string,object>)native["dynamicSlots"];
  if(meta.ContainsKey("entry")){Marshal.WriteByte(cand.A(Num(meta["originalEntryRVA"])),0xc3);((Entry)Marshal.GetDelegateForFunctionPointer(cand.A(Num(meta["sectionRVA"])+Num(meta["entry"])),typeof(Entry)))();foreach(var kv in dyn)Check(Marshal.ReadIntPtr(cand.A(Num(kv.Value)))==GetProcAddress(LoadLibrary("gdi32.dll"),kv.Key),"startup resolver "+kv.Key);Console.WriteLine("PASS actual startup dynamic erase cache; application entry replaced by RET");}
  else foreach(var kv in dyn)Marshal.WriteIntPtr(cand.A(Num(kv.Value)),GetProcAddress(LoadLibrary("gdi32.dll"),kv.Key));
  int brushRva;if(meta.ContainsKey("brushRva"))brushRva=Num(meta["brushRva"]);else{var hooks=(System.Collections.ICollection)meta["hooks"];brushRva=Num(meta["sectionRVA"])+Num(meta["slots"])+hooks.Count*4+5*4;}var brush=CreateSolidBrush(0x202020);cand.W(brushRva,brush.ToInt32());call=MakeInvoke();self=Marshal.AllocHGlobal(0x500);for(int i=0;i<0x500;i++)Marshal.WriteByte(self,i,0);layoutList=Marshal.AllocHGlobal(12);for(int i=0;i<12;i++)Marshal.WriteByte(layoutList,i,0);Marshal.WriteInt32(layoutList,8,1);Marshal.WriteIntPtr(self,0x35c,layoutList);msg=Marshal.AllocHGlobal(16);regs=Marshal.AllocHGlobal(12);
  foreach(var obj in (System.Collections.IEnumerable)native["sites"]){var site=(Dictionary<string,object>)obj;foreach(var cls in (System.Collections.IEnumerable)site["vmtRvas"]){int vmt=Num(cls);for(int clip=0;clip<4;clip++)for(int mode=0;mode<6;mode++)Case(orig,cand,site,vmt,clip,mode,mode==0||mode==5,0x14);Case(orig,cand,site,vmt+4,0,0,false,0x14);Case(orig,cand,site,vmt,0,0,false,0x15);
    Run(cand,Num(site["entryRva"]),vmt,IntPtr.Zero,0x14);
    var mono=CreateCompatibleDC(IntPtr.Zero);var bitmap=CreateBitmap(64,64,1,1,IntPtr.Zero);var old=SelectObject(mono,bitmap);PatBlt(mono,0,0,64,64,0x00ff0062);Run(cand,Num(site["entryRva"]),vmt,mono,0x14);Check(GetPixel(mono,10,10)==0xffffff,"monochrome mask changed");SelectObject(mono,old);DeleteObject(bitmap);DeleteDC(mono);
    int cap=cand.iats["GetDeviceCaps"],saved=cand.R(cap);cand.W(cap,Stub(new byte[]{0xb8,2,0,0,0,0xc2,8,0}).ToInt32());Case(orig,cand,site,vmt,0,0,false,0x14);cand.W(cap,saved);
    int ds=Num(dyn["GetLayout"]);saved=cand.R(ds);cand.W(ds,0);Case(orig,cand,site,vmt,0,0,false,0x14);cand.W(ds,saved);
    int cb=cand.iats["GetClipBox"];saved=cand.R(cb);cand.W(cb,Stub(new byte[]{0x31,0xc0,0xc2,8,0}).ToInt32());Case(orig,cand,site,vmt,0,0,false,0x14);cand.W(cb,saved);
   }
   if((string)site["name"]=="settingsButtons"){
    foreach(var p in new[]{orig,cand}){Marshal.Copy(new byte[]{0x31,0xc0,0xc3},0,p.A(0x29d5cc),3);byte[] inherited={0xc7,0x42,12,1,0,0,0,0xb8,0x51,0x51,0x51,0x51,0xc3};Marshal.Copy(inherited,0,p.A(0xd30934),inherited.Length);}
    foreach(var cls in (System.Collections.IEnumerable)site["vmtRvas"])for(int clip=0;clip<4;clip++){Case(orig,cand,site,Num(cls),clip,0,true,0x14);Case(orig,cand,site,Num(cls)+4,clip,0,false,0x14);}
    Console.WriteLine("PASS disabled-theme original branch (inherited erase body stubbed only in test memory)");
   }
   if((string)site["name"]=="customPanels"){
    // Main cases above use the full actual border-only branch with BorderWidth=0.
    // Also preserve its inherited-erase branch with only that dependency mocked.
    foreach(var p in new[]{orig,cand}){byte[] inherited={0xc7,0x42,12,1,0,0,0,0xb8,0x51,0x51,0x51,0x51,0xc3};Marshal.Copy(inherited,0,p.A(0xd30934),inherited.Length);}
    Marshal.WriteByte(self,0x230,1);
    foreach(var cls in (System.Collections.IEnumerable)site["vmtRvas"])for(int clip=0;clip<4;clip++){Case(orig,cand,site,Num(cls),clip,0,true,0x14);Case(orig,cand,site,Num(cls)+4,clip,0,false,0x14);}
    Marshal.WriteByte(self,0x230,0);
    Console.WriteLine("PASS TXPanel real border-only erase and inherited-erase forwarding (dependency stubbed only in test memory)");
   }
   if((string)site["name"]=="optionForm"){
    // Main cases exercise the real populated-list branch. Cover empty-list
    // fallback and composition branches without initializing the Foxmail UI.
    foreach(var p in new[]{orig,cand}){byte[] inherited={0xc7,0x42,12,1,0,0,0,0xb8,0x61,0x61,0x61,0x61,0xc3};Marshal.Copy(inherited,0,p.A(0xd1be54),inherited.Length);Marshal.Copy(new byte[]{0x31,0xc0,0xc3},0,p.A(0x61b544),3);}
    Marshal.WriteInt32(layoutList,8,0);
    foreach(var cls in (System.Collections.IEnumerable)site["vmtRvas"])for(int clip=0;clip<4;clip++){Case(orig,cand,site,Num(cls),clip,0,true,0x14);Case(orig,cand,site,Num(cls)+4,clip,0,false,0x14);}
    Marshal.WriteInt32(layoutList,8,1);
    foreach(var p in new[]{orig,cand}){Marshal.Copy(new byte[]{0xb8,1,0,0,0,0xc3},0,p.A(0x61b598),6);Marshal.WriteByte(p.A(0x61b080),0xc3);}
    foreach(var cls in (System.Collections.IEnumerable)site["vmtRvas"])for(int clip=0;clip<4;clip++){Case(orig,cand,site,Num(cls),clip,0,true,0x14);Case(orig,cand,site,Num(cls)+4,clip,0,false,0x14);}
    Console.WriteLine("PASS TOptionForm real list/empty-list/composition branch flow (external draw dependencies stubbed only in test memory)");
   }
   Console.WriteLine("PASS "+site["name"]+" actual patched entry, trampoline, exact classes, clip coverage and forwarding");}
  DeleteObject(brush);Marshal.FreeHGlobal(self);Marshal.FreeHGlobal(layoutList);Marshal.FreeHGlobal(msg);Marshal.FreeHGlobal(regs);Console.WriteLine("PASS "+checks+" isolated erase checks. External UI dependencies stubbed only in test memory; no application initialization.");
 }
}
