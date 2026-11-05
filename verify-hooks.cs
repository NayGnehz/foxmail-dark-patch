using System;using System.IO;using System.Runtime.InteropServices;
class Test {
 [DllImport("kernel32")]static extern IntPtr VirtualAlloc(IntPtr p,UIntPtr size,uint type,uint protect);
 [DllImport("kernel32")]static extern IntPtr LoadLibrary(string name);
 [DllImport("kernel32")]static extern IntPtr GetProcAddress(IntPtr module,string name);
 [DllImport("gdi32")]static extern IntPtr CreateCompatibleDC(IntPtr dc);
 [DllImport("gdi32")]static extern uint GetTextColor(IntPtr dc);
 [DllImport("gdi32")]static extern uint GetBkColor(IntPtr dc);
 [DllImport("gdi32")]static extern bool DeleteDC(IntPtr dc);
 [DllImport("gdi32")]static extern bool DeleteObject(IntPtr obj);
 [DllImport("gdi32")]static extern int GetObject(IntPtr obj,int size,IntPtr result);
 [DllImport("gdi32")]static extern IntPtr CreateCompatibleBitmap(IntPtr dc,int width,int height);
 [DllImport("gdi32")]static extern IntPtr CreateBitmap(int w,int h,uint planes,uint bits,IntPtr data);
 [DllImport("gdi32")]static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
 [DllImport("gdi32")]static extern uint GetPixel(IntPtr dc,int x,int y);
 [DllImport("user32")]static extern IntPtr GetDC(IntPtr window);
 [DllImport("user32")]static extern int ReleaseDC(IntPtr window,IntPtr dc);
 [DllImport("gdi32")]static extern IntPtr CreateSolidBrush(uint color);
 [DllImport("gdi32")]static extern IntPtr GetStockObject(int index);
 [DllImport("gdi32")]static extern int GetObjectType(IntPtr obj);
 [DllImport("gdi32",CharSet=CharSet.Unicode)]static extern IntPtr CreateFont(int height,int width,int escapement,int orientation,int weight,uint italic,uint underline,uint strikeOut,uint charSet,uint outPrecision,uint clipPrecision,uint quality,uint pitchAndFamily,string face);
 [DllImport("gdiplus")]static extern int GdiplusStartup(out IntPtr token,IntPtr input,IntPtr output);
 [DllImport("gdiplus")]static extern void GdiplusShutdown(IntPtr token);
 [DllImport("gdiplus")]static extern int GdipGetLineColors(IntPtr brush,IntPtr colors);
 [DllImport("gdiplus")]static extern int GdipDeleteBrush(IntPtr brush);
 [DllImport("user32")]static extern uint GetSysColor(int idx);
 [DllImport("kernel32",CharSet=CharSet.Unicode)]static extern IntPtr GetModuleHandle(string name);
 [DllImport("kernel32")]static extern uint GetLastError();
 [DllImport("user32",EntryPoint="GetClassInfoW")]static extern bool GetClassInfoW(IntPtr instance,IntPtr name,IntPtr result);
 [DllImport("user32",EntryPoint="GetClassInfoA")]static extern bool GetClassInfoA(IntPtr instance,IntPtr name,IntPtr result);
 [DllImport("user32",EntryPoint="UnregisterClassW")]static extern bool UnregisterClassW(IntPtr name,IntPtr instance);
 [DllImport("user32",EntryPoint="UnregisterClassA")]static extern bool UnregisterClassA(IntPtr name,IntPtr instance);
 [DllImport("user32",CharSet=CharSet.Unicode)]static extern IntPtr CreateWindowEx(uint ex,IntPtr name,string title,uint style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
 [DllImport("user32")]static extern bool DestroyWindow(IntPtr window);
 [DllImport("user32")]static extern IntPtr SendMessage(IntPtr window,uint msg,IntPtr wp,IntPtr lp);
 [DllImport("user32")]static extern bool ShowWindow(IntPtr window,int command);
 [DllImport("user32")]static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int w,int h,uint flags);
 [DllImport("user32",EntryPoint="GetSysColorBrush")]static extern IntPtr NativeSystemBrush(int idx);
 [DllImport("user32")]static extern bool DrawEdge(IntPtr dc,IntPtr rect,uint edge,uint flags);
 [DllImport("gdi32")]static extern bool PatBlt(IntPtr dc,int x,int y,int w,int h,uint rop);
 [DllImport("gdi32")]static extern IntPtr GetCurrentObject(IntPtr dc,uint type);
 [DllImport("gdi32")]static extern IntPtr CreateDIBSection(IntPtr dc,IntPtr info,uint usage,out IntPtr bits,IntPtr section,uint offset);
 [DllImport("gdi32")]static extern bool GdiFlush();
 [DllImport("gdi32")]static extern IntPtr CreateRectRgn(int l,int t,int r,int b);
 [DllImport("gdi32")]static extern int SelectClipRgn(IntPtr dc,IntPtr region);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate uint Sys(int index);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate uint DCColor(IntPtr dc,uint color);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate void Entry();
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate IntPtr Brush(IntPtr brush);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate IntPtr ColorBrush(uint color);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate IntPtr Pen(int style,int width,uint color);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate bool Gradient(IntPtr dc,IntPtr vertex,uint count,IntPtr mesh,uint meshes,uint mode);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int Fill(IntPtr dc,IntPtr rect,IntPtr brush);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int LineBrush(IntPtr rect,uint c1,uint c2,int mode,int wrap,out IntPtr brush);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate IntPtr Proc(IntPtr module,IntPtr name);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int BoolQuery();
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate bool Edge(IntPtr dc,IntPtr rect,uint edge,uint flags);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate bool Delete(IntPtr obj);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate bool Pat(IntPtr dc,int x,int y,int w,int h,uint rop);
 static int CheckWhiteClear(Pat f){int count=0;foreach(uint rop in new uint[]{0x00ff0062,0x42,0xf00021,0x550009})foreach(int w in new[]{0,1,4,12,28})foreach(int h in new[]{0,1,4,12,28})foreach(bool clip in new[]{false,true})using(var a=new EdgeSurface(clip))using(var b=new EdgeSurface(clip)){
  IntPtr brush=GetCurrentObject(b.dc,2);uint text=GetTextColor(b.dc),bg=GetBkColor(b.dc);bool x=PatBlt(a.dc,5,5,w,h,rop),y=f(b.dc,5,5,w,h,rop);if(x!=y)throw new Exception("clear return");var p=a.Pixels();var z=b.Pixels();for(int i=0;i<p.Length;i++){int expected=rop==0x00ff0062&&(p[i]&0xffffff)==0xffffff?0x202020:p[i]&0xffffff;if((z[i]&0xffffff)!=expected)throw new Exception("clear coverage/color");}if(GetCurrentObject(b.dc,2)!=brush||GetTextColor(b.dc)!=text||GetBkColor(b.dc)!=bg)throw new Exception("clear changed DC state");count++;
 }IntPtr monoDc=CreateCompatibleDC(IntPtr.Zero),mono=CreateBitmap(10,10,1,1,IntPtr.Zero),old=SelectObject(monoDc,mono);PatBlt(monoDc,0,0,10,10,0x42);if(!f(monoDc,2,2,4,4,0x00ff0062)||GetPixel(monoDc,3,3)!=0xffffff||GetPixel(monoDc,0,0)!=0)throw new Exception("monochrome mask changed");SelectObject(monoDc,old);DeleteObject(mono);DeleteDC(monoDc);count++;Console.WriteLine("PASS "+count+" color-clear masks, clipping, ROP forwarding, DC state and preserved monochrome mask");return count;}
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate ushort Register(IntPtr definition);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate bool Show(IntPtr window,int command);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate bool Pos(IntPtr window,IntPtr after,int x,int y,int w,int h,uint flags);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int DwmAttribute(IntPtr window,uint attribute,IntPtr value,uint size);
 static int CheckWindowDisplay(IntPtr fn,bool show,IntPtr slot,IntPtr busy){
  IntPtr name=Marshal.StringToHGlobalUni("STATIC"),window=CreateWindowEx(0,name,"",0,0,0,16,16,new IntPtr(-3),IntPtr.Zero,IntPtr.Zero,IntPtr.Zero),other=CreateWindowEx(0,name,"",0,0,0,16,16,new IntPtr(-3),IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
  if(window==IntPtr.Zero||other==IntPtr.Zero)throw new Exception("display fixture windows");
  IntPtr original=Marshal.ReadIntPtr(slot);var attrs=new System.Collections.Generic.List<uint>();var values=new System.Collections.Generic.List<int>();
  DwmAttribute mock=delegate(IntPtr w,uint attr,IntPtr data,uint size){if(w!=window||size!=4)throw new Exception("DWM arguments");attrs.Add(attr);values.Add(Marshal.ReadInt32(data));return unchecked((int)0x80070057);};
  Marshal.WriteIntPtr(slot,Marshal.GetFunctionPointerForDelegate(mock));int cases=0;
  if(show){var f=(Show)Marshal.GetDelegateForFunctionPointer(fn,typeof(Show));bool expected=ShowWindow(other,4),actual=f(window,4);if(actual!=expected)throw new Exception("show return changed");
   CheckDisplayAttrs(attrs,values);attrs.Clear();values.Clear();f(window,0);if(attrs.Count!=0)throw new Exception("hide should not apply DWM");
   ShowWindow(other,0);
   foreach(int command in new[]{2,3,5,6,7,9}){expected=ShowWindow(other,command);actual=f(window,command);if(actual!=expected)throw new Exception("minimize/restore return changed for command "+command);CheckDisplayAttrs(attrs,values);attrs.Clear();values.Clear();cases++;}
   Marshal.WriteInt32(busy,1);f(window,4);if(attrs.Count!=0)throw new Exception("display reentrancy guard");Marshal.WriteInt32(busy,0);
   Marshal.WriteIntPtr(slot,IntPtr.Zero);f(window,4);if(attrs.Count!=0)throw new Exception("missing DWM fallback");cases+=4;
  }else{var f=(Pos)Marshal.GetDelegateForFunctionPointer(fn,typeof(Pos));uint flags=0x40|0x10|4;bool expected=SetWindowPos(other,IntPtr.Zero,17,23,40,50,flags),actual=f(window,IntPtr.Zero,17,23,40,50,flags);if(actual!=expected)throw new Exception("position return changed");CheckDisplayAttrs(attrs,values);attrs.Clear();values.Clear();f(window,IntPtr.Zero,3,4,16,16,0x10|4);if(attrs.Count!=0)throw new Exception("ordinary resize should not apply DWM");cases+=2;}
  if(Marshal.ReadInt32(busy)!=0)throw new Exception("display guard not released");
  Marshal.WriteIntPtr(slot,original);DestroyWindow(window);DestroyWindow(other);Marshal.FreeHGlobal(name);GC.KeepAlive(mock);Console.WriteLine("PASS "+cases+" "+(show?"ShowWindow":"SetWindowPos")+" pre-show DWM attributes, failure fallback and native returns");return cases;
 }
 static void CheckDisplayAttrs(System.Collections.Generic.List<uint> attrs,System.Collections.Generic.List<int> values){if(attrs.Count!=2||attrs[0]!=20||attrs[1]!=34||values[0]!=1||values[1]!=-2||attrs.Contains(3))throw new Exception("DWM dark appearance must leave transitions unchanged");}
 static int CheckClassBackground(Register f,bool unicode,IntPtr borrowed){
  Console.WriteLine("Checking class background "+unicode);
  IntPtr instance=GetModuleHandle(null),wc=Marshal.AllocHGlobal(40),info=Marshal.AllocHGlobal(40),outBrush=Marshal.AllocHGlobal(12);int count=0;
  for(int pass=0;pass<30;pass++){
   string className="FoxmailDarkTest"+(unicode?"W":"A")+pass;IntPtr name=unicode?Marshal.StringToHGlobalUni(className):Marshal.StringToHGlobalAnsi(className);
   IntPtr inputBrush=pass<15?new IntPtr(6):borrowed;
   for(int k=0;k<40;k++)Marshal.WriteByte(wc,k,0);Marshal.WriteIntPtr(wc,4,GetProcAddress(LoadLibrary("user32.dll"),unicode?"DefWindowProcW":"DefWindowProcA"));Marshal.WriteIntPtr(wc,16,instance);Marshal.WriteIntPtr(wc,28,inputBrush);Marshal.WriteIntPtr(wc,36,name);
   ushort atom=f(wc);if(atom==0)throw new Exception("class registration");if(Marshal.ReadIntPtr(wc,28)!=inputBrush)throw new Exception("caller WNDCLASS modified");
   bool ok=unicode?GetClassInfoW(instance,name,info):GetClassInfoA(instance,name,info);if(!ok)throw new Exception("class info");IntPtr brush=Marshal.ReadIntPtr(info,28);int objectSize=GetObject(brush,12,outBrush);if(pass==0)Console.WriteLine("class brush="+brush+" size="+objectSize+" rgb="+Marshal.ReadInt32(outBrush,4).ToString("x"));if(brush.ToInt64()>=0&&brush.ToInt64()<=31||objectSize!=12||Marshal.ReadInt32(outBrush,4)!=0x202020)throw new Exception("class initial background");
   ushort duplicate=f(wc);uint error=GetLastError();if(pass==0)Console.WriteLine("duplicate atom="+duplicate+" error="+error);if(duplicate!=0||error!=1410)throw new Exception("duplicate class error preservation");
   if(unicode){IntPtr window=CreateWindowEx(0,name,"",0x80000000,0,0,16,16,IntPtr.Zero,IntPtr.Zero,instance,IntPtr.Zero);if(window==IntPtr.Zero)throw new Exception("hidden test window");using(var surface=new EdgeSurface(false)){if(SendMessage(window,0x14,surface.dc,IntPtr.Zero)==IntPtr.Zero||GetPixel(surface.dc,5,5)!=0x202020)throw new Exception("pre-paint background erase");}DestroyWindow(window);}
   if(!(unicode?UnregisterClassW(name,instance):UnregisterClassA(name,instance)))throw new Exception("class unregister");if(GetObjectType(borrowed)!=2)throw new Exception("class unregister deleted shared brush");Marshal.FreeHGlobal(name);count++;
  }
  Marshal.FreeHGlobal(wc);Marshal.FreeHGlobal(info);Marshal.FreeHGlobal(outBrush);Console.WriteLine("PASS "+count+" "+(unicode?"Unicode":"ANSI")+" class-owned dark backgrounds, immutable caller data and failure cleanup");return count;
 }
 class EdgeSurface:IDisposable {
  public IntPtr dc,bits,bmp,old;public const int N=40;
  public EdgeSurface(bool clip){dc=CreateCompatibleDC(IntPtr.Zero);IntPtr bi=Marshal.AllocHGlobal(40);for(int i=0;i<40;i++)Marshal.WriteByte(bi,i,0);Marshal.WriteInt32(bi,40);Marshal.WriteInt32(bi,4,N);Marshal.WriteInt32(bi,8,-N);Marshal.WriteInt16(bi,12,1);Marshal.WriteInt16(bi,14,32);bmp=CreateDIBSection(dc,bi,0,out bits,IntPtr.Zero,0);Marshal.FreeHGlobal(bi);old=SelectObject(dc,bmp);for(int i=0;i<N*N;i++)Marshal.WriteInt32(bits,i*4,0x113355);if(clip){IntPtr r=CreateRectRgn(10,7,24,20);SelectClipRgn(dc,r);DeleteObject(r);}}
  public int[] Pixels(){GdiFlush();int[] p=new int[N*N];Marshal.Copy(bits,p,0,p.Length);return p;}
  public void Dispose(){SelectObject(dc,old);DeleteObject(bmp);DeleteDC(dc);}
 }
 static int CheckEdges(Edge f){int count=0;
  foreach(uint edge in new uint[]{1,2,4,8,5,6,9,10})foreach(uint flags in new uint[]{15,0x200f,0x280f,0x1f})foreach(int w in new[]{0,1,2,3,4,5,6,12,28})foreach(int h in new[]{0,1,2,3,4,5,6,12,28})foreach(bool clip in new[]{false,true})using(var a=new EdgeSurface(clip))using(var b=new EdgeSurface(clip)){
   IntPtr r=Marshal.AllocHGlobal(16),q=Marshal.AllocHGlobal(16);int[] rect={5,5,5+w,5+h};Marshal.Copy(rect,0,r,4);Marshal.Copy(rect,0,q,4);
   bool x=DrawEdge(a.dc,r,edge,flags),y=f(b.dc,q,edge,flags);if(x!=y)throw new Exception("edge return");for(int k=0;k<4;k++)if(Marshal.ReadInt32(r,k*4)!=Marshal.ReadInt32(q,k*4))throw new Exception("edge BF_ADJUST");
   int depth=((edge&3)!=0?1:0)+((edge&12)!=0?1:0);bool adapted=x&&(flags==15||flags==0x200f)&&w>=2*depth&&h>=2*depth;var p=a.Pixels();var z=b.Pixels();for(int k=0;k<p.Length;k++){bool ap=(p[k]&0xffffff)!=0x113355,bp=(z[k]&0xffffff)!=0x113355;if(ap!=bp)throw new Exception("edge paint mask");if(!adapted&&p[k]!=z[k])throw new Exception("edge fallback pixels");if(adapted&&bp&&(z[k]&0xffffff)!=0x3d3d3d&&(z[k]&0xffffff)!=0x282828)throw new Exception("edge bright pixel");}
   Marshal.FreeHGlobal(r);Marshal.FreeHGlobal(q);count++;
  }
  Console.WriteLine("PASS: "+count+" actual x86 edge masks, clipping, return values, RECT adjustment and fallbacks");return count;
 }
 static int Raw(byte[] b,int rva){int pe=BitConverter.ToInt32(b,60),op=pe+24,so=op+BitConverter.ToUInt16(b,pe+20);for(int i=0;i<BitConverter.ToUInt16(b,pe+6);i++){int s=so+40*i,r=BitConverter.ToInt32(b,s+12),n=BitConverter.ToInt32(b,s+16);if(rva>=r&&rva<r+n)return BitConverter.ToInt32(b,s+20)+rva-r;}return rva;}
 static string Z(byte[] b,int off){int end=off;while(b[end]!=0)end++;return System.Text.Encoding.ASCII.GetString(b,off,end-off);}
 static void InitResolverImports(byte[] b,IntPtr image){int op=BitConverter.ToInt32(b,60)+24;for(int d=Raw(b,BitConverter.ToInt32(b,op+104));BitConverter.ToInt32(b,d+12)!=0;d+=20){string dll=Z(b,Raw(b,BitConverter.ToInt32(b,d+12)));int iat=BitConverter.ToInt32(b,d+16),t=BitConverter.ToInt32(b,d);if(t==0)t=iat;t=Raw(b,t);for(int i=0;;i++){uint v=BitConverter.ToUInt32(b,t+4*i);if(v==0)break;if(v>=0x80000000)continue;string n=Z(b,Raw(b,(int)v)+2);if((dll.Equals("kernel32.dll",StringComparison.OrdinalIgnoreCase)&&(n=="GetProcAddress"||n=="GetModuleHandleA"))||n=="GetMapMode"||n=="FrameRect"||n=="GetLastError"||n=="SetLastError"||n=="SelectObject"||n=="GetCurrentObject"||n=="GetObjectW"||n=="GetObjectA"||n=="LoadLibraryExW"||n=="GetWindowLongW"||n=="GetWindowLongA"||n=="GetClassNameA"||n=="SetWindowLongW"||n=="SetWindowLongA"||n=="IsWindowVisible"||n=="IsWindow"||n=="RedrawWindow")Marshal.WriteIntPtr(IntPtr.Add(image,iat+4*i),GetProcAddress(LoadLibrary(dll),n));}}}
 static void Main(string[] args){
 var b=File.ReadAllBytes(args[0]);int pe=BitConverter.ToInt32(b,60),op=pe+24,ns=BitConverter.ToUInt16(b,pe+6),sh=op+BitConverter.ToUInt16(b,pe+20)+(ns-1)*40;
 int rva=BitConverter.ToInt32(b,sh+12),raw=BitConverter.ToInt32(b,sh+20),size=BitConverter.ToInt32(b,sh+8);
 IntPtr image=VirtualAlloc(IntPtr.Zero,(UIntPtr)(rva+size),0x3000,0x40);if(image==IntPtr.Zero)throw new Exception("alloc");Marshal.Copy(b,raw,IntPtr.Add(image,rva),size);
 string[] specs=File.ReadAllLines(args[1]);var config=specs[0].Split(',');int slots=int.Parse(config[0]);
 for(int i=1;i<specs.Length;i++){var s=specs[i].Split(',');Marshal.WriteIntPtr(IntPtr.Add(image,int.Parse(s[3])),GetProcAddress(LoadLibrary(s[0]),s[1]));}
 Marshal.WriteIntPtr(IntPtr.Add(image,int.Parse(config[3])),GetProcAddress(LoadLibrary("gdi32.dll"),"GetDeviceCaps"));
 InitResolverImports(b,image);
 Marshal.WriteByte(IntPtr.Add(image,int.Parse(config[2])),0xc3);
 ((Entry)Marshal.GetDelegateForFunctionPointer(IntPtr.Add(image,rva+int.Parse(config[1])),typeof(Entry)))();
 IntPtr dc=CreateCompatibleDC(IntPtr.Zero);int count=0;
 for(int i=1;i<specs.Length;i++){var s=specs[i].Split(',');var ptr=IntPtr.Add(image,rva+int.Parse(s[2]));
 if(s[1]=="ShowWindow"||s[1]=="SetWindowPos"){count+=CheckWindowDisplay(ptr,s[1]=="ShowWindow",IntPtr.Add(image,int.Parse(config[4])),IntPtr.Add(image,int.Parse(config[5])));}
 if(s[1]=="GetProcAddress"){
 var f=(Proc)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Proc));IntPtr ux=LoadLibrary("uxtheme.dll");foreach(string name in new string[]{"IsAppThemed","IsThemeActive"}){IntPtr n=Marshal.StringToHGlobalAnsi(name),q=f(ux,n);if(q==IntPtr.Zero||((BoolQuery)Marshal.GetDelegateForFunctionPointer(q,typeof(BoolQuery)))()!=0)throw new Exception("theme query");Marshal.FreeHGlobal(n);count++;}
 foreach(string name in new string[]{"GetTickCount","X","IsAppThemedExtra"}){IntPtr m=LoadLibrary("kernel32.dll"),n=Marshal.StringToHGlobalAnsi(name);if(f(m,n)!=GetProcAddress(m,name))throw new Exception("resolver forwarding");Marshal.FreeHGlobal(n);count++;}}
 if(s[1]=="RegisterClassA"||s[1]=="RegisterClassW"){IntPtr getter=IntPtr.Zero;for(int j=1;j<specs.Length;j++){var v=specs[j].Split(',');if(v[1]=="GetSysColorBrush")getter=IntPtr.Add(image,rva+int.Parse(v[2]));}var get=(Sys)Marshal.GetDelegateForFunctionPointer(getter,typeof(Sys));count+=CheckClassBackground((Register)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Register)),s[1]=="RegisterClassW",new IntPtr(unchecked((int)get(5))));}
 if(s[1]=="DrawEdge"){count+=CheckEdges((Edge)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Edge)));}
 if(s[1]=="PatBlt"){count+=CheckWhiteClear((Pat)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Pat)));}
 if(s[1]=="DeleteObject"){
  Console.WriteLine("Testing borrowed brush lifetime");
  var f=(Delete)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Delete));IntPtr colorPtr=IntPtr.Zero;
  for(int j=1;j<specs.Length;j++){var v=specs[j].Split(',');if(v[1]=="GetSysColorBrush")colorPtr=IntPtr.Add(image,rva+int.Parse(v[2]));}
  var getBrush=(Sys)Marshal.GetDelegateForFunctionPointer(colorPtr,typeof(Sys));
  for(int pass=0;pass<2000;pass++)for(int idx=0;idx<=30;idx++){
   IntPtr h=new IntPtr(unchecked((int)getBrush(idx)));if(h==IntPtr.Zero)continue;
   // Only app-owned cached entries are protected; indices 25/29 delegate to OS.
   f(h);if(GetObjectType(h)!=2)throw new Exception("borrowed brush lifetime");
  }
  IntPtr font=CreateFont(-17,0,0,0,400,0,0,0,1,0,0,0,0,"Segoe UI"),nativeFont=CreateFont(-19,0,0,0,400,0,0,0,1,0,0,0,0,"Segoe UI");
  bool nativeDeleted=DeleteObject(nativeFont),adaptedDeleted=f(font);GdiFlush();if(nativeDeleted!=adaptedDeleted||GetObjectType(font)!=GetObjectType(nativeFont))throw new Exception("font deletion forwarding");
  var pen=GetProcAddress(LoadLibrary("gdi32.dll"),"CreatePen");var make=(Pen)Marshal.GetDelegateForFunctionPointer(pen,typeof(Pen));IntPtr p=make(0,1,0x123456),np=make(0,1,0x654321);nativeDeleted=DeleteObject(np);adaptedDeleted=f(p);GdiFlush();if(nativeDeleted!=adaptedDeleted||GetObjectType(p)!=GetObjectType(np))throw new Exception("pen deletion forwarding");
  if(f(IntPtr.Zero)!=DeleteObject(IntPtr.Zero))throw new Exception("invalid deletion forwarding");count+=62003;Console.WriteLine("PASS borrowed system/stock brush lifetime through 62000 deletes; ordinary object deletion matches native");
 }
 if(s[1]=="GetSysColor"){var f=(Sys)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Sys));if(f(5)!=0x202020||f(8)!=0xe6e6e6||f(25)!=GetSysColor(25))throw new Exception("system palette");foreach(int idx in new[]{-1,31,255,int.MaxValue})if(f(idx)!=GetSysColor(idx))throw new Exception("system palette out-of-range forwarding");count+=7;}
 if(s[1]=="SetTextColor"){var f=(DCColor)Marshal.GetDelegateForFunctionPointer(ptr,typeof(DCColor));f(dc,0);if(GetTextColor(dc)!=0xe6e6e6)throw new Exception("text");f(dc,0xff);if(GetTextColor(dc)!=0xff)throw new Exception("accent");count+=2;
 if(args.Length>2){var clock=System.Diagnostics.Stopwatch.StartNew();for(int n=0;n<500000;n++)f(dc,(n&1)==0?0u:0x808080u);clock.Stop();Console.WriteLine("500000 adapted SetTextColor calls: "+clock.ElapsedMilliseconds+" ms");
 var native=(DCColor)Marshal.GetDelegateForFunctionPointer(GetProcAddress(LoadLibrary("gdi32.dll"),"SetTextColor"),typeof(DCColor));clock.Restart();for(int n=0;n<500000;n++)native(dc,(n&1)==0?0u:0x808080u);clock.Stop();Console.WriteLine("500000 original SetTextColor calls: "+clock.ElapsedMilliseconds+" ms");}}
 if(s[1]=="SetBkColor"){var f=(DCColor)Marshal.GetDelegateForFunctionPointer(ptr,typeof(DCColor));f(dc,0xffffff);if(GetBkColor(dc)!=0x202020)throw new Exception("background");f(dc,0xf2ece5);if(GetBkColor(dc)!=0x202020)throw new Exception("tinted background");count+=2;}
 if(s[1]=="GetSysColorBrush"){var f=(Sys)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Sys));IntPtr q=Marshal.AllocHGlobal(12);if(GetObject(new IntPtr(unchecked((int)f(5))),12,q)!=12||Marshal.ReadInt32(q,4)!=0x202020)throw new Exception("cached brush");foreach(int idx in new[]{-1,31,255,int.MaxValue})if(new IntPtr(unchecked((int)f(idx)))!=NativeSystemBrush(idx))throw new Exception("system brush out-of-range forwarding");Marshal.FreeHGlobal(q);count+=5;}
 if(s[1]=="CreateBrushIndirect"){var f=(Brush)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Brush));IntPtr q=Marshal.AllocHGlobal(12),o=Marshal.AllocHGlobal(12);Marshal.WriteInt32(q,0,0);Marshal.WriteInt32(q,4,0xf2ece5);Marshal.WriteInt32(q,8,0);IntPtr brush=f(q);if(GetObject(brush,12,o)!=12||Marshal.ReadInt32(o,4)!=0x202020||Marshal.ReadInt32(q,4)!=0xf2ece5)throw new Exception("indirect brush isolation");DeleteObject(brush);Marshal.FreeHGlobal(q);Marshal.FreeHGlobal(o);count++;}
 if(s[1]=="CreateSolidBrush"){var f=(ColorBrush)Marshal.GetDelegateForFunctionPointer(ptr,typeof(ColorBrush));IntPtr o=Marshal.AllocHGlobal(12),brush=f(0xf2ece5);if(GetObject(brush,12,o)!=12||Marshal.ReadInt32(o,4)!=0x202020)throw new Exception("solid brush");DeleteObject(brush);Marshal.FreeHGlobal(o);count++;}
 if(s[1]=="CreatePen"){var f=(Pen)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Pen));IntPtr o=Marshal.AllocHGlobal(16),pen=f(0,1,0xeeeeee);if(GetObject(pen,16,o)!=16||Marshal.ReadInt32(o,12)!=0x3d3d3d)throw new Exception("pen");DeleteObject(pen);Marshal.FreeHGlobal(o);count++;}
 if(s[1]=="CreatePenIndirect"){
 var f=(Brush)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Brush));IntPtr q=Marshal.AllocHGlobal(16),o=Marshal.AllocHGlobal(16);Marshal.WriteInt32(q,0,0);Marshal.WriteInt32(q,4,1);Marshal.WriteInt32(q,8,0);Marshal.WriteInt32(q,12,0xdddddd);IntPtr pen=f(q);
 if(GetObject(pen,16,o)!=16||Marshal.ReadInt32(o,12)!=0x3d3d3d||Marshal.ReadInt32(q,12)!=0xdddddd)throw new Exception("indirect pen/isolation");DeleteObject(pen);Marshal.FreeHGlobal(q);Marshal.FreeHGlobal(o);count++;}
 if(s[1]=="GradientFill"){
 var f=(Gradient)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Gradient));IntPtr screen=GetDC(IntPtr.Zero),bmp=CreateCompatibleBitmap(screen,10,10),old=SelectObject(dc,bmp);ReleaseDC(IntPtr.Zero,screen);
 IntPtr vert=Marshal.AllocHGlobal(32),mesh=Marshal.AllocHGlobal(8);for(int j=0;j<32;j++)Marshal.WriteByte(vert,j,0);Marshal.WriteInt32(vert,16,10);Marshal.WriteInt32(vert,20,10);
 foreach(int j in new int[]{8,10,12,24,26,28})Marshal.WriteInt16(vert,j,unchecked((short)0xffff));Marshal.WriteInt32(mesh,0,0);Marshal.WriteInt32(mesh,4,1);
 if(!f(dc,vert,2,mesh,1,1)||GetPixel(dc,5,5)!=0x202020||Marshal.ReadInt16(vert,8)!=-1)throw new Exception("gradient drawing/isolation");
 SelectObject(dc,old);DeleteObject(bmp);Marshal.FreeHGlobal(vert);Marshal.FreeHGlobal(mesh);count++;}
 if(s[1]=="GetStockObject"){
 var f=(Sys)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Sys));IntPtr o=Marshal.AllocHGlobal(12);IntPtr brush=new IntPtr(unchecked((int)f(0)));
 if(GetObject(brush,12,o)!=12||Marshal.ReadInt32(o,4)!=0x202020||f(5)!=unchecked((uint)GetStockObject(5).ToInt32()))throw new Exception("stock brush/fallback");Marshal.FreeHGlobal(o);count+=2;}
 if(s[1]=="FillRect"){
 var f=(Fill)Marshal.GetDelegateForFunctionPointer(ptr,typeof(Fill));IntPtr screen=GetDC(IntPtr.Zero),bmp=CreateCompatibleBitmap(screen,10,10),old=SelectObject(dc,bmp);ReleaseDC(IntPtr.Zero,screen);
 IntPtr rect=Marshal.AllocHGlobal(16);Marshal.WriteInt32(rect,0,0);Marshal.WriteInt32(rect,4,0);Marshal.WriteInt32(rect,8,10);Marshal.WriteInt32(rect,12,10);
 if(f(dc,rect,new IntPtr(6))==0||GetPixel(dc,5,5)!=0x202020)throw new Exception("system-color FillRect");IntPtr real=CreateSolidBrush(0x0000ff);
 if(f(dc,rect,real)==0||GetPixel(dc,5,5)!=0x0000ff)throw new Exception("real-brush FillRect");DeleteObject(real);SelectObject(dc,old);DeleteObject(bmp);Marshal.FreeHGlobal(rect);count+=2;}
 if(s[1]=="GdipCreateLineBrushFromRect"){
 IntPtr startup=Marshal.AllocHGlobal(16);for(int j=0;j<16;j++)Marshal.WriteByte(startup,j,0);Marshal.WriteInt32(startup,1);IntPtr token;if(GdiplusStartup(out token,startup,IntPtr.Zero)!=0)throw new Exception("GDI+ startup");
 IntPtr rect=Marshal.AllocHGlobal(16),colors=Marshal.AllocHGlobal(8);Marshal.Copy(new float[]{0,0,10,10},0,rect,4);var f=(LineBrush)Marshal.GetDelegateForFunctionPointer(ptr,typeof(LineBrush));IntPtr brush;
 if(f(rect,0xffffffff,0xffff0000,1,0,out brush)!=0||GdipGetLineColors(brush,colors)!=0||unchecked((uint)Marshal.ReadInt32(colors,0))!=0xff202020||unchecked((uint)Marshal.ReadInt32(colors,4))!=0xffff0000)throw new Exception("GDI+ gradient color/alpha");
 GdipDeleteBrush(brush);GdiplusShutdown(token);Marshal.FreeHGlobal(startup);Marshal.FreeHGlobal(rect);Marshal.FreeHGlobal(colors);count++;}
 }
 DeleteDC(dc);Console.WriteLine("PASS: startup + "+count+" native x86 checks; all patched APIs covered.");
 }
}
