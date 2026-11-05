using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// Measures only this probe's own drawing surfaces. Never opens other processes.
class PaintReadbackCost : Form {
 [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr h);
 [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr h,IntPtr dc);
 [DllImport("user32.dll")] static extern int FillRect(IntPtr dc,ref Rect r,IntPtr brush);
 [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
 [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleBitmap(IntPtr dc,int w,int h);
 [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr value);
 [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr value);
 [DllImport("gdi32.dll")] static extern IntPtr CreateSolidBrush(uint c);
 [DllImport("gdi32.dll")] static extern uint GetPixel(IntPtr dc,int x,int y);
 [DllImport("gdi32.dll")] static extern bool GdiFlush();
 [StructLayout(LayoutKind.Sequential)] struct Rect { public int left,top,right,bottom; }
 readonly List<object> results=new List<object>(); bool measured;
 PaintReadbackCost(){Text="绘制读取开销自测（自动结束）";ClientSize=new Size(450,100);StartPosition=FormStartPosition.CenterScreen;BackColor=Color.FromArgb(32,32,32);Shown+=(s,e)=>BeginInvoke(new Action(Measure));}
 void Measure(){if(measured)return;measured=true;IntPtr screen=GetDC(Handle),memory=IntPtr.Zero,bitmap=IntPtr.Zero,old=IntPtr.Zero,brush=IntPtr.Zero;string error=null;
  try {if(screen==IntPtr.Zero)throw new Exception("No own window DC");memory=CreateCompatibleDC(screen);bitmap=CreateCompatibleBitmap(screen,400,40);brush=CreateSolidBrush(0x202020);if(memory==IntPtr.Zero||bitmap==IntPtr.Zero||brush==IntPtr.Zero)throw new Exception("Surface creation failed");old=SelectObject(memory,bitmap);Sample("ownWindowDC",screen,brush,0);Sample("ownWindowDC",screen,brush,9);Sample("compatibleBitmap",memory,brush,0);Sample("compatibleBitmap",memory,brush,9);}
  catch(Exception ex){error=ex.Message;}finally {if(old!=IntPtr.Zero)SelectObject(memory,old);if(bitmap!=IntPtr.Zero)DeleteObject(bitmap);if(memory!=IntPtr.Zero)DeleteDC(memory);if(brush!=IntPtr.Zero)DeleteObject(brush);if(screen!=IntPtr.Zero)ReleaseDC(Handle,screen);}
  File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"audit-paint-readback-cost.json"),new JavaScriptSerializer().Serialize(new {at=DateTime.UtcNow.ToString("o"),scope="Only probe-owned 400x40 surfaces; not Foxmail timing",error=error,results=results}),System.Text.Encoding.UTF8);Close();
 }
 void Sample(string surface,IntPtr dc,IntPtr brush,int reads){var times=new List<double>();int invalid=0;Rect rect=new Rect{right=400,bottom=40};for(int run=0;run<35;run++){GdiFlush();var sw=Stopwatch.StartNew();FillRect(dc,ref rect,brush);for(int i=0;i<reads;i++)if(GetPixel(dc,10+40*i,15)==0xffffffff)invalid++;GdiFlush();sw.Stop();if(run>=5)times.Add(sw.Elapsed.TotalMilliseconds);}times.Sort();results.Add(new{surface=surface,readsPerPaint=reads,iterations=times.Count,medianMs=times[times.Count/2],maxMs=times[times.Count-1],invalidPixelCalls=invalid});}
 [STAThread] static void Main(){Application.Run(new PaintReadbackCost());}
}
