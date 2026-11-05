using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

class FastCapture:IDisposable {
 public const string TargetPath=@"D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe";
 const int Layered=0x80000,Child=0x40000000;
 delegate bool EnumProc(IntPtr h,IntPtr p);
 delegate void EventProc(IntPtr hook,uint evt,IntPtr h,int obj,int child,uint thread,uint eventTime);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f,IntPtr p);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h,int i);
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll",SetLastError=true)] static extern bool GetLayeredWindowAttributes(IntPtr h,out uint key,out byte alpha,out uint flags);
 [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint min,uint max,IntPtr module,EventProc proc,uint pid,uint tid,uint flags);
 [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr h);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateWaitableTimerEx(IntPtr attrs,string name,uint flags,uint access);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetWaitableTimer(IntPtr timer,ref long due,int period,IntPtr routine,IntPtr arg,bool resume);
 [DllImport("kernel32.dll")] static extern bool CancelWaitableTimer(IntPtr h);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll")] static extern uint WaitForMultipleObjects(uint count,IntPtr[] handles,bool all,uint ms);
 [DllImport("winmm.dll")] static extern uint timeBeginPeriod(uint period);
 [DllImport("winmm.dll")] static extern uint timeEndPeriod(uint period);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr CreateWindowEx(int ex,string cls,string text,int style,int x,int y,int w,int h,IntPtr p,IntPtr menu,IntPtr inst,IntPtr arg);
 [DllImport("user32.dll")] public static extern bool DestroyWindow(IntPtr h);
 struct Rect {public int l,t,r,b;}
 public struct State:IEquatable<State> {public int style,ex,width,height,alpha,layerError;public uint key,flags;public bool visible,iconic,zoomed,rectOk,layerOk,exists;public bool Equals(State b){return style==b.style&&ex==b.ex&&width==b.width&&height==b.height&&alpha==b.alpha&&key==b.key&&flags==b.flags&&visible==b.visible&&iconic==b.iconic&&zoomed==b.zoomed&&rectOk==b.rectOk&&layerOk==b.layerOk&&exists==b.exists;}}
 struct Notice {public IntPtr h;public uint evt,eventTime;public long delivery;public string cls;public uint thread;}
 class Window {public IntPtr h;public string cls;public uint thread;public State last;public bool read;}
 public class Record {public double elapsedMs;public string cause,hwnd,className;public uint pid,threadId,eventTime;public double? deliveryMs;public State state;}
 public class Gap {public double fromMs,toMs,intervalMs;}
 readonly object gate=new object(); readonly List<Record> records=new List<Record>();readonly List<Gap> gaps=new List<Gap>();
 readonly ConcurrentQueue<Notice> notices=new ConcurrentQueue<Notice>(); readonly Dictionary<IntPtr,Window> windows=new Dictionary<IntPtr,Window>();
 readonly List<long> intervals=new List<long>(320000);readonly List<IntPtr> hooks=new List<IntPtr>();readonly List<string> errors=new List<string>();
 readonly ManualResetEvent stop=new ManualResetEvent(false);readonly long started=Stopwatch.GetTimestamp();
 readonly string startedAt=DateTimeOffset.Now.ToString("o"); readonly string output;
 Process process;uint pid;string identityTime;EventProc callback;Thread worker;Task discovery;IntPtr timer;bool period;int maxWindows=8;
 public string timerMode="notStarted",finishedReason,finishedAt;public int targetWindowCount;public long dropped;public bool truncated;public double maxLoopMs;
 long ticks;int saving;bool benchmark,disposed;double cpuStart;
 public FastCapture(string outputPath){output=outputPath;}
 double Ms(long v){return v*1000.0/Stopwatch.Frequency;}
 double Elapsed(){return Ms(Stopwatch.GetTimestamp()-started);}
 static bool Allowed(string cls){return cls=="TFoxMainFrm.UnicodeClass"||cls=="TOptionForm.UnicodeClass"||cls=="TApplication";}
 static string ClassOf(IntPtr h){var s=new StringBuilder(256);GetClassName(h,s,s.Capacity);return s.ToString();}
 bool Alive(){if(benchmark)return true;try{return process!=null&&!process.HasExited;}catch{return false;}}
 public bool Connect(out string error){
  var candidates=new List<Process>();foreach(Process p in Process.GetProcessesByName("Foxmail深色")){bool keep=false;try{if(!String.Equals(p.MainModule.FileName,TargetPath,StringComparison.OrdinalIgnoreCase))continue;IntPtr handle=p.Handle;if(p.HasExited)continue;bool main=false;EnumWindows((h,a)=>{uint id;GetWindowThreadProcessId(h,out id);if(id==(uint)p.Id&&(GetWindowLong(h,-16)&Child)==0&&ClassOf(h)=="TFoxMainFrm.UnicodeClass")main=true;return true;},IntPtr.Zero);if(main){candidates.Add(p);keep=true;}}catch{}finally{if(!keep)p.Dispose();}}
  if(candidates.Count!=1){foreach(Process p in candidates)p.Dispose();error="未能唯一确认指定路径的Foxmail主进程，未连接。";return false;}
  process=candidates[0];pid=(uint)process.Id;identityTime=process.StartTime.ToUniversalTime().ToString("o");callback=OnEvent;
  foreach(uint evt in new uint[]{0x8000,0x8001,0x8002,0x8003}){IntPtr h=SetWinEventHook(evt,evt,IntPtr.Zero,callback,pid,0,0);if(h!=IntPtr.Zero)hooks.Add(h);else errors.Add("WinEvent hook failed "+evt);}
  Discover();error=null;return true;
 }
 void OnEvent(IntPtr hook,uint evt,IntPtr h,int obj,int child,uint thread,uint eventTime){if(obj==0&&child==0&&h!=IntPtr.Zero)notices.Enqueue(new Notice{h=h,evt=evt,eventTime=eventTime,delivery=Stopwatch.GetTimestamp()});}
 void Discover(){if(!Alive())return;EnumWindows((h,a)=>{uint id;uint thread=GetWindowThreadProcessId(h,out id);if(id==pid&&(GetWindowLong(h,-16)&Child)==0){string cls=ClassOf(h);if(Allowed(cls))notices.Enqueue(new Notice{h=h,cls=cls,thread=thread,delivery=Stopwatch.GetTimestamp()});}return true;},IntPtr.Zero);}
 public void Start(IntPtr[] testWindows){benchmark=testWindows!=null;if(benchmark){pid=(uint)Process.GetCurrentProcess().Id;foreach(IntPtr h in testWindows){uint id;uint thread=GetWindowThreadProcessId(h,out id);windows[h]=new Window{h=h,thread=thread,cls="STATIC"};}}
  timer=CreateWaitableTimerEx(IntPtr.Zero,null,2,0x1F0003);timerMode="highResolutionWaitableTimer1ms";
  if(timer==IntPtr.Zero){timer=CreateWaitableTimerEx(IntPtr.Zero,null,0,0x1F0003);timerMode="ordinaryWaitableTimer1ms";period=timeBeginPeriod(1)==0;}
  if(timer==IntPtr.Zero)throw new Exception("无法创建采样定时器");long due=-10000;if(!SetWaitableTimer(timer,ref due,1,IntPtr.Zero,IntPtr.Zero,false))throw new Exception("无法启动采样定时器");
  cpuStart=Process.GetCurrentProcess().TotalProcessorTime.TotalMilliseconds;worker=new Thread(Loop){IsBackground=true,Name="Foxmail 1ms read-only sampler"};worker.Start();
  if(!benchmark)discovery=Task.Run(()=>{while(!stop.WaitOne(500))Discover();});
 }
 static State Read(IntPtr h){State s=new State();s.exists=IsWindow(h);if(!s.exists)return s;s.style=GetWindowLong(h,-16);s.ex=GetWindowLong(h,-20);s.visible=IsWindowVisible(h);s.iconic=IsIconic(h);s.zoomed=IsZoomed(h);Rect r;s.rectOk=GetWindowRect(h,out r);s.width=r.r-r.l;s.height=r.b-r.t;s.alpha=-1;
  if((s.ex&Layered)!=0){uint key,flags;byte alpha;s.layerOk=GetLayeredWindowAttributes(h,out key,out alpha,out flags);if(s.layerOk){s.alpha=alpha;s.key=key;s.flags=flags;}else s.layerError=Marshal.GetLastWin32Error();}return s;}
 void Add(Window w,State s,string cause,Notice? notice){var r=new Record{elapsedMs=Elapsed(),cause=cause,hwnd=w.h.ToInt64().ToString("X"),className=w.cls,pid=pid,threadId=w.thread,state=s};if(notice.HasValue){r.eventTime=notice.Value.eventTime;r.deliveryMs=Ms(notice.Value.delivery-started);}lock(gate){if(records.Count<5000)records.Add(r);else{truncated=true;dropped++;}}}
 void Drain(){Notice n;while(notices.TryDequeue(out n)){
  if(!Alive())continue;uint id;uint thread=GetWindowThreadProcessId(n.h,out id);if(id!=pid||(GetWindowLong(n.h,-16)&Child)!=0)continue;
  Window w;if(!windows.TryGetValue(n.h,out w)){string cls=n.cls??ClassOf(n.h);if(!Allowed(cls))continue;if(windows.Count>=maxWindows){lock(gate){truncated=true;dropped++;}continue;}w=new Window{h=n.h,cls=cls,thread=thread};windows[n.h]=w;}
  if(n.evt!=0){State s=Read(w.h);if(!w.read||!s.Equals(w.last)){w.last=s;w.read=true;Add(w,s,"event:"+n.evt.ToString("X"),n);}}
 }}
 void Loop(){long last=0;IntPtr[] handles={stop.SafeWaitHandle.DangerousGetHandle(),timer};while(true){uint wait=WaitForMultipleObjects(2,handles,false,1000);if(wait==0)break;if(wait!=1){lock(gate)errors.Add("Wait failed or timed out: "+wait);continue;}
  long now=Stopwatch.GetTimestamp();if(last!=0){long interval=now-last;lock(gate){intervals.Add(interval);if(Ms(interval)>10&&gaps.Count<200)gaps.Add(new Gap{fromMs=Ms(last-started),toMs=Ms(now-started),intervalMs=Ms(interval)});}}last=now;Interlocked.Increment(ref ticks);
  Drain();if(!Alive()){stop.Set();break;}
  // Window list is private to this worker; only primitives are read for unchanged windows.
  List<IntPtr> remove=null;foreach(Window w in windows.Values){uint id;uint thread=GetWindowThreadProcessId(w.h,out id);State state=(id==pid&&thread==w.thread)?Read(w.h):new State();if(!w.read||!state.Equals(w.last)){w.last=state;w.read=true;Add(w,state,"poll",null);}if(!state.exists){if(remove==null)remove=new List<IntPtr>();remove.Add(w.h);}}
  if(remove!=null)foreach(IntPtr h in remove)windows.Remove(h);targetWindowCount=windows.Count;double cost=Ms(Stopwatch.GetTimestamp()-now);if(cost>maxLoopMs)maxLoopMs=cost;
 }}
 public object Stats(){long[] data;lock(gate)data=intervals.ToArray();Array.Sort(data);double[] percent=new double[5];if(data.Length>0){percent[0]=Ms(data[0]);percent[1]=Ms(data[(int)((data.Length-1)*.5)]);percent[2]=Ms(data[(int)((data.Length-1)*.95)]);percent[3]=Ms(data[(int)((data.Length-1)*.99)]);percent[4]=Ms(data[data.Length-1]);}int gt5=0,gt10=0,gt20=0,gt100=0;foreach(long d in data){double m=Ms(d);if(m>5)gt5++;if(m>10)gt10++;if(m>20)gt20++;if(m>100)gt100++;}double cpu=Process.GetCurrentProcess().TotalProcessorTime.TotalMilliseconds-cpuStart;return new{timerMode=timerMode,samples=Interlocked.Read(ref ticks),intervalCount=data.Length,minMs=percent[0],medianMs=percent[1],p95Ms=percent[2],p99Ms=percent[3],maxMs=percent[4],over5ms=gt5,over10ms=gt10,over20ms=gt20,over100ms=gt100,readLoopMaxMs=maxLoopMs,targetWindowCount=targetWindowCount,cpuTimeMs=cpu,cpuRatioOneCore=cpu/Math.Max(1,Elapsed())};}
 public void SaveAsync(){if(Interlocked.CompareExchange(ref saving,1,0)!=0)return;Task.Run(()=>{try{Save();}finally{Interlocked.Exchange(ref saving,0);}});}
 public void Save(){Record[] r;Gap[] g;string[] e;lock(gate){r=records.ToArray();g=gaps.ToArray();e=errors.ToArray();}var serializedRecords=new List<object>();foreach(Record record in r){State s=record.state;bool attempted=(s.ex&Layered)!=0;serializedRecords.Add(new{elapsedMs=record.elapsedMs,cause=record.cause,hwnd=record.hwnd,className=record.className,pid=record.pid,threadId=record.threadId,eventTime=record.eventTime,deliveryMs=record.deliveryMs,state=new{exists=s.exists,style=s.style,exStyle=s.ex,visible=s.visible,iconic=s.iconic,zoomed=s.zoomed,width=s.width,height=s.height,rectSuccess=s.rectOk,layered=attempted,layeredGetterSuccess=s.layerOk,layeredGetterError=attempted&&!s.layerOk?(int?)s.layerError:null,alpha=s.layerOk?(int?)s.alpha:null,flags=s.layerOk?(uint?)s.flags:null,colorKey=s.layerOk?(uint?)s.key:null}});}var report=new{startedAt=startedAt,finishedAt=finishedAt,finishedReason=finishedReason,targetPath=benchmark?null:TargetPath,pid=pid,createdAt=identityTime,benchmark=benchmark,requestedIntervalMs=1,statistics=Stats(),recordLimit=5000,truncated=truncated,droppedRecords=dropped,largeGaps=g,errors=e,records=serializedRecords};string text=new JavaScriptSerializer{MaxJsonLength=int.MaxValue}.Serialize(report);File.WriteAllText(output,text,Encoding.UTF8);}
 public Task FinishAsync(string reason){return Task.Run(()=>{stop.Set();if(worker!=null)worker.Join();if(discovery!=null)discovery.Wait();finishedReason=reason;finishedAt=DateTimeOffset.Now.ToString("o");while(Volatile.Read(ref saving)!=0)Thread.Sleep(5);Save();});}
 public void Dispose(){if(disposed)return;disposed=true;stop.Set();if(worker!=null&&worker.IsAlive)worker.Join();foreach(IntPtr h in hooks)UnhookWinEvent(h);hooks.Clear();if(timer!=IntPtr.Zero){CancelWaitableTimer(timer);CloseHandle(timer);}if(period)timeEndPeriod(1);if(process!=null)process.Dispose();stop.Dispose();}
 public int Count{get{lock(gate)return records.Count;}}public double ElapsedMs{get{return Elapsed();}}
 public static int Test(int seconds){string path=System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Foxmail高频时序基准.json");var windows=new List<IntPtr>();try{for(int i=0;i<3;i++){IntPtr h=CreateWindowEx(0,"STATIC","",0,0,0,16,16,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);if(h==IntPtr.Zero)throw new Exception("create test window failed");windows.Add(h);}using(var c=new FastCapture(path)){c.Start(windows.ToArray());Thread.Sleep(seconds*1000);c.FinishAsync("benchmark").Wait();Console.WriteLine(new JavaScriptSerializer().Serialize(c.Stats()));if(c.Count!=3)throw new Exception("Expected exactly three initial changed states");}Console.WriteLine("SELF-TEST PASS: three own hidden windows, state equality, timer, report");return 0;}catch(Exception ex){Console.WriteLine(ex.ToString());return 1;}finally{foreach(IntPtr h in windows)DestroyWindow(h);}}
}
class FastTimingForm:Form{
 readonly Label status=new Label();readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer();FastCapture capture;bool ending,ended;long nextSave;
 public FastTimingForm(){Text="Foxmail 高频只读时序诊断";ClientSize=new Size(620,220);StartPosition=FormStartPosition.CenterScreen;Controls.Add(new Label{Left=16,Top=16,Width=585,Height=70,Text="目标1毫秒采样；无需关闭其它软件，无需退出Foxmail。\r\n请打开/关闭设置，再最小化/托盘恢复。实际间隔会写入报告。\r\n只读窗口样式与尺寸，不读取标题、邮件或像素。最多300秒。"});status.SetBounds(16,96,585,55);Controls.Add(status);var done=new Button{Left=420,Top=166,Width=180,Text="完成保存并结束"};Controls.Add(done);done.Click+=(s,e)=>Finish("user");
  capture=new FastCapture(System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Foxmail高频时序结果.json"));string error;if(capture.Connect(out error)){capture.Start(null);status.Text="已连接，正在采样。";timer.Interval=1000;timer.Tick+=(s,e)=>{status.Text="剩余 "+Math.Max(0,300-(int)(capture.ElapsedMs/1000))+" 秒；记录 "+capture.Count+" 条；目标窗口 "+capture.targetWindowCount+" 个。\r\n"+capture.timerMode;if(capture.ElapsedMs>=nextSave){capture.SaveAsync();nextSave=(long)capture.ElapsedMs+3000;}if(capture.ElapsedMs>=300000)Finish("timeout");};timer.Start();}else status.Text=error;
  FormClosing+=(s,e)=>{if(!ended){e.Cancel=true;Finish("windowClosed");}};
 }
 async void Finish(string reason){if(ending||ended)return;ending=true;timer.Stop();status.Text="正在结束采样并保存……";try{await capture.FinishAsync(reason);capture.Dispose();ended=true;Close();}catch(Exception ex){status.Text="保存失败："+ex.Message;ending=false;}}
 [STAThread] static int Main(string[] args){if(args.Length>0&&args[0]=="--self-test")return FastCapture.Test(1);if(args.Length>0&&args[0].StartsWith("--benchmark:")){int seconds;if(!int.TryParse(args[0].Substring(12),out seconds)||seconds<1||seconds>30)return 2;return FastCapture.Test(seconds);}Application.EnableVisualStyles();Application.Run(new FastTimingForm());return 0;}
}
