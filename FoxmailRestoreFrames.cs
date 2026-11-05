using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// External, screen-only recorder. No hooks, accessibility, process writes or suspension.
class FoxmailRestoreFrames : Form {
 const string TargetPath=@"D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe", MainClass="TFoxMainFrm.UnicodeClass", SettingsClass="TOptionForm.UnicodeClass";
 const long MaxBytes=200L*1024*1024; const int MaxEvents=20;
 delegate bool EnumProc(IntPtr h,IntPtr a);
 [StructLayout(LayoutKind.Sequential)] struct R { public int L,T,Ri,B; }
 [StructLayout(LayoutKind.Sequential)] struct P { public int X,Y; public P(int x,int y){X=x;Y=y;} }
 [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb,IntPtr a);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder b,int n);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h,uint f);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h,out R r);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out R r);
 [DllImport("dwmapi.dll",EntryPoint="DwmGetWindowAttribute")] static extern int DwmGetBounds(IntPtr h,int a,out R r,int size);
 [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h,ref P p);
 [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(P p);
 [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr h);
 [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr h);
 [DllImport("user32.dll")] static extern uint GetClassLong(IntPtr h,int index);
 [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h,int index);
 [DllImport("user32.dll")] static extern uint GetSysColor(int index);
 [StructLayout(LayoutKind.Sequential)] struct Brush { public uint Style,Color,Hatch; }
 [DllImport("gdi32.dll",EntryPoint="GetObjectW")] static extern int GetBrushObject(IntPtr brush,int count,out Brush value);
 [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h,int a,out int v,int size);
 static string ClassOf(IntPtr h){var b=new StringBuilder(256);GetClassName(h,b,256);return b.ToString();}
 class Frame : IDisposable { public Bitmap B; public double Ms,Interval,Light,EndMs; public long H; public string Class,Region,Utc,EndUtc,PointClass; public Rectangle Rect; public int PX,PY; public object NativePoint; public Rectangle WindowRect;public bool VisibleOnly;public int EventLimit;int refs=1;public Frame Retain(){refs++;return this;} public void Dispose(){if(--refs==0&&B!=null){B.Dispose();B=null;}} }
 class StreamState : IDisposable { public Queue<Frame> Ring=new Queue<Frame>(); public double Previous=-1,LastMs; public bool Armed=true;public int Capacity=6; public void Dispose(){while(Ring.Count>0)Ring.Dequeue().Dispose();} }
 readonly List<Control> playbackControls=new List<Control>(); readonly Label status=new Label(); readonly PictureBox picture=new PictureBox(); readonly CheckBox slow=new CheckBox();
 readonly System.Windows.Forms.Timer play=new System.Windows.Forms.Timer();
 readonly List<string> saved=new List<string>(); readonly Dictionary<string,StreamState> streams=new Dictionary<string,StreamState>();
 IntPtr ownWindow;bool restoreRequested;double burstStart;RestoreGate gate=new RestoreGate();readonly Dictionary<string,int> skips=new Dictionary<string,int>();string captureNotice="";int lastEventLimit=20; Process target; IntPtr main; long startTicks; uint targetPid; volatile bool stop; Thread worker; string directory; long bytes; int events,index; List<Frame> pending; string pendingKey; Exception failure;
 FoxmailRestoreFrames(){Text="主窗口恢复连续捕捉";ClientSize=new Size(1000,740);MinimumSize=new Size(870,520);StartPosition=FormStartPosition.CenterScreen;
  Controls.Add(new Label{Left=12,Top=8,Width=830,Height=58,Text="先点开始，再切回 Foxmail，最小化/还原主窗口2至3次，然后点完成保存。\r\n保存整个窗口（含标题边框及邮件内容）；请先隐藏不希望留存的邮件。\r\n最长90秒，目标间隔5毫秒（实际间隔见JSON）；恢复触发不依赖白色检测。完成后可逐帧停留，无需重启Foxmail。"});
  var begin=new Button{Left=12,Top=72,Width=120,Text="开始"};var finish=new Button{Left=140,Top=72,Width=120,Text="完成保存"};var prev=new Button{Left=268,Top=72,Width=75,Text="上一帧"};var next=new Button{Left=351,Top=72,Width=75,Text="下一帧"};
  playbackControls.AddRange(new Control[]{prev,next,slow});slow.SetBounds(440,76,250,25);slow.Text="约1000倍慢放（跳过未采样空档）";Controls.AddRange(new Control[]{begin,finish,prev,next,slow});
  status.SetBounds(12,106,835,50);Controls.Add(status);picture.SetBounds(12,160,835,465);picture.Anchor=AnchorStyles.Top|AnchorStyles.Bottom|AnchorStyles.Left|AnchorStyles.Right;picture.Width=ClientSize.Width-24;picture.Height=ClientSize.Height-175;picture.SizeMode=PictureBoxSizeMode.Zoom;picture.BackColor=Color.FromArgb(35,35,35);Controls.Add(picture);
  begin.Click+=(s,e)=>{if(worker!=null&&worker.IsAlive)return;try{if(!Connect()){status.Text="未找到唯一、路径和类别均匹配的Foxmail主窗口。";return;}ClearState();directory=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"restore-frames-"+DateTime.Now.ToString("yyyyMMdd-HHmmss-fff")+"-"+Guid.NewGuid().ToString("N").Substring(0,6));Directory.CreateDirectory(directory);stop=false;begin.Enabled=false;slow.Checked=false;foreach(var control in playbackControls)control.Enabled=false;status.Text="采样中；请切回Foxmail重现。90秒后自动保存。";worker=new Thread(()=>RunCapture());worker.IsBackground=true;worker.Start();}catch(Exception ex){status.Text=ex.Message;}};
  finish.Click+=(s,e)=>{stop=true;status.Text="正在完成保存…";};prev.Click+=(s,e)=>ShowFrame(index-1);next.Click+=(s,e)=>ShowFrame(index+1);
  play.Tick+=(s,e)=>{if(saved.Count>0)ShowFrame((index+1)%saved.Count);};slow.CheckedChanged+=(s,e)=>{play.Enabled=slow.Checked&&saved.Count>0;};
  FormClosing+=(s,e)=>{stop=true;if(worker!=null&&worker.IsAlive){e.Cancel=true;status.Text="正在停止采样，请保存完成后关闭。";}else{ClearState();if(target!=null)target.Dispose();}};
  Tag=begin;ownWindow=Handle;
 }
 void ClearState(){play.Stop();if(picture.Image!=null){picture.Image.Dispose();picture.Image=null;}foreach(var s in streams.Values)s.Dispose();streams.Clear();if(pending!=null){foreach(var f in pending)f.Dispose();pending=null;}saved.Clear();events=0;bytes=0;failure=null;index=0;}
 bool Connect(){if(target!=null){target.Dispose();target=null;}var candidates=new List<Tuple<Process,IntPtr>>();foreach(var p in Process.GetProcessesByName("Foxmail深色")){bool kept=false;try{if(!String.Equals(Path.GetFullPath(p.MainModule.FileName),TargetPath,StringComparison.OrdinalIgnoreCase)||p.HasExited)continue;EnumWindows((h,a)=>{uint id;GetWindowThreadProcessId(h,out id);if(id==(uint)p.Id&&GetAncestor(h,2)==h&&ClassOf(h)==MainClass){candidates.Add(Tuple.Create(p,h));kept=true;}return true;},IntPtr.Zero);}catch{}finally{if(!kept)p.Dispose();}}if(candidates.Count!=1){foreach(var c in candidates)c.Item1.Dispose();return false;}target=candidates[0].Item1;main=candidates[0].Item2;targetPid=(uint)target.Id;startTicks=target.StartTime.ToUniversalTime().Ticks;return true;}
 bool Identity(IntPtr h,string cls){try{uint id;return !target.HasExited&&target.StartTime.ToUniversalTime().Ticks==startTicks&&GetWindowThreadProcessId(h,out id)!=0&&id==targetPid&&GetAncestor(h,2)==h&&ClassOf(h)==cls;}catch{return false;}}
 static bool TargetVisible(IntPtr h){int cloaked=0;try{DwmGetWindowAttribute(h,14,out cloaked,4);}catch{}return IsWindowVisible(h)&&!IsIconic(h)&&cloaked==0;}
 static object NativePointInfo(IntPtr h){var chain=new List<object>();for(int i=0;i<4&&h!=IntPtr.Zero;i++,h=GetParent(h)){uint brush=GetClassLong(h,-10);Brush value=new Brush();bool readable=brush>31&&GetBrushObject(new IntPtr(unchecked((int)brush)),12,out value)==12;if(!readable)value=new Brush();chain.Add(new{hwnd=h.ToInt64(),windowClass=ClassOf(h),exStyle=GetWindowLong(h,-20),classStyle=GetClassLong(h,-26),backgroundBrush=brush,systemColorIndex=brush>0&&brush<=31?(int)brush-1:-1,systemColor=brush>0&&brush<=31?(uint?)GetSysColor((int)brush-1):null,brushReadable=readable,brushStyle=readable?(uint?)value.Style:null,brushColor=readable?(uint?)value.Color:null});}return chain;}
 // Every sampled cell must belong to the target root. Reject partial occlusion too.
 static bool Uncovered(IntPtr h,Rectangle r){if(!SystemInformation.VirtualScreen.Contains(r))return false;int insetX=Math.Min(10,r.Width/4),insetY=Math.Min(10,r.Height/4);for(int y=0;y<3;y++)for(int x=0;x<3;x++){int px=r.Left+insetX+(r.Width-1-2*insetX)*x/2,py=r.Top+insetY+(r.Height-1-2*insetY)*y/2;if(GetAncestor(WindowFromPoint(new P(px,py)),2)!=h)return false;}return true;}
 bool HelperCovers(Rectangle r){if(GetAncestor(GetForegroundWindow(),2)!=ownWindow||!IsWindowVisible(ownWindow)||IsIconic(ownWindow))return false;R helper;return GetWindowRect(ownWindow,out helper)&&r.IntersectsWith(Rectangle.FromLTRB(helper.L,helper.T,helper.Ri,helper.B));}
 static double Detect(Bitmap b,out Point light){return Detect(b,new[]{new Rectangle(0,0,b.Width,b.Height)},out light);}
 static byte[] scanBytes;
 static bool NeutralBytes(byte[] data,int i){int a=data[i],g=data[i+1],r=data[i+2];return Math.Min(a,Math.Min(g,r))>=75&&Math.Max(a,Math.Max(g,r))-Math.Min(a,Math.Min(g,r))<8;}
 static double Detect(Bitmap b,Rectangle[] regions,out Point light){
  light=Point.Empty;int count=0,hits=0;var bounds=new Rectangle(0,0,b.Width,b.Height);var locked=b.LockBits(bounds,ImageLockMode.ReadOnly,PixelFormat.Format24bppRgb);
  try{int stride=Math.Abs(locked.Stride);int length=stride*b.Height;if(scanBytes==null||scanBytes.Length<length)scanBytes=new byte[length];byte[] data=scanBytes;if(locked.Stride>0)Marshal.Copy(locked.Scan0,data,0,length);else for(int y=0;y<b.Height;y++)Marshal.Copy(IntPtr.Add(locked.Scan0,y*locked.Stride),data,y*stride,stride);
   foreach(var region in regions){var roi=Rectangle.Intersect(bounds,region);for(int y=roi.Top+4;y<roi.Bottom-4;y+=16)for(int x=roi.Left+4;x<roi.Right-4;x+=16){count++;int i=y*stride+x*3;if(!NeutralBytes(data,i))continue;bool uniform=true;for(int dy=-3;dy<=3&&uniform;dy+=3)for(int dx=-3;dx<=3;dx+=3){int j=(y+dy)*stride+(x+dx)*3;if(!NeutralBytes(data,j)||Math.Abs(data[j]-data[i])>10||Math.Abs(data[j+1]-data[i+1])>10||Math.Abs(data[j+2]-data[i+2])>10){uniform=false;break;}}if(uniform){hits++;light=new Point(x,y);}}}
  }finally{b.UnlockBits(locked);}return count==0?0:(double)hits/count;
 }
 static Rectangle[] DetectionRegions(string cls,Rectangle client,double scale){
  if(cls==SettingsClass)return new[]{client};int side=Math.Min((int)(220*scale),(int)(client.Width*.18)),top=Math.Min(client.Height,(int)(85*scale)),right=Math.Min(client.Width,(int)(24*scale));
  return new[]{new Rectangle(client.Left,client.Top,side,client.Height),new Rectangle(client.Left+side,client.Top,Math.Max(0,client.Width-side),top),new Rectangle(client.Right-right,client.Top+top,right,Math.Max(0,client.Height-top))};
 }
 static Rectangle WindowBounds(IntPtr h){R r;if(!GetWindowRect(h,out r))return Rectangle.Empty;R extended;try{if(DwmGetBounds(h,9,out extended,16)==0&&extended.Ri>extended.L&&extended.B>extended.T)r=extended;}catch{}return Rectangle.FromLTRB(r.L,r.T,r.Ri,r.B);}
 // At most one root's ring is retained. Reserve four full frames for capture, scan bytes and PNG encoding.
 static int FrameLimit(int width,int height){long frame=((width*3L+3)/4*4)*height;return (int)Math.Max(1,Math.Min(20,256L*1024*1024/Math.Max(1,frame)-4));}
 static bool ShouldTrigger(bool armed,double previous,double current){return armed&&current>.05&&(previous<0||current-previous>.025);}
 bool PendingExpired(long active,double now){return pending!=null&&pending.Count>0&&(pending[0].H!=active||now-pending[pending.Count-1].Ms>250);}
 static bool Neutral(Color c){return Math.Min(c.R,Math.Min(c.G,c.B))>=75&&Math.Max(c.R,Math.Max(c.G,c.B))-Math.Min(c.R,Math.Min(c.G,c.B))<8;}
 static Frame Copy(Frame f){return f.Retain();}
 static void Push(StreamState s,Frame f){s.Ring.Enqueue(f);while(s.Ring.Count>s.Capacity)s.Ring.Dequeue().Dispose();}
 void Sample(IntPtr h,string cls,Stopwatch clock){
  Rectangle whole=WindowBounds(h),rect=Rectangle.Intersect(whole,SystemInformation.VirtualScreen);if(rect.Width<10||rect.Height<10){Skip("invalidBounds");return;}if(HelperCovers(rect)){Skip("ownHelperForegroundOverlap");return;}if(!Uncovered(h,rect)){Skip("occludedBeforeCopy");return;}
  string key=h.ToInt64()+":full-window";StreamState state;if(!streams.TryGetValue(key,out state)){foreach(var old in streams.Values)old.Dispose();streams.Clear();state=new StreamState();streams.Add(key,state);}
  int limit=FrameLimit(rect.Width,rect.Height);lastEventLimit=limit;state.Capacity=Math.Min(6,Math.Max(1,limit-1));while(state.Ring.Count>state.Capacity)state.Ring.Dequeue().Dispose();
  R cr;P cp=new P(0,0);if(!GetClientRect(h,out cr)||!ClientToScreen(h,ref cp))return;double scale=1;try{scale=GetDpiForWindow(h)/96.0;}catch{}if(scale<=0)scale=1;
  var regions=DetectionRegions(cls,new Rectangle(cp.X-rect.Left,cp.Y-rect.Top,cr.Ri-cr.L,cr.B-cr.T),scale);
  var f=new Frame{B=new Bitmap(rect.Width,rect.Height,PixelFormat.Format24bppRgb),H=h.ToInt64(),Class=cls,Region="full-window",Rect=rect,WindowRect=whole,VisibleOnly=rect!=whole,EventLimit=limit};
  try{double now=clock.Elapsed.TotalMilliseconds;f.Ms=now;f.Interval=state.LastMs==0?0:now-state.LastMs;state.LastMs=now;f.Utc=DateTime.UtcNow.ToString("o");
   using(var g=Graphics.FromImage(f.B))g.CopyFromScreen(rect.Location,Point.Empty,rect.Size,CopyPixelOperation.SourceCopy);
   f.EndMs=clock.Elapsed.TotalMilliseconds;f.EndUtc=DateTime.UtcNow.ToString("o");if(!Identity(h,cls)||!Uncovered(h,rect)){f.Dispose();Skip("occludedOrIdentityAfterCopy");return;}
   Point light;f.Light=Detect(f.B,regions,out light);f.PX=rect.Left+light.X;f.PY=rect.Top+light.Y;if(f.Light>0){IntPtr leaf=WindowFromPoint(new P(f.PX,f.PY));f.PointClass=ClassOf(leaf);f.NativePoint=NativePointInfo(leaf);}
   if(f.VisibleOnly)captureNotice="窗口部分在屏幕外：仅保存可见部分，JSON标明原始边界。";
   bool trigger=restoreRequested;
   if(pending!=null&&key==pendingKey){pending.Add(Copy(f));if(pending.Count>=limit)SavePending("restore-burst-complete");}
   else if(pending==null&&events<MaxEvents&&trigger){pending=new List<Frame>();pending.Add(Copy(f));pendingKey=key;state.Armed=false;restoreRequested=false;burstStart=f.Ms;if(pending.Count>=limit)SavePending("automatic-memory-limit");}
   if(state.Previous>=0&&state.Previous-f.Light>.025)state.Armed=true;state.Previous=f.Light;Push(state,f);
  }catch{f.Dispose();throw;}
 }
 class RestoreGate {
  public string LastReason;bool first=true,wasVisible,wasForeground;double last=-10000;
  public bool Observe(bool visible,bool foreground,double now){string reason=first?"initial-visible":!wasVisible?"visibility-rise":"foreground-gain";bool edge=visible&&(first||!wasVisible||(!wasForeground&&foreground));first=false;wasVisible=visible;wasForeground=foreground;if(edge&&now-last>=500){last=now;LastReason=reason;return true;}return false;}
 }
 void Skip(string reason){int value;skips.TryGetValue(reason,out value);skips[reason]=value+1;}
 bool MainVisible(){if(!IsWindowVisible(main)){Skip("notVisible");return false;}if(IsIconic(main)){Skip("iconic");return false;}int cloaked;try{if(DwmGetWindowAttribute(main,14,out cloaked,4)==0&&cloaked!=0){Skip("cloaked");return false;}}catch{}return true;}
 static bool BurstDue(int count,int limit,double elapsed){if(count<Math.Max(1,limit-3))return true;int slot=count-Math.Max(1,limit-3);return elapsed>=(slot==0?75:slot==1?150:300);}
 void RunCapture(){var clock=Stopwatch.StartNew();double lastCapture=-1000;gate=new RestoreGate();restoreRequested=false;skips.Clear();try{
  while(!stop&&clock.Elapsed.TotalSeconds<90&&events<MaxEvents&&bytes<MaxBytes){double cycle=clock.Elapsed.TotalMilliseconds;
   if(!Identity(main,MainClass)){Skip("identityRejected");break;}bool visible=MainVisible(),foreground=GetAncestor(GetForegroundWindow(),2)==main;
   if(!foreground)Skip("notForegroundObserved");if(gate.Observe(visible,foreground,cycle)){Skip("trigger:"+gate.LastReason);if(pending!=null)SavePending("next-restore");restoreRequested=true;}
   if(!visible&&pending!=null)SavePending("main-hidden-during-burst");
   if(visible&&(restoreRequested||pending!=null)&&cycle-lastCapture>=5){if(pending==null||BurstDue(pending.Count,lastEventLimit,cycle-burstStart)){lastCapture=cycle;Sample(main,MainClass,clock);}else Skip("waiting-post-render-sample");}
   int remaining=(int)Math.Floor(3-(clock.Elapsed.TotalMilliseconds-cycle));if(remaining>0)Thread.Sleep(remaining);else Thread.Sleep(1);
  }if(pending!=null)SavePending("finish-pending");
   if(events<MaxEvents){foreach(var pair in streams){if(pair.Value.Ring.Count==0)continue;pending=new List<Frame>();foreach(var f in pair.Value.Ring)pending.Add(Copy(f));pendingKey=pair.Key;SavePending("finish-candidate");if(events>=MaxEvents||bytes>=MaxBytes)break;}}
   WriteManifest();
  }catch(Exception ex){failure=ex;try{WriteManifest();}catch{}}finally{foreach(var s in streams.Values)s.Dispose();streams.Clear();if(pending!=null){foreach(var f in pending)f.Dispose();pending=null;}BeginInvoke((MethodInvoker)delegate{((Button)Tag).Enabled=true;foreach(var control in playbackControls)control.Enabled=true;status.Text=failure==null?"完成："+events+"组，"+saved.Count+"帧。"+captureNotice+" 目录："+directory:"采样停止："+failure.Message+"；已保存目录："+directory;if(saved.Count>0)ShowFrame(0);});}}
 void SavePending(string reason){if(pending==null)return;try{if(events>=MaxEvents)return;var meta=new List<object>();int eventNumber=events+1;bool diskLimited=false;foreach(var f in pending){
   byte[] png;using(var m=new MemoryStream()){f.B.Save(m,ImageFormat.Png);png=m.ToArray();}if(bytes+png.Length+65536>MaxBytes){diskLimited=true;Skip("diskBudgetReached");stop=true;break;}
   string file="event-"+eventNumber.ToString("D2")+"-"+(meta.Count+1).ToString("D2")+".png",path=Path.Combine(directory,file);File.WriteAllBytes(path,png);bytes+=png.Length;saved.Add(path);
   meta.Add(new{file=file,hwnd=f.H,windowClass=f.Class,region=f.Region,x=f.Rect.X,y=f.Rect.Y,width=f.Rect.Width,height=f.Rect.Height,originalWindowX=f.WindowRect.X,originalWindowY=f.WindowRect.Y,originalWindowWidth=f.WindowRect.Width,originalWindowHeight=f.WindowRect.Height,visibleOnly=f.VisibleOnly,memoryFrameLimit=f.EventLimit,utc=f.Utc,captureEndUtc=f.EndUtc,elapsedMs=f.Ms,captureBeginMs=f.Ms,captureEndMs=f.EndMs,captureDurationMs=f.EndMs-f.Ms,intervalMs=f.Interval,lightFraction=f.Light,pointX=f.PX,pointY=f.PY,pointWindowClass=f.PointClass,nativePoint=f.NativePoint});
  }if(meta.Count>0){string json=new JavaScriptSerializer().Serialize(new{reason=reason,pid=targetPid,startTicks=startTicks,diskLimited=diskLimited,frames=meta});byte[] data=new UTF8Encoding(false).GetBytes(json);File.WriteAllBytes(Path.Combine(directory,"event-"+eventNumber.ToString("D2")+".json"),data);bytes+=data.Length;events++;}
 }finally{foreach(var f in pending)f.Dispose();pending=null;}}
 void WriteManifest(){File.WriteAllText(Path.Combine(directory,"session.json"),new JavaScriptSerializer().Serialize(new{targetPath=TargetPath,pid=targetPid,startTicks=startTicks,targetIntervalMs=5,pollIntervalMs=3,skipCounts=skips,maxSeconds=90,maxEvents=MaxEvents,maxBytes=MaxBytes,bitmapBudgetBytes=256L*1024*1024,lastMemoryFrameLimit=lastEventLimit,captureNotice=captureNotice,events=events,pngFrames=saved.Count,dataBytes=bytes,error=failure==null?null:failure.Message}),new UTF8Encoding(false));}
 void ShowFrame(int n){if(saved.Count==0)return;index=Math.Max(0,Math.Min(saved.Count-1,n));if(picture.Image!=null)picture.Image.Dispose();using(var b=new Bitmap(saved[index]))picture.Image=new Bitmap(b);Text="Foxmail 闪帧留存 "+(index+1)+"/"+saved.Count+" — "+Path.GetFileName(saved[index]);double interval=16;try{string file=Path.GetFileNameWithoutExtension(saved[index]);int last=file.LastIndexOf('-');int frame=int.Parse(file.Substring(last+1))-1;string json=File.ReadAllText(Path.Combine(directory,file.Substring(0,last)+".json"));var root=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(json);var frames=(System.Collections.ArrayList)root["frames"];interval=Convert.ToDouble(((Dictionary<string,object>)frames[frame])["intervalMs"]);}catch{}play.Interval=(int)Math.Min(int.MaxValue,Math.Max(1000,(interval>0&&interval<=250?interval:16)*1000));}
 static int SelfTest(){var edge=new RestoreGate();bool transition=edge.Observe(true,false,0)&&!edge.Observe(true,false,10)&&edge.Observe(true,true,600)&&!edge.Observe(true,true,610)&&!edge.Observe(false,false,1200)&&edge.Observe(true,false,1250);bool schedule=BurstDue(1,6,5)&&!BurstDue(3,6,50)&&BurstDue(3,6,75)&&!BurstDue(5,6,200)&&BurstDue(5,6,300);bool ok=transition&&schedule&&ShouldTrigger(true,-1,.2)&&!ShouldTrigger(true,.2,.2)&&!ShouldTrigger(false,-1,.2);Point p;using(var dark=new Bitmap(120,120)){using(var g=Graphics.FromImage(dark))g.Clear(Color.FromArgb(30,30,30));ok&=Detect(dark,out p)==0;foreach(int value in new[]{94,215,255}){using(var g=Graphics.FromImage(dark)){g.Clear(Color.FromArgb(30,30,30));g.FillRectangle(new SolidBrush(Color.FromArgb(value,value,value)),12,12,70,70);}ok&=Detect(dark,out p)>.05;}using(var g=Graphics.FromImage(dark))g.Clear(Color.FromArgb(80,130,180));ok&=Detect(dark,out p)==0;}
  using(var state=new StreamState()){for(int i=0;i<20;i++)Push(state,new Frame{B=new Bitmap(10,10),Ms=i});ok&=state.Ring.Count==6&&state.Ring.Peek().Ms==14;}
  using(var test=new Bitmap(800,600,PixelFormat.Format24bppRgb)){using(var g=Graphics.FromImage(test)){g.Clear(Color.FromArgb(30,30,30));g.FillRectangle(Brushes.White,220,100,530,480);}var rois=DetectionRegions(MainClass,new Rectangle(0,0,800,600),1);ok&=Detect(test,rois,out p)==0;using(var g=Graphics.FromImage(test))g.FillRectangle(Brushes.White,0,0,100,600);ok&=Detect(test,rois,out p)>.05;}ok&=FrameLimit(3840,2160)>=4&&FrameLimit(3840,2160)<20;
  using(var form=new FoxmailRestoreFrames()){form.directory=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"restore-frames-selftest-"+DateTime.Now.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(form.directory);form.pending=new List<Frame>{new Frame{B=new Bitmap(1024,768,PixelFormat.Format24bppRgb),Class="synthetic",Region="full-window",Rect=new Rectangle(5,10,1024,768),WindowRect=new Rectangle(5,10,1024,768)}};form.pending[0].H=123;form.pending[0].Ms=100;ok&=!form.PendingExpired(123,200)&&form.PendingExpired(124,200)&&form.PendingExpired(123,351);form.SavePending("self-test");ok&=form.events==1&&File.Exists(Path.Combine(form.directory,"event-01.json"));using(var check=new Bitmap(Path.Combine(form.directory,"event-01-01.png")))ok&=check.Width==1024&&check.Height==768;form.bytes=MaxBytes-1;form.pending=new List<Frame>{new Frame{B=new Bitmap(12,12)}};form.SavePending("over-byte-cap");ok&=form.events==1;form.bytes=0;form.events=MaxEvents;form.pending=new List<Frame>{new Frame{B=new Bitmap(12,12)}};form.SavePending("over-event-cap");ok&=form.events==MaxEvents;form.WriteManifest();File.WriteAllText(Path.Combine(form.directory,"self-test.json"),"{\"passed\":"+ok.ToString().ToLowerInvariant()+"}");}return ok?0:1;}
 [STAThread] static int Main(string[] args){SetProcessDPIAware();Application.EnableVisualStyles();if(args.Length==1&&args[0]=="--self-test")return SelfTest();Application.Run(new FoxmailRestoreFrames());return 0;}
}
