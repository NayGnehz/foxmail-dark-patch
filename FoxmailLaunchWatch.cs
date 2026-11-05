using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Management;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

class LaunchWatchCore:IDisposable {
 public const string TargetPath=@"D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe";
 delegate bool EnumProc(IntPtr h,IntPtr p);
 [DllImport("user32.dll")]static extern bool EnumWindows(EnumProc f,IntPtr p);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")]static extern int GetWindowLong(IntPtr h,int i);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]static extern bool IsIconic(IntPtr h);
 struct Rect{public int l,t,r,b;}
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out Rect r);
 class Notice{public string kind,name,osEventTime;public uint pid,parent;public uint? exitStatus;public double deliveredMs;}
 class Identity{public int pid;public string name,path,createdAt,status,error;public bool targetPath;}
 readonly object gate=new object();readonly List<object> rows=new List<object>();readonly ConcurrentQueue<Notice> queue=new ConcurrentQueue<Notice>();
 readonly Dictionary<int,string> processStates=new Dictionary<int,string>();readonly Dictionary<string,string> windowStates=new Dictionary<string,string>();
 readonly Stopwatch clock=Stopwatch.StartNew();readonly string startedAt=DateTimeOffset.Now.ToString("o");readonly string output;readonly JavaScriptSerializer serializer=new JavaScriptSerializer{MaxJsonLength=int.MaxValue};
 readonly ManualResetEvent stop=new ManualResetEvent(false);Thread worker;ManagementEventWatcher startWatcher,stopWatcher;long previousPoll;double maxInterval;long polls;int saving;bool disposed;
 public string eventMode="notStarted",eventError,finishedAt,finishedReason;public int activeCount;public bool truncated;public long dropped;public double ElapsedMs{get{return clock.Elapsed.TotalMilliseconds;}}
 public LaunchWatchCore(string path){output=path;}
 static bool Allowed(string name){return String.Equals(name,"Foxmail.exe",StringComparison.OrdinalIgnoreCase)||String.Equals(name,"Foxmail深色.exe",StringComparison.OrdinalIgnoreCase);}
 void Add(object row){lock(gate){if(rows.Count<5000)rows.Add(row);else{truncated=true;dropped++;}}}
 void Event(object sender,EventArrivedEventArgs args){try{var e=args.NewEvent;string name=Convert.ToString(e["ProcessName"]);if(!Allowed(name))return;string os=null;try{os=DateTime.FromFileTimeUtc(Convert.ToInt64(e["TIME_CREATED"])).ToString("o");}catch{}uint parent=0;try{parent=Convert.ToUInt32(e["ParentProcessID"]);}catch{}string traceClass=e.ClassPath.ClassName;bool isStart=String.Equals(traceClass,"Win32_ProcessStartTrace",StringComparison.OrdinalIgnoreCase);bool isStop=String.Equals(traceClass,"Win32_ProcessStopTrace",StringComparison.OrdinalIgnoreCase);if(!isStart&&!isStop)return;uint? exitStatus=null;if(isStop){try{if(e["ExitStatus"]!=null)exitStatus=Convert.ToUInt32(e["ExitStatus"]);}catch{}}queue.Enqueue(new Notice{kind=isStart?"processStartTrace":"processStopTrace",name=name,pid=Convert.ToUInt32(e["ProcessID"]),parent=parent,exitStatus=exitStatus,osEventTime=os,deliveredMs=ElapsedMs});}catch(Exception ex){queue.Enqueue(new Notice{kind="eventDecodeError",name=ex.Message,deliveredMs=ElapsedMs});}}
 public void Start(){
  try{string filter=" WHERE ProcessName = 'Foxmail.exe' OR ProcessName = 'Foxmail深色.exe'";startWatcher=new ManagementEventWatcher("SELECT * FROM Win32_ProcessStartTrace"+filter);stopWatcher=new ManagementEventWatcher("SELECT * FROM Win32_ProcessStopTrace"+filter);startWatcher.EventArrived+=Event;stopWatcher.EventArrived+=Event;startWatcher.Start();stopWatcher.Start();eventMode="WMI StartTrace/StopTrace + 100ms polling";}catch(Exception ex){eventError=ex.Message;eventMode="100ms polling fallback; short-lived processes may be missed";CleanupWatchers();}
  Add(new{elapsedMs=ElapsedMs,kind="observerStarted",eventMode=eventMode,error=eventError,targetPath=TargetPath});worker=new Thread(Loop){IsBackground=true,Name="Foxmail launch observer"};worker.Start();
 }
 void CleanupWatchers(){foreach(ManagementEventWatcher w in new[]{startWatcher,stopWatcher})if(w!=null){try{w.Stop();}catch{}w.Dispose();}startWatcher=null;stopWatcher=null;}
 static Identity ReadIdentity(Process p){var x=new Identity{pid=p.Id,name=p.ProcessName+".exe",status="observed"};try{x.createdAt=p.StartTime.ToUniversalTime().ToString("o");}catch(Exception ex){x.error="startTime: "+ex.Message;}try{x.path=p.MainModule.FileName;x.targetPath=String.Equals(x.path,TargetPath,StringComparison.OrdinalIgnoreCase);}catch(Exception ex){x.error=(x.error??"")+" path: "+ex.Message;}try{if(p.HasExited)x.status="exitedDuringObservation";}catch{}return x;}
 void Poll(){var current=new Dictionary<int,string>();foreach(string name in new[]{"Foxmail","Foxmail深色"})foreach(Process p in Process.GetProcessesByName(name)){using(p){try{Identity identity=ReadIdentity(p);string state=serializer.Serialize(identity);current[identity.pid]=state;string old;if(!processStates.TryGetValue(identity.pid,out old)||old!=state)Add(new{elapsedMs=ElapsedMs,kind="processSnapshotChanged",process=identity});}catch(Exception ex){Add(new{elapsedMs=ElapsedMs,kind="processReadError",error=ex.Message});}}}
  foreach(var old in processStates)if(!current.ContainsKey(old.Key))Add(new{elapsedMs=ElapsedMs,kind="processNoLongerObserved",pid=old.Key,source="poll"});processStates.Clear();foreach(var item in current)processStates.Add(item.Key,item.Value);activeCount=current.Count;
  var currentWindows=new Dictionary<string,string>();EnumWindows((h,a)=>{var cls=new StringBuilder(256);GetClassName(h,cls,cls.Capacity);string name=cls.ToString();if(name!="TFoxMainFrm.UnicodeClass"&&name!="TApplication")return true;uint pid;uint thread=GetWindowThreadProcessId(h,out pid);if(!current.ContainsKey((int)pid))return true;int style=GetWindowLong(h,-16);if((style&0x40000000)!=0)return true;Rect r;bool rect=GetWindowRect(h,out r);string key=h.ToInt64().ToString("X");var state=new{hwnd=key,pid=pid,threadId=thread,className=name,visible=IsWindowVisible(h),iconic=IsIconic(h),style=(uint)style,exStyle=(uint)GetWindowLong(h,-20),rectSuccess=rect,width=r.r-r.l,height=r.b-r.t};string encoded=serializer.Serialize(state),old;currentWindows[key]=encoded;if(!windowStates.TryGetValue(key,out old)||old!=encoded)Add(new{elapsedMs=ElapsedMs,kind="windowChanged",window=state});return true;},IntPtr.Zero);
  foreach(var old in windowStates)if(!currentWindows.ContainsKey(old.Key))Add(new{elapsedMs=ElapsedMs,kind="windowNoLongerObserved",hwnd=old.Key});windowStates.Clear();foreach(var item in currentWindows)windowStates.Add(item.Key,item.Value);
 }
 void Drain(){Notice n;while(queue.TryDequeue(out n))Add(new{elapsedMs=ElapsedMs,kind=n.kind,pid=n.pid,parentPid=n.parent,name=n.name,exitStatus=n.exitStatus,osEventTime=n.osEventTime,deliveryMs=n.deliveredMs});}
 void Loop(){while(!stop.WaitOne(0)){long now=clock.ElapsedTicks;if(previousPoll!=0){double interval=(now-previousPoll)*1000.0/Stopwatch.Frequency;if(interval>maxInterval)maxInterval=interval;}previousPoll=now;polls++;try{Drain();Poll();}catch(Exception ex){Add(new{elapsedMs=ElapsedMs,kind="pollError",error=ex.Message});}if(stop.WaitOne(100))break;}Drain();}
 public void SaveAsync(){if(Interlocked.CompareExchange(ref saving,1,0)!=0)return;Task.Run(()=>{try{Save();}catch(Exception ex){lock(gate)eventError="save: "+ex.Message;}finally{Interlocked.Exchange(ref saving,0);}});}
 void Save(){object[] snapshot;lock(gate)snapshot=rows.ToArray();var report=new{startedAt=startedAt,finishedAt=finishedAt,finishedReason=finishedReason,targetPath=TargetPath,eventMode=eventMode,eventError=eventError,pollRequestedDelayMs=100,pollCount=polls,actualMaxPollIntervalMs=maxInterval,activeProcessCount=activeCount,rowLimit=5000,truncated=truncated,droppedRows=dropped,rows=snapshot};string text=new JavaScriptSerializer{MaxJsonLength=int.MaxValue}.Serialize(report);File.WriteAllText(output,text,Encoding.UTF8);}
 public Task Finish(string reason){return Task.Run(()=>{stop.Set();if(worker!=null)worker.Join();CleanupWatchers();Drain();finishedAt=DateTimeOffset.Now.ToString("o");finishedReason=reason;while(Volatile.Read(ref saving)!=0)Thread.Sleep(5);Save();});}
 public void Dispose(){if(disposed)return;disposed=true;stop.Set();if(worker!=null&&worker.IsAlive)worker.Join();CleanupWatchers();stop.Dispose();}
 public static int SelfTest(){using(Process p=Process.GetCurrentProcess())using(Form f=new Form()){Identity identity=ReadIdentity(p);IntPtr own=f.Handle;uint pid;GetWindowThreadProcessId(own,out pid);Rect rect=new Rect();bool ok=identity.pid==p.Id&&pid==(uint)p.Id&&GetWindowRect(own,out rect)&&!Allowed(identity.name)&&Allowed("Foxmail.exe")&&Allowed("Foxmail深色.exe");string json=new JavaScriptSerializer().Serialize(new{testProcess=identity,testWindow=new{width=rect.r-rect.l,height=rect.b-rect.t},kind="selfTest"});ok=ok&&json.Contains("selfTest");Console.WriteLine(ok?"SELF-TEST PASS: own process, hidden own window, process-name filter, serialization; no Foxmail access":"SELF-TEST FAIL");return ok?0:1;}}
}
class FoxmailLaunchWatch:Form {
 readonly Label status=new Label();readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer();LaunchWatchCore observer;bool ending,ended;
 public FoxmailLaunchWatch(){Text="Foxmail 启动时序观察（只读）";ClientSize=new Size(690,260);StartPosition=FormStartPosition.CenterScreen;Controls.Add(new Label{Left=16,Top=16,Width=655,Height=100,Text="保持记录，完全退出当前Foxmail，再按平常方式尝试启动。\r\n第一次双击后先等待10秒；仍未出现窗口，再第二次双击。最后保存结束。\r\n本工具不会启动Foxmail，不读取标题、邮件或启动参数。\r\n同时观察不同路径的Foxmail副本，最多记录300秒。"});status.SetBounds(16,125,655,65);Controls.Add(status);var done=new Button{Left=465,Top=205,Width=205,Text="保存并结束"};Controls.Add(done);done.Click+=(s,e)=>Finish("user");observer=new LaunchWatchCore(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Foxmail启动时序结果.json"));observer.Start();timer.Interval=1000;timer.Tick+=(s,e)=>{status.Text="观察到Foxmail进程 "+observer.activeCount+" 个；剩余 "+Math.Max(0,300-(int)(observer.ElapsedMs/1000))+" 秒。\r\n"+observer.eventMode;if(observer.eventError!=null)status.Text+="\r\n"+observer.eventError;observer.SaveAsync();if(observer.ElapsedMs>=300000)Finish("timeout");};timer.Start();FormClosing+=(s,e)=>{if(!ended){e.Cancel=true;Finish("windowClosed");}};}
 async void Finish(string reason){if(ending||ended)return;ending=true;timer.Stop();status.Text="正在保存……";try{await observer.Finish(reason);observer.Dispose();ended=true;Close();}catch(Exception ex){status.Text="保存失败："+ex.Message;ending=false;}}
 [STAThread]static int Main(string[] args){if(args.Length>0&&args[0]=="--self-test")return LaunchWatchCore.SelfTest();Application.EnableVisualStyles();Application.Run(new FoxmailLaunchWatch());return 0;}
}
