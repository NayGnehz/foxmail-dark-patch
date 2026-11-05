using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

class FoxmailWindowTiming : Form {
 const string TargetPath = @"D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe";
 const uint CHILD=0x40000000, LAYERED=0x80000;
 delegate bool EnumProc(IntPtr h, IntPtr p);
 delegate void EventProc(IntPtr hook,uint evt,IntPtr h,int obj,int child,uint thread,uint time);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc,IntPtr p);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h,int index);
 [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr h,int index,int value);
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect rect);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder name,int max);
 [DllImport("user32.dll",SetLastError=true)] static extern bool GetLayeredWindowAttributes(IntPtr h,out uint key,out byte alpha,out uint flags);
 [DllImport("user32.dll")] static extern bool SetLayeredWindowAttributes(IntPtr h,uint key,byte alpha,uint flags);
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SetWinEventHook(uint min,uint max,IntPtr mod,EventProc proc,uint pid,uint tid,uint flags);
 [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr hook);
 struct Rect { public int left,top,right,bottom; }
 class Identity { public int pid; public string path,createdAt; }
 readonly Stopwatch watch=Stopwatch.StartNew();
 readonly string startedAt=DateTimeOffset.Now.ToString("o");
 readonly List<Identity> identities=new List<Identity>();
 readonly HashSet<uint> pids=new HashSet<uint>();
 readonly Dictionary<uint,Process> targets=new Dictionary<uint,Process>();
 readonly List<object> processWindowStatus=new List<object>();
 readonly HashSet<IntPtr> known=new HashSet<IntPtr>();
 readonly Dictionary<IntPtr,string> previous=new Dictionary<IntPtr,string>();
 readonly List<object> records=new List<object>();
 readonly List<IntPtr> hooks=new List<IntPtr>();
 readonly List<string> errors=new List<string>();
 readonly JavaScriptSerializer json=new JavaScriptSerializer();
 readonly Timer timer=new Timer();
 readonly Label status=new Label();
 EventProc callback;
 long lastTick, nextEnum, nextSave, nextStatus; double maxInterval;
 bool truncated,finished; long dropped; string finishedAt,finishedReason;
 readonly string output=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Foxmail窗口时序结果.json");
 FoxmailWindowTiming() {
  Text="Foxmail 窗口时序诊断（只读）"; ClientSize=new Size(570,190); StartPosition=FormStartPosition.CenterScreen;
  var instructions=new Label {Left=18,Top=16,Width=535,Height=65,Text="打开/关闭设置，再最小化/托盘恢复；无需退出Foxmail。\r\n仅记录窗口样式、透明度和尺寸；不读取邮件或窗口标题。\r\n最多采集300秒，每3秒保存一次。"}; Controls.Add(instructions);
  status.SetBounds(18,86,535,45); Controls.Add(status);
  var done=new Button {Left=400,Top=140,Width=145,Text="完成并保存"}; done.Click+=(s,e)=>Finish("user"); Controls.Add(done);
  FindProcesses(); callback=OnEvent;
  foreach(uint pid in pids) foreach(uint evt in new uint[]{0x8000,0x8001,0x8002,0x8003}) {
   IntPtr h=SetWinEventHook(evt,evt,IntPtr.Zero,callback,pid,0,0);
   if(h!=IntPtr.Zero) hooks.Add(h); else errors.Add("SetWinEventHook failed: "+Marshal.GetLastWin32Error());
  }
  Enumerate(); Sample("initial"); Save();
  timer.Interval=15; timer.Tick+=(s,e)=>Tick(); if(pids.Count>0) timer.Start();
  status.Text=pids.Count==0?"未找到指定路径的Foxmail进程，未连接。可关闭本工具。":"已连接 "+pids.Count+" 个匹配进程。请操作Foxmail窗口。";
  FormClosing+=(s,e)=>{if(!finished) Finish("windowClosed");};
 }
 void FindProcesses() {
  foreach(Process p in Process.GetProcessesByName("Foxmail深色")) { bool retained=false; try {
   string path=p.MainModule.FileName;
   if(!String.Equals(Path.GetFullPath(path),Path.GetFullPath(TargetPath),StringComparison.OrdinalIgnoreCase)) continue;
   IntPtr processHandle=p.Handle;
   identities.Add(new Identity {pid=p.Id,path=path,createdAt=p.StartTime.ToUniversalTime().ToString("o")}); pids.Add((uint)p.Id);targets.Add((uint)p.Id,p);retained=true;
  }catch { }finally{if(!retained)p.Dispose();} }
  if(pids.Count==0) errors.Add("Target process not found at exact executable path");
 }
 bool Alive(Process p) {try{return !p.HasExited;}catch{return false;}}
 bool Target(IntPtr h) {uint pid; GetWindowThreadProcessId(h,out pid);Process p;return targets.TryGetValue(pid,out p)&&Alive(p);}
 void Enumerate() {
  var counts=new Dictionary<uint,int>();foreach(uint pid in pids)counts[pid]=0;
  EnumWindows((h,p)=>{if(Target(h)&&(((uint)GetWindowLong(h,-16)&CHILD)==0)){known.Add(h);uint pid;GetWindowThreadProcessId(h,out pid);if(counts.ContainsKey(pid))counts[pid]++;}return true;},IntPtr.Zero);
  processWindowStatus.Clear();foreach(var entry in targets){bool live=Alive(entry.Value);processWindowStatus.Add(new {pid=entry.Key,live=live,hasTopLevelWindows=live&&counts[entry.Key]>0,topLevelWindowCount=counts[entry.Key],observedAtElapsedMs=watch.ElapsedMilliseconds});}
 }
 void OnEvent(IntPtr hook,uint evt,IntPtr h,int obj,int child,uint thread,uint eventTime) {
  if(finished||h==IntPtr.Zero||obj!=0||child!=0) return;
  // Destroyed handles may no longer resolve to a PID: discard them and let sampling record disappearance.
  if(!Target(h)) return;
  if(((uint)GetWindowLong(h,-16)&CHILD)!=0) return;
  known.Add(h); CaptureState(h,"event:"+evt.ToString("X"));
 }
 object Read(IntPtr h) {
  uint pid; uint thread=GetWindowThreadProcessId(h,out pid); uint style=(uint)GetWindowLong(h,-16),ex=(uint)GetWindowLong(h,-20);
  Rect r; bool rectOk=GetWindowRect(h,out r); var cls=new StringBuilder(256); GetClassName(h,cls,cls.Capacity);
  uint key=0,flags=0; byte alpha=0; bool attempted=(ex&LAYERED)!=0,ok=false;
  int? error=null;if(attempted){ok=GetLayeredWindowAttributes(h,out key,out alpha,out flags);if(!ok)error=Marshal.GetLastWin32Error();}
  return new {hwnd=h.ToInt64().ToString("X"),pid=pid,threadId=thread,style=style,exStyle=ex,visible=IsWindowVisible(h),iconic=IsIconic(h),zoomed=IsZoomed(h),layered=attempted,layeredGetterAttempted=attempted,layeredGetterSuccess=ok,layeredGetterError=error,alpha=ok?(int?)alpha:null,flags=ok?(uint?)flags:null,colorKey=ok?(uint?)key:null,rectSuccess=rectOk,width=r.right-r.left,height=r.bottom-r.top,className=cls.ToString()};
 }
 void Add(object data) {if(records.Count<5000) records.Add(data);else {truncated=true;dropped++;}}
 void CaptureState(IntPtr h,string cause) {
  if(!IsWindow(h)||!Target(h)) {if(previous.ContainsKey(h)){Add(new {elapsedMs=watch.Elapsed.TotalMilliseconds,cause="disappeared",hwnd=h.ToInt64().ToString("X")});previous.Remove(h);}known.Remove(h);return;}
  object state=Read(h); string encoded=json.Serialize(state),old;
  if(!previous.TryGetValue(h,out old)||encoded!=old) {previous[h]=encoded;Add(new {elapsedMs=watch.Elapsed.TotalMilliseconds,cause=cause,state=state});}
 }
 void Sample(string cause) {foreach(IntPtr h in new List<IntPtr>(known)) CaptureState(h,cause);}
 void Tick() {
  long now=watch.ElapsedMilliseconds;if(lastTick!=0)maxInterval=Math.Max(maxInterval,now-lastTick);lastTick=now;
  if(now>=nextEnum){Enumerate();nextEnum=now+500;} Sample("poll");
  if(now>=300000){Finish("timeout");return;}if(now>=nextSave){Save();nextSave=now+3000;}
  if(now>=nextStatus){status.Text="剩余 "+Math.Max(0,(300000-now+999)/1000)+" 秒；记录 "+records.Count+" 条；已知顶层窗口 "+known.Count+" 个。";nextStatus=now+1000;}
 }
 void Save() {try {string text=json.Serialize(new {startedAt=startedAt,targetPath=TargetPath,identities=identities,processWindowStatus=processWindowStatus,elapsedMs=watch.Elapsed.TotalMilliseconds,requestedIntervalMs=15,actualMaxSampleIntervalMs=maxInterval,recordLimit=5000,truncated=truncated,droppedRecords=dropped,finishedAt=finishedAt,finishedReason=finishedReason,errors=errors,records=records});File.WriteAllText(output,text,Encoding.UTF8);}catch(Exception ex){status.Text="保存失败："+ex.Message;}}
 void Finish(string reason) {if(finished)return;timer.Stop();Enumerate();Sample("final");finished=true;finishedAt=DateTimeOffset.Now.ToString("o");finishedReason=reason;foreach(IntPtr h in hooks)UnhookWinEvent(h);hooks.Clear();Save();foreach(Process p in targets.Values)p.Dispose();targets.Clear();if(reason!="windowClosed")Close();}
 [STAThread] static int Main(string[] args) {
  if(args.Length>0&&args[0]=="--self-test") {using(var f=new Form()){IntPtr h=f.Handle;SetWindowLong(h,-20,GetWindowLong(h,-20)|(int)LAYERED);bool set=SetLayeredWindowAttributes(h,0,123,2);uint key,flags;byte alpha;bool ok=GetLayeredWindowAttributes(h,out key,out alpha,out flags);bool pass=set&&ok&&alpha==123&&(flags&2)!=0&&((uint)GetWindowLong(h,-20)&LAYERED)!=0;Console.WriteLine(pass?"SELF-TEST PASS: own hidden window style and alpha":"SELF-TEST FAIL");return pass?0:1;}}
  Application.EnableVisualStyles();Application.Run(new FoxmailWindowTiming());return 0;
 }
}
