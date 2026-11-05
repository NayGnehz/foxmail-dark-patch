using System;using System.Runtime.InteropServices;
class ProbeTrayShow{
 [DllImport("user32",CharSet=CharSet.Unicode)]static extern IntPtr CreateWindowEx(uint ex,string cls,string title,uint style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
 [DllImport("user32")]static extern bool SetLayeredWindowAttributes(IntPtr hwnd,uint key,byte alpha,uint flags);
 [DllImport("user32")]static extern bool ShowWindow(IntPtr hwnd,int command);
 [DllImport("user32")]static extern bool IsIconic(IntPtr hwnd);
 [DllImport("user32")]static extern bool IsZoomed(IntPtr hwnd);
 [DllImport("user32")]static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32")]static extern bool GetWindowPlacement(IntPtr hwnd,ref Placement p);
 [DllImport("user32")]static extern bool DestroyWindow(IntPtr hwnd);
 [StructLayout(LayoutKind.Sequential)]struct Point{public int x,y;}
 [StructLayout(LayoutKind.Sequential)]struct Rect{public int l,t,r,b;}
 [StructLayout(LayoutKind.Sequential)]struct Placement{public int length,flags,show;public Point min,max;public Rect normal;}
 static string State(IntPtr w){var p=new Placement{length=Marshal.SizeOf(typeof(Placement))};GetWindowPlacement(w,ref p);return "iconic="+IsIconic(w)+" zoomed="+IsZoomed(w)+" visible="+IsWindowVisible(w)+" show="+p.show+" flags="+p.flags+" normal="+p.normal.l+","+p.normal.t+","+p.normal.r+","+p.normal.b;}
 static void Main(){foreach(string start in new[]{"normal","maximized","minimizedFromNormal","minimizedFromMaximized"})foreach(int mode in new[]{5,9,-1}){
  IntPtr w=CreateWindowEx(0x08080080,"STATIC","",0x00cf0000,-32000,-32000,200,120,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);if(w==IntPtr.Zero)throw new Exception("fixture window");SetLayeredWindowAttributes(w,0,0,2);
  if(start.Contains("Maximized")||start=="maximized")ShowWindow(w,3);else ShowWindow(w,4);if(start.StartsWith("minimized"))ShowWindow(w,7);ShowWindow(w,0);string before=State(w);int chosen=mode<0?(IsIconic(w)?9:5):mode;ShowWindow(w,chosen);Console.WriteLine(start+" request="+mode+" chosen="+chosen+" before["+before+"] after["+State(w)+"]");DestroyWindow(w);
 }Console.WriteLine("Fixture windows used alpha=0, no-activate/tool-window flags; no Foxmail process used.");}
}
