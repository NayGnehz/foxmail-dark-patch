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
class FoxmailFlashFrames : Form {
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
 class Frame : IDisposable { public Bitmap B; public double Ms,Interval,Light; public long H; public string Class,Region,Utc,PointClass; public Rectangle Rect; public int PX,PY; public object NativePoint; public void Dispose(){if(B!=null){B.Dispose();B=null;}} }
 class StreamState : IDisposable { public Queue<Frame> Ring=new Queue<Frame>(); public double Previous=-1,LastMs; public bool Armed=true; public void Dispose(){while(Ring.Count>0)Ring.Dequeue().Dispose();} }
 readonly List<Control> playbackControls=new List<Control>(); readonly Label status=new Label(); readonly PictureBox picture=new PictureBox(); readonly CheckBox slow=new CheckBox();
 readonly System.Windows.Forms.Timer play=new System.Windows.Forms.Timer();
 readonly List<string> saved=new List<string>(); readonly Dictionary<string,StreamState> streams=new Dictionary<string,StreamState>();
 Process target; IntPtr main; long startTicks; uint targetPid; volatile bool stop; Thread worker; string directory; long bytes; int events,index; List<Frame> pending; string pendingKey; int after; Exception failure;
 FoxmailFlashFrames(){Text="Foxmail 闪帧留存（外部屏幕采样）";ClientSize=new Size(860,640);StartPosition=FormStartPosition.CenterScreen;
  Controls.Add(new Label{Left=12,Top=8,Width=830,Height=58,Text="先点开始，再切回 Foxmail 重现：还原主窗口，或仅打开设置的“常用”页。\r\n仅留存主窗口左侧窄栏/顶部工具栏、设置客户区；请勿在设置中切到账号等隐私页。\r\n最长90秒，名义60帧/秒（实际间隔见JSON）。完成后可逐帧停留，无需重启Foxmail。"});
  var begin=new Button{Left=12,Top=72,Width=120,Text="开始"};var finish=new Button{Left=140,Top=72,Width=120,Text="完成保存"};var prev=new Button{Left=268,Top=72,Width=75,Text="上一帧"};var next=new Button{Left=351,Top=72,Width=75,Text="下一帧"};
  playbackControls.AddRange(new Control[]{prev,next,slow});slow.SetBounds(440,76,250,25);slow.Text="约1000倍慢放（跳过未采样空档）";Controls.AddRange(new Control[]{begin,finish,prev,next,slow});
  status.SetBounds(12,106,835,50);Controls.Add(status);picture.SetBounds(12,160,835,465);picture.SizeMode=PictureBoxSizeMode.Zoom;picture.BackColor=Color.FromArgb(35,35,35);Controls.Add(picture);
  begin.Click+=(s,e)=>{if(worker!=null&&worker.IsAlive)return;try{if(!Connect()){status.Text="未找到唯一、路径和类别均匹配的Foxmail主窗口。";return;}ClearState();directory=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"flash-frames-"+DateTime.Now.ToString("yyyyMMdd-HHmmss-fff")+"-"+Guid.NewGuid().ToString("N").Substring(0,6));Directory.CreateDirectory(directory);stop=false;begin.Enabled=false;slow.Checked=false;foreach(var control in playbackControls)control.Enabled=false;status.Text="采样中；请切回Foxmail重现。90秒后自动保存。";worker=new Thread(()=>RunCapture());worker.IsBackground=true;worker.Start();}catch(Exception ex){status.Text=ex.Message;}};
  finish.Click+=(s,e)=>{stop=true;status.Text="正在完成保存…";};prev.Click+=(s,e)=>ShowFrame(index-1);next.Click+=(s,e)=>ShowFrame(index+1);
  play.Tick+=(s,e)=>{if(saved.Count>0)ShowFrame((index+1)%saved.Count);};slow.CheckedChanged+=(s,e)=>{play.Enabled=slow.Checked&&saved.Count>0;};
  FormClosing+=(s,e)=>{stop=true;if(worker!=null&&worker.IsAlive){e.Cancel=true;status.Text="正在停止采样，请保存完成后关闭。";}else{ClearState();if(target!=null)target.Dispose();}};
  Tag=begin;
 }
 void ClearState(){play.Stop();if(picture.Image!=null){picture.Image.Dispose();picture.Image=null;}foreach(var s in streams.Values)s.Dispose();streams.Clear();if(pending!=null){foreach(var f in pending)f.Dispose();pending=null;}saved.Clear();events=0;bytes=0;failure=null;index=0;}
 bool Connect(){if(target!=null){target.Dispose();target=null;}var candidates=new List<Tuple<Process,IntPtr>>();foreach(var p in Process.GetProcessesByName("Foxmail深色")){bool kept=false;try{if(!String.Equals(Path.GetFullPath(p.MainModule.FileName),TargetPath,StringComparison.OrdinalIgnoreCase)||p.HasExited)continue;EnumWindows((h,a)=>{uint id;GetWindowThreadProcessId(h,out id);if(id==(uint)p.Id&&GetAncestor(h,2)==h&&ClassOf(h)==MainClass){candidates.Add(Tuple.Create(p,h));kept=true;}return true;},IntPtr.Zero);}catch{}finally{if(!kept)p.Dispose();}}if(candidates.Count!=1){foreach(var c in candidates)c.Item1.Dispose();return false;}target=candidates[0].Item1;main=candidates[0].Item2;targetPid=(uint)target.Id;startTicks=target.StartTime.ToUniversalTime().Ticks;return true;}
 bool Identity(IntPtr h,string cls){try{uint id;return !target.HasExited&&target.StartTime.ToUniversalTime().Ticks==startTicks&&GetWindowThreadProcessId(h,out id)!=0&&id==targetPid&&GetAncestor(h,2)==h&&ClassOf(h)==cls;}catch{return false;}}
 static bool TargetVisible(IntPtr h){int cloaked=0;try{DwmGetWindowAttribute(h,14,out cloaked,4);}catch{}return IsWindowVisible(h)&&!IsIconic(h)&&cloaked==0;}
 static object NativePointInfo(IntPtr h){var chain=new List<object>();for(int i=0;i<4&&h!=IntPtr.Zero;i++,h=GetParent(h)){uint brush=GetClassLong(h,-10);Brush value=new Brush();bool readable=brush>31&&GetBrushObject(new IntPtr(unchecked((int)brush)),12,out value)==12;if(!readable)value=new Brush();chain.Add(new{hwnd=h.ToInt64(),windowClass=ClassOf(h),exStyle=GetWindowLong(h,-20),classStyle=GetClassLong(h,-26),backgroundBrush=brush,systemColorIndex=brush>0&&brush<=31?(int)brush-1:-1,systemColor=brush>0&&brush<=31?GetSysColor((int)brush-1):0,brushReadable=readable,brushStyle=value.Style,brushColor=value.Color});}return chain;}
 // Every sampled cell must belong to the target root. Reject partial occlusion too.
 static bool Uncovered(IntPtr h,Rectangle r){if(!SystemInformation.VirtualScreen.Contains(r))return false;for(int y=0;y<=6;y++)for(int x=0;x<=6;x++)if(GetAncestor(WindowFromPoint(new P(r.Left+(r.Width-1)*x/6,r.Top+(r.Height-1)*y/6)),2)!=h)return false;return true;}
 static double Detect(Bitmap b,out Point light){int n=0,hit=0;light=Point.Empty;for(int y=4;y<b.Height-4;y+=12)for(int x=4;x<b.Width-4;x+=12){n++;Color c=b.GetPixel(x,y);if(!Neutral(c))continue;bool uniform=true;for(int dy=-3;dy<=3&&uniform;dy+=3)for(int dx=-3;dx<=3;dx+=3){Color q=b.GetPixel(x+dx,y+dy);if(!Neutral(q)||Math.Abs(q.R-c.R)>10||Math.Abs(q.G-c.G)>10||Math.Abs(q.B-c.B)>10){uniform=false;break;}}if(uniform){hit++;light=new Point(x,y);}}return n==0?0:(double)hit/n;}
 static bool ShouldTrigger(bool armed,double previous,double current){return armed&&current>.05&&(previous<0||current-previous>.025);}
 bool PendingExpired(long active,double now){return pending!=null&&pending.Count>0&&(pending[0].H!=active||now-pending[pending.Count-1].Ms>250);}
 static bool Neutral(Color c){return Math.Min(c.R,Math.Min(c.G,c.B))>=75&&Math.Max(c.R,Math.Max(c.G,c.B))-Math.Min(c.R,Math.Min(c.G,c.B))<8;}
 static Frame Copy(Frame f){return new Frame{B=(Bitmap)f.B.Clone(),Ms=f.Ms,Interval=f.Interval,Light=f.Light,H=f.H,Class=f.Class,Region=f.Region,Utc=f.Utc,PointClass=f.PointClass,Rect=f.Rect,PX=f.PX,PY=f.PY,NativePoint=f.NativePoint};}
 static void Push(StreamState s,Frame f){s.Ring.Enqueue(f);while(s.Ring.Count>6)s.Ring.Dequeue().Dispose();}
 void Sample(IntPtr h,string cls,string name,Rectangle rect,Stopwatch clock){if(rect.Width<10||rect.Height<10||(long)rect.Width*rect.Height>1000000||!Uncovered(h,rect))return;string key=h.ToInt64()+":"+name;StreamState s;if(!streams.TryGetValue(key,out s)){s=new StreamState();streams.Add(key,s);}var f=new Frame{B=new Bitmap(rect.Width,rect.Height,PixelFormat.Format24bppRgb),H=h.ToInt64(),Class=cls,Region=name,Rect=rect};try{double now=clock.Elapsed.TotalMilliseconds;f.Ms=now;f.Interval=s.LastMs==0?0:now-s.LastMs;s.LastMs=now;f.Utc=DateTime.UtcNow.ToString("o");using(var g=Graphics.FromImage(f.B))g.CopyFromScreen(rect.Location,Point.Empty,rect.Size,CopyPixelOperation.SourceCopy);if(!Uncovered(h,rect)){f.Dispose();return;}Point light;f.Light=Detect(f.B,out light);f.PX=rect.Left+light.X;f.PY=rect.Top+light.Y;f.PointClass=f.Light>0?ClassOf(WindowFromPoint(new P(f.PX,f.PY))):"";f.NativePoint=f.Light>0?NativePointInfo(WindowFromPoint(new P(f.PX,f.PY))):null;
   bool trigger=ShouldTrigger(s.Armed,s.Previous,f.Light);
   if(pending!=null&&key==pendingKey){pending.Add(Copy(f));if(++after>=16)SavePending("automatic");}
   else if(pending==null&&events<MaxEvents&&trigger){pending=new List<Frame>();var old=s.Ring.ToArray();for(int i=Math.Max(0,old.Length-3);i<old.Length;i++)pending.Add(Copy(old[i]));pending.Add(Copy(f));pendingKey=key;after=0;s.Armed=false;}
   if(s.Previous>=0&&s.Previous-f.Light>.025)s.Armed=true;s.Previous=f.Light;Push(s,f);
  }catch{f.Dispose();throw;}}
 void RunCapture(){var clock=Stopwatch.StartNew();try{while(!stop&&clock.Elapsed.TotalSeconds<90&&events<MaxEvents&&bytes<MaxBytes){if(!Identity(main,MainClass))break;IntPtr active=GetAncestor(GetForegroundWindow(),2);string cls=ClassOf(active);if(PendingExpired(active.ToInt64(),clock.Elapsed.TotalMilliseconds))SavePending("root-transition-or-gap");if((cls==MainClass||cls==SettingsClass)&&Identity(active,cls)&&TargetVisible(active)){R r;P p=new P(0,0);if(GetClientRect(active,out r)&&ClientToScreen(active,ref p)){int w=r.Ri-r.L,ht=r.B-r.T;double scale=1;try{scale=GetDpiForWindow(active)/96.0;}catch{}if(scale<=0)scale=1;if(cls==MainClass){int side=Math.Min((int)(220*scale),(int)(w*.18));Sample(active,cls,"sidebar",new Rectangle(p.X,p.Y,side,ht),clock);Sample(active,cls,"toolbar",new Rectangle(p.X+side,p.Y,Math.Max(0,w-side),Math.Min(ht,(int)(85*scale))),clock);}else {int cw=Math.Min(w,1600),ch=Math.Min(ht,1200);int cx=p.X+(w-cw)/2,cy=p.Y+(ht-ch)/2;int half=cw/2;Sample(active,cls,"settings-common-left",new Rectangle(cx,cy,half,ch),clock);Sample(active,cls,"settings-common-right",new Rectangle(cx+half,cy,cw-half,ch),clock);}}}Thread.Sleep(16);}if(pending!=null)SavePending("finish-pending");
   if(events<MaxEvents){foreach(var pair in streams){if(pair.Value.Ring.Count==0)continue;pending=new List<Frame>();foreach(var f in pair.Value.Ring)pending.Add(Copy(f));pendingKey=pair.Key;SavePending("finish-candidate");if(events>=MaxEvents||bytes>=MaxBytes)break;}}
   WriteManifest();
  }catch(Exception ex){failure=ex;try{WriteManifest();}catch{}}finally{foreach(var s in streams.Values)s.Dispose();streams.Clear();if(pending!=null){foreach(var f in pending)f.Dispose();pending=null;}BeginInvoke((MethodInvoker)delegate{((Button)Tag).Enabled=true;foreach(var control in playbackControls)control.Enabled=true;status.Text=failure==null?"完成："+events+"组，"+saved.Count+"帧。目录："+directory:"采样停止："+failure.Message+"；已保存目录："+directory;if(saved.Count>0)ShowFrame(0);});}}
 void SavePending(string reason){if(pending==null)return;try{if(events>=MaxEvents)return;var encoded=new List<byte[]>();var meta=new List<object>();long total=0;int eventNumber=events+1;foreach(var f in pending){byte[] png;using(var m=new MemoryStream()){f.B.Save(m,ImageFormat.Png);png=m.ToArray();}encoded.Add(png);total+=png.Length;meta.Add(new{file="event-"+eventNumber.ToString("D2")+"-"+encoded.Count.ToString("D2")+".png",hwnd=f.H,windowClass=f.Class,region=f.Region,x=f.Rect.X,y=f.Rect.Y,width=f.Rect.Width,height=f.Rect.Height,utc=f.Utc,elapsedMs=f.Ms,intervalMs=f.Interval,lightFraction=f.Light,pointX=f.PX,pointY=f.PY,pointWindowClass=f.PointClass,nativePoint=f.NativePoint});}string json=new JavaScriptSerializer().Serialize(new{reason=reason,pid=targetPid,startTicks=startTicks,frames=meta});byte[] jsonBytes=new UTF8Encoding(false).GetBytes(json);if(bytes+total+jsonBytes.Length+65536>MaxBytes)return;for(int i=0;i<encoded.Count;i++){string path=Path.Combine(directory,"event-"+eventNumber.ToString("D2")+"-"+(i+1).ToString("D2")+".png");File.WriteAllBytes(path,encoded[i]);saved.Add(path);}File.WriteAllBytes(Path.Combine(directory,"event-"+eventNumber.ToString("D2")+".json"),jsonBytes);bytes+=total+jsonBytes.Length;events++;}finally{foreach(var f in pending)f.Dispose();pending=null;}}
 void WriteManifest(){File.WriteAllText(Path.Combine(directory,"session.json"),new JavaScriptSerializer().Serialize(new{targetPath=TargetPath,pid=targetPid,startTicks=startTicks,nominalIntervalMs=16,maxSeconds=90,maxEvents=MaxEvents,maxBytes=MaxBytes,events=events,pngFrames=saved.Count,dataBytes=bytes,error=failure==null?null:failure.Message}),new UTF8Encoding(false));}
 void ShowFrame(int n){if(saved.Count==0)return;index=Math.Max(0,Math.Min(saved.Count-1,n));if(picture.Image!=null)picture.Image.Dispose();using(var b=new Bitmap(saved[index]))picture.Image=new Bitmap(b);Text="Foxmail 闪帧留存 "+(index+1)+"/"+saved.Count+" — "+Path.GetFileName(saved[index]);double interval=16;try{string file=Path.GetFileNameWithoutExtension(saved[index]);int last=file.LastIndexOf('-');int frame=int.Parse(file.Substring(last+1))-1;string json=File.ReadAllText(Path.Combine(directory,file.Substring(0,last)+".json"));var root=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(json);var frames=(System.Collections.ArrayList)root["frames"];interval=Convert.ToDouble(((Dictionary<string,object>)frames[frame])["intervalMs"]);}catch{}play.Interval=(int)Math.Min(int.MaxValue,Math.Max(1000,(interval>0&&interval<=250?interval:16)*1000));}
 static int SelfTest(){bool ok=ShouldTrigger(true,-1,.2)&&!ShouldTrigger(true,.2,.2)&&!ShouldTrigger(false,-1,.2);Point p;using(var dark=new Bitmap(120,120)){using(var g=Graphics.FromImage(dark))g.Clear(Color.FromArgb(30,30,30));ok&=Detect(dark,out p)==0;foreach(int value in new[]{94,215,255}){using(var g=Graphics.FromImage(dark)){g.Clear(Color.FromArgb(30,30,30));g.FillRectangle(new SolidBrush(Color.FromArgb(value,value,value)),12,12,70,70);}ok&=Detect(dark,out p)>.05;}using(var g=Graphics.FromImage(dark))g.Clear(Color.FromArgb(80,130,180));ok&=Detect(dark,out p)==0;}
  using(var state=new StreamState()){for(int i=0;i<20;i++)Push(state,new Frame{B=new Bitmap(10,10),Ms=i});ok&=state.Ring.Count==6&&state.Ring.Peek().Ms==14;}
  using(var form=new FoxmailFlashFrames()){form.directory=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"flash-frames-selftest-"+DateTime.Now.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(form.directory);form.pending=new List<Frame>{new Frame{B=new Bitmap(12,12),Class="synthetic",Region="test",Rect=new Rectangle(0,0,12,12)}};form.pending[0].H=123;form.pending[0].Ms=100;ok&=!form.PendingExpired(123,200)&&form.PendingExpired(124,200)&&form.PendingExpired(123,351);form.SavePending("self-test");ok&=form.events==1&&File.Exists(Path.Combine(form.directory,"event-01.json"));form.bytes=MaxBytes-1;form.pending=new List<Frame>{new Frame{B=new Bitmap(12,12)}};form.SavePending("over-byte-cap");ok&=form.events==1;form.bytes=0;form.events=MaxEvents;form.pending=new List<Frame>{new Frame{B=new Bitmap(12,12)}};form.SavePending("over-event-cap");ok&=form.events==MaxEvents;form.WriteManifest();File.WriteAllText(Path.Combine(form.directory,"self-test.json"),"{\"passed\":"+ok.ToString().ToLowerInvariant()+"}");}return ok?0:1;}
 [STAThread] static int Main(string[] args){SetProcessDPIAware();Application.EnableVisualStyles();if(args.Length==1&&args[0]=="--self-test")return SelfTest();Application.Run(new FoxmailFlashFrames());return 0;}
}
