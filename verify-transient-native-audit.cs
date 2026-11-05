using System;using System.Runtime.InteropServices;
class NativeTransientAudit{
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate IntPtr Wnd(IntPtr w,uint msg,IntPtr wp,IntPtr lp);
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct WC{public uint style;public Wnd proc;public int ce,we;public IntPtr instance,icon,cursor,brush;public string menu,name;}
 [StructLayout(LayoutKind.Sequential)]struct RECT{public int l,t,r,b;}
 [StructLayout(LayoutKind.Sequential)]struct PAINT{public IntPtr dc;public int erase;public RECT rect;public int restore,inc;[MarshalAs(UnmanagedType.ByValArray,SizeConst=32)]public byte[] reserved;}
 [StructLayout(LayoutKind.Sequential)]struct MSG{public IntPtr hwnd;public uint message;public IntPtr wp,lp;public uint time;public int x,y;}
 [DllImport("user32",CharSet=CharSet.Unicode)]static extern ushort RegisterClass(ref WC c);
 [DllImport("user32",CharSet=CharSet.Unicode)]static extern bool UnregisterClass(string c,IntPtr h);
 [DllImport("user32",CharSet=CharSet.Unicode)]static extern IntPtr CreateWindowEx(uint ex,string c,string title,uint style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
 [DllImport("user32")]static extern bool DestroyWindow(IntPtr w);
 [DllImport("user32")]static extern bool ShowWindow(IntPtr w,int command);
 [DllImport("user32")]static extern int GetWindowLong(IntPtr w,int index);
 [DllImport("user32")]static extern int SetWindowLong(IntPtr w,int index,int value);
 [DllImport("user32")]static extern bool RedrawWindow(IntPtr w,IntPtr rect,IntPtr region,uint flags);
 [DllImport("user32")]static extern bool GetUpdateRect(IntPtr w,out RECT r,bool erase);
 [DllImport("user32")]static extern IntPtr DefWindowProc(IntPtr w,uint msg,IntPtr wp,IntPtr lp);
 [DllImport("user32")]static extern IntPtr BeginPaint(IntPtr w,out PAINT p);
 [DllImport("user32")]static extern bool EndPaint(IntPtr w,ref PAINT p);
 [DllImport("user32")]static extern int FillRect(IntPtr dc,ref RECT r,IntPtr b);
 [DllImport("user32")]static extern bool GetClientRect(IntPtr w,out RECT r);
 [DllImport("user32",CharSet=CharSet.Unicode)]static extern int DrawText(IntPtr dc,string text,int n,ref RECT r,uint flags);
 [DllImport("gdi32")]static extern IntPtr CreateSolidBrush(int c);
 [DllImport("gdi32")]static extern bool DeleteObject(IntPtr b);
 [DllImport("gdi32")]static extern int SetTextColor(IntPtr dc,int c);
 [DllImport("gdi32")]static extern int SetBkMode(IntPtr dc,int mode);
 [DllImport("user32")]static extern bool PeekMessage(out MSG m,IntPtr w,uint min,uint max,uint remove);
 [DllImport("user32")]static extern IntPtr DispatchMessage(ref MSG m);
 [DllImport("kernel32")]static extern IntPtr GetModuleHandle(string n);
 static IntPtr brush,parent,child;static Wnd proc=Procedure;static string phase="create";static int paint,nc,style;static int clearPaint,clearNc,queuedAfterClear,dirtyParent,dirtyChild;
 static IntPtr Procedure(IntPtr w,uint msg,IntPtr wp,IntPtr lp){if(msg==0xf){paint++;if(phase=="clear")clearPaint++;PAINT ps;IntPtr dc=BeginPaint(w,out ps);RECT r;GetClientRect(w,out r);FillRect(dc,ref r,brush);SetTextColor(dc,0xe0e0e0);SetBkMode(dc,1);DrawText(dc,"Transient audit owns this window",-1,ref r,0);EndPaint(w,ref ps);return IntPtr.Zero;}if(msg==0x85){nc++;if(phase=="clear")clearNc++;}if(msg==0x7d)style++;if(msg==0x14)return new IntPtr(1);return DefWindowProc(w,msg,wp,lp);}
 static void Pump(){MSG m;for(int i=0;i<512&&PeekMessage(out m,IntPtr.Zero,0,0,1);i++)DispatchMessage(ref m);}
 static void Main(){if(IntPtr.Size!=4)throw new Exception("x86 only");IntPtr instance=GetModuleHandle(null);string name="CodexTransientAudit"+System.Diagnostics.Process.GetCurrentProcess().Id;brush=CreateSolidBrush(0x202020);WC wc=new WC();wc.proc=proc;wc.instance=instance;wc.name=name;wc.brush=brush;if(RegisterClass(ref wc)==0)throw new Exception("RegisterClass");
 foreach(uint frame in new uint[]{0x80000000,0xcf0000}){parent=CreateWindowEx(0x08000080,name,"Transient Audit",frame|0x02000000,-30000,-30000,360,240,IntPtr.Zero,IntPtr.Zero,instance,IntPtr.Zero);child=CreateWindowEx(0,name,"",0x50000000,8,8,320,180,parent,IntPtr.Zero,instance,IntPtr.Zero);if(parent==IntPtr.Zero||child==IntPtr.Zero)throw new Exception("CreateWindow");paint=nc=style=clearPaint=clearNc=queuedAfterClear=dirtyParent=dirtyChild=0;
 for(int i=0;i<20;i++){phase="enable";SetWindowLong(parent,-20,GetWindowLong(parent,-20)|0x2000000);phase="show";ShowWindow(parent,4);phase="redraw";if(!RedrawWindow(parent,IntPtr.Zero,IntPtr.Zero,0x181))throw new Exception("RedrawWindow");phase="clear";int p=paint;SetWindowLong(parent,-20,GetWindowLong(parent,-20)&~0x2000000);RECT r;if(GetUpdateRect(parent,out r,false))dirtyParent++;if(GetUpdateRect(child,out r,false))dirtyChild++;phase="pump";Pump();queuedAfterClear+=paint-p;phase="hide";ShowWindow(parent,0);Pump();}
 Console.WriteLine("frame="+frame.ToString("x")+" cycles=20 paint="+paint+" nc="+nc+" style="+style+" clearSyncPaint="+clearPaint+" clearSyncNc="+clearNc+" parentDirtyAfterClear="+dirtyParent+" childDirtyAfterClear="+dirtyChild+" paintsPumpedAfterClear="+queuedAfterClear);DestroyWindow(parent);Pump();}
 UnregisterClass(name,instance);DeleteObject(brush);Console.WriteLine("Owned offscreen HWNDs only. No visual/DWM/Foxmail inference; no sleep, capture, timer or real-app interaction.");GC.KeepAlive(proc);}
}
