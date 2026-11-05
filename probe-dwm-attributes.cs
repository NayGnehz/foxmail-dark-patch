using System;using System.Runtime.InteropServices;
class DwmProbe {
 [DllImport("user32",CharSet=CharSet.Unicode)]static extern IntPtr CreateWindowEx(uint ex,string cls,string title,uint style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
 [DllImport("user32")]static extern bool DestroyWindow(IntPtr window);
 [DllImport("dwmapi")]static extern int DwmSetWindowAttribute(IntPtr window,uint attribute,ref int value,uint size);
 [DllImport("dwmapi")]static extern int DwmGetWindowAttribute(IntPtr window,uint attribute,out int value,uint size);
 static void Main(){var w=CreateWindowEx(0,"STATIC","",0x80800000,0,0,32,32,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);if(w==IntPtr.Zero)throw new Exception("hidden window");try{foreach(int attr in new[]{3,20,34}){int value=attr==34?-2:1;Console.WriteLine("DWM attribute "+attr+" HRESULT 0x"+DwmSetWindowAttribute(w,(uint)attr,ref value,4).ToString("x8"));}int border;int result=DwmGetWindowAttribute(w,34,out border,4);Console.WriteLine("Border readback HRESULT 0x"+result.ToString("x8")+" value 0x"+border.ToString("x8"));}finally{DestroyWindow(w);}}
}
