using System;using System.Runtime.InteropServices;
class MenuShadowCheck{
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct WC{public uint style;public IntPtr wndproc;public int clsExtra,wndExtra;public IntPtr instance,icon,cursor,background;public string menu,name;}
 [StructLayout(LayoutKind.Sequential)]struct RECT{public int l,t,r,b;}
 [StructLayout(LayoutKind.Sequential)]struct POINT{public int x,y;public POINT(int a,int b){x=a;y=b;}}
 [StructLayout(LayoutKind.Sequential)]struct SIZE{public int x,y;public SIZE(int a,int b){x=a;y=b;}}
 [StructLayout(LayoutKind.Sequential,Pack=1)]struct BLEND{public byte op,flags,alpha,format;}
 delegate IntPtr Proc(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("user32",CharSet=CharSet.Unicode,SetLastError=true)]static extern ushort RegisterClass(ref WC c);
 [DllImport("user32",CharSet=CharSet.Unicode)]static extern bool UnregisterClass(string name,IntPtr instance);
 [DllImport("user32",CharSet=CharSet.Unicode)]static extern IntPtr DefWindowProc(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("user32",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateWindowEx(uint ex,string cls,string title,uint style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
 [DllImport("user32")]static extern bool DestroyWindow(IntPtr h);
 [DllImport("user32")]static extern bool GetClientRect(IntPtr h,out RECT r);
 [DllImport("user32")]static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32",SetLastError=true)]static extern bool UpdateLayeredWindow(IntPtr hwnd,IntPtr dst,ref POINT p,ref SIZE size,IntPtr src,ref POINT q,uint color,ref BLEND blend,uint flags);
 [DllImport("gdi32")]static extern IntPtr CreateCompatibleDC(IntPtr dc);
 [DllImport("gdi32")]static extern bool DeleteDC(IntPtr dc);
 [DllImport("gdi32")]static extern IntPtr CreateDIBSection(IntPtr dc,IntPtr info,uint usage,out IntPtr pixels,IntPtr section,uint offset);
 [DllImport("gdi32")]static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
 [DllImport("gdi32")]static extern bool DeleteObject(IntPtr obj);
 static void Check(bool v,string m){if(!v)throw new Exception(m+" Win32="+Marshal.GetLastWin32Error());}
 static void Main(){Proc proc=DefWindowProc;var wc=new WC{style=3,wndproc=Marshal.GetFunctionPointerForDelegate(proc),background=(IntPtr)5,name="FoxmailShadowIsolatedTest"};Check(RegisterClass(ref wc)!=0,"register");int checks=0;try{foreach(var size in new[]{new SIZE(158,394),new SIZE(198,164),new SIZE(48,48)})foreach(uint style in new[]{0x80880000U,0x80080000U}){var h=CreateWindowEx(0x800a0,wc.name,"",style,20,20,size.x,size.y,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);Check(h!=IntPtr.Zero,"create");IntPtr dc=IntPtr.Zero,bmp=IntPtr.Zero,old=IntPtr.Zero,info=IntPtr.Zero;try{RECT c=new RECT(),w=new RECT();Check(GetClientRect(h,out c)&&GetWindowRect(h,out w),"rects");int border=style==0x80880000?2:0;Check(c.r-c.l==size.x-border&&c.b-c.t==size.y-border,"client geometry");Check(w.r-w.l==size.x&&w.b-w.t==size.y,"outer geometry");Check(!IsWindowVisible(h),"hidden");dc=CreateCompatibleDC(IntPtr.Zero);info=Marshal.AllocHGlobal(40);for(int i=0;i<40;i++)Marshal.WriteByte(info,i,0);Marshal.WriteInt32(info,40);Marshal.WriteInt32(info,4,size.x);Marshal.WriteInt32(info,8,-size.y);Marshal.WriteInt16(info,12,1);Marshal.WriteInt16(info,14,32);IntPtr pixels;bmp=CreateDIBSection(dc,info,0,out pixels,IntPtr.Zero,0);Check(bmp!=IntPtr.Zero,"DIB");old=SelectObject(dc,bmp);for(int i=0;i<size.x*size.y;i++)Marshal.WriteInt32(pixels,i*4,unchecked((int)0x20202020));var pos=new POINT(20,20);var zero=new POINT(0,0);var sz=size;var blend=new BLEND{alpha=255,format=1};Check(UpdateLayeredWindow(h,IntPtr.Zero,ref pos,ref sz,dc,ref zero,0,ref blend,2),"layered update");Check(GetWindowRect(h,out w)&&w.r-w.l==size.x&&w.b-w.t==size.y,"layered geometry");Check(!IsWindowVisible(h),"still hidden");Console.WriteLine("PASS style=0x"+style.ToString("X8")+" size="+size.x+"x"+size.y+" client="+(c.r-c.l)+"x"+(c.b-c.t)+" layered update");checks++;}finally{if(old!=IntPtr.Zero)SelectObject(dc,old);if(bmp!=IntPtr.Zero)DeleteObject(bmp);if(dc!=IntPtr.Zero)DeleteDC(dc);if(info!=IntPtr.Zero)Marshal.FreeHGlobal(info);DestroyWindow(h);}}}finally{UnregisterClass(wc.name,IntPtr.Zero);GC.KeepAlive(proc);}Console.WriteLine("PASS "+checks+" isolated shadow window cases; no Foxmail process opened.");}
}
