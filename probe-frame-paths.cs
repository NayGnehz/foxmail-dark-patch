using System;using System.Runtime.InteropServices;
class ProbeFramePaths {
 [StructLayout(LayoutKind.Sequential)]struct RECT{public int left,top,right,bottom;public RECT(int a,int b,int c,int d){left=a;top=b;right=c;bottom=d;}public override string ToString(){return left+","+top+","+right+","+bottom;}}
 [DllImport("gdi32")]static extern IntPtr CreateCompatibleDC(IntPtr dc);
 [DllImport("gdi32")]static extern IntPtr CreateDIBSection(IntPtr dc,IntPtr info,uint use,out IntPtr bits,IntPtr section,uint offset);
 [DllImport("gdi32")]static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
 [DllImport("gdi32")]static extern bool DeleteObject(IntPtr obj);
 [DllImport("gdi32")]static extern bool DeleteDC(IntPtr dc);
 [DllImport("gdi32")]static extern bool GdiFlush();
 [DllImport("gdi32")]static extern IntPtr CreateSolidBrush(uint c);
 [DllImport("gdi32")]static extern IntPtr CreateRectRgn(int a,int b,int c,int d);
 [DllImport("gdi32")]static extern int SelectClipRgn(IntPtr dc,IntPtr rgn);
 [DllImport("gdi32")]static extern IntPtr GetCurrentObject(IntPtr dc,uint kind);
 [DllImport("gdi32")]static extern uint SetTextColor(IntPtr dc,uint color);
 [DllImport("gdi32")]static extern uint GetTextColor(IntPtr dc);
 [DllImport("gdi32")]static extern uint SetBkColor(IntPtr dc,uint color);
 [DllImport("gdi32")]static extern uint GetBkColor(IntPtr dc);
 [DllImport("gdi32")]static extern int SetBkMode(IntPtr dc,int mode);
 [DllImport("gdi32")]static extern int GetBkMode(IntPtr dc);
 [StructLayout(LayoutKind.Sequential)]struct POINT{public int x,y;}
 [DllImport("gdi32")]static extern bool GetCurrentPositionEx(IntPtr dc,out POINT p);
 [DllImport("gdi32")]static extern bool MoveToEx(IntPtr dc,int x,int y,IntPtr old);
 [DllImport("user32")]static extern bool DrawEdge(IntPtr dc,ref RECT rect,uint edge,uint flags);
 [DllImport("user32")]static extern int FrameRect(IntPtr dc,ref RECT rect,IntPtr brush);
 [DllImport("user32")]static extern bool InflateRect(ref RECT rect,int x,int y);
 const int N=40,SENTINEL=0x113355;
 class Surface:IDisposable {public IntPtr dc,bits,bmp,old;public Surface(){dc=CreateCompatibleDC(IntPtr.Zero);IntPtr info=Marshal.AllocHGlobal(40);for(int i=0;i<40;i++)Marshal.WriteByte(info,i,0);Marshal.WriteInt32(info,40);Marshal.WriteInt32(info,4,N);Marshal.WriteInt32(info,8,-N);Marshal.WriteInt16(info,12,1);Marshal.WriteInt16(info,14,32);bmp=CreateDIBSection(dc,info,0,out bits,IntPtr.Zero,0);old=SelectObject(dc,bmp);Marshal.FreeHGlobal(info);for(int i=0;i<N*N;i++)Marshal.WriteInt32(bits,i*4,SENTINEL);}
 public int[] Pixels(){GdiFlush();var p=new int[N*N];Marshal.Copy(bits,p,0,p.Length);return p;}
 public void Clip(){var r=CreateRectRgn(10,7,24,20);SelectClipRgn(dc,r);DeleteObject(r);}
 public void Dispose(){SelectObject(dc,old);DeleteObject(bmp);DeleteDC(dc);}}
 static void Main(){IntPtr border=CreateSolidBrush(0x574b43),panel=CreateSolidBrush(0x322b26);int tested=0,adapted=0;
 foreach(uint edge in new uint[]{1,2,4,8,5,6,9,10})foreach(uint extra in new uint[]{0,0x2000})foreach(int w in new[]{0,1,2,3,4,5,6,12,28})foreach(int h in new[]{0,1,2,3,4,5,6,12,28})foreach(bool clip in new[]{false,true})using(var old=new Surface())using(var replacement=new Surface()){
  if(clip){old.Clip();replacement.Clip();}foreach(IntPtr dc in new[]{old.dc,replacement.dc}){SetTextColor(dc,0x123456);SetBkColor(dc,0xabcdef);SetBkMode(dc,1);MoveToEx(dc,7,9,IntPtr.Zero);}RECT a=new RECT(5,5,5+w,5+h),b=a;
  bool oldOk=DrawEdge(old.dc,ref a,edge,15|extra),newOk=DrawEdge(replacement.dc,ref b,edge,15|extra);
  int depth=((edge&3)!=0?1:0)+((edge&12)!=0?1:0);
  if(newOk&&w>=2*depth&&h>=2*depth){RECT overlay=new RECT(5,5,5+w,5+h);FrameRect(replacement.dc,ref overlay,border);if(depth==2){InflateRect(ref overlay,-1,-1);FrameRect(replacement.dc,ref overlay,panel);}adapted++;}
  var p=old.Pixels();var q=replacement.Pixels();int mismatch=0,oldPainted=0,newPainted=0,outside=0;
  for(int i=0;i<N*N;i++){bool x=(p[i]&0xffffff)!=SENTINEL,y=(q[i]&0xffffff)!=SENTINEL;if(x)oldPainted++;if(y)newPainted++;if(x!=y)mismatch++;if(y){int px=i%N,py=i/N;if(px<5||py<5||px>=5+w||py>=5+h)outside++;if(newOk&&w>=2*depth&&h>=2*depth&&(q[i]&0xffffff)!=0x434b57&&(q[i]&0xffffff)!=0x262b32)throw new Exception("Uncovered native bright pixel");}}
  if(a.ToString()!=b.ToString()||oldOk!=newOk)throw new Exception("Return/RECT mutation mismatch");
  if(mismatch>0)throw new Exception("MASK DIFF edge="+edge+" "+w+"x"+h+" clip="+clip+" delta="+mismatch+" old="+oldPainted+" new="+newPainted+" outside="+outside);
  if(w>=2*depth&&h>=2*depth&&outside!=0)throw new Exception("Outside normal rectangle");tested++;
  POINT oldPos,newPos;GetCurrentPositionEx(old.dc,out oldPos);GetCurrentPositionEx(replacement.dc,out newPos);
  if(GetCurrentObject(old.dc,1)!=GetCurrentObject(replacement.dc,1)||GetCurrentObject(old.dc,2)!=GetCurrentObject(replacement.dc,2)||GetTextColor(old.dc)!=GetTextColor(replacement.dc)||GetBkColor(old.dc)!=GetBkColor(replacement.dc)||GetBkMode(old.dc)!=GetBkMode(replacement.dc)||oldPos.x!=newPos.x||oldPos.y!=newPos.y)throw new Exception("DC state changed");
 }
 using(var s=new Surface()){
  var timer=new System.Diagnostics.Stopwatch();
  for(int mode=0;mode<2;mode++){timer.Restart();for(int i=0;i<10000;i++){RECT r=new RECT(2,2,38,36);DrawEdge(s.dc,ref r,5,15);if(mode==1){FrameRect(s.dc,ref r,border);InflateRect(ref r,-1,-1);FrameRect(s.dc,ref r,panel);}}GdiFlush();timer.Stop();Console.WriteLine("BENCH 10000 "+(mode==0?"native":"native+overlay")+" frames: "+timer.ElapsedMilliseconds+" ms");}
 }
 DeleteObject(border);DeleteObject(panel);Console.WriteLine("PASS "+tested+" native+FrameRect overlay coverage/return/RECT cases; "+adapted+" adapted, others preserved native.");
 }
}
