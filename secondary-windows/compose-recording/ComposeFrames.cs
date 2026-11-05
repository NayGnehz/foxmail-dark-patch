using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// External screen capture only. No accessibility, target messages, hooks, writes or suspension.
class ComposeFrames : Form {
 const string TargetPath=@"D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe", TargetClass="TFoxComposeForm.UnicodeClass";
 const string ExeHash="086e0c1d3cdcb204d0cd64db1e51b60aa86fa55d144ab530734fc783c94dbdf1";
 const long MaxBytes=256L*1024*1024, MaxMemory=96L*1024*1024;
 const int MaxGroups=12; const double BurstMs=1500, RequestedInterval=6;
 delegate bool EnumProc(IntPtr h,IntPtr a);
 [StructLayout(LayoutKind.Sequential)] struct R { public int L,T,Right,B; public Rectangle Rect {get{return Rectangle.FromLTRB(L,T,Right,B);}} }
 [StructLayout(LayoutKind.Sequential)] struct MBI {public IntPtr BaseAddress,AllocationBase;public uint AllocationProtect;public UIntPtr RegionSize;public uint State,Protect,Type;}
 [DllImport("user32")] static extern bool SetProcessDPIAware();
 [DllImport("user32")] static extern bool EnumWindows(EnumProc cb,IntPtr p);
 [DllImport("user32")] static extern bool EnumChildWindows(IntPtr h,EnumProc cb,IntPtr p);
 [DllImport("user32")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder b,int n);
 [DllImport("user32")] static extern IntPtr GetAncestor(IntPtr h,uint flags);
 [DllImport("user32")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32")] static extern IntPtr GetWindow(IntPtr h,uint command);
 [DllImport("user32")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32")] static extern bool IsIconic(IntPtr h);
 [DllImport("user32")] static extern bool IsWindow(IntPtr h);
 [DllImport("user32")] static extern bool GetWindowRect(IntPtr h,out R r);
 [DllImport("user32")] static extern IntPtr GetParent(IntPtr h);
 [DllImport("user32",EntryPoint="GetPropW")] static extern IntPtr GetProp(IntPtr h,IntPtr atom);
 [DllImport("dwmapi",EntryPoint="DwmGetWindowAttribute")] static extern int DwmBounds(IntPtr h,int a,out R r,int n);
 [DllImport("dwmapi",EntryPoint="DwmGetWindowAttribute")] static extern int DwmState(IntPtr h,int a,out int r,int n);
 [DllImport("kernel32",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32")] static extern bool ReadProcessMemory(IntPtr p,IntPtr address,byte[] b,int n,out IntPtr got);
 [DllImport("kernel32")] static extern UIntPtr VirtualQueryEx(IntPtr p,IntPtr address,out MBI b,UIntPtr n);
 [DllImport("winmm")] static extern uint timeBeginPeriod(uint period);
 [DllImport("winmm")] static extern uint timeEndPeriod(uint period);
 static IntPtr P(uint p){return new IntPtr(unchecked((int)p));} static uint U(IntPtr p){return unchecked((uint)p.ToInt32());}
 static string Hex(uint p){return "0x"+p.ToString("X8");}
 static string ClassOf(IntPtr h){var b=new StringBuilder(100);GetClassName(h,b,b.Capacity);return b.ToString();}
 static bool Visible(IntPtr h){int cloak;return IsWindowVisible(h)&&!IsIconic(h)&&DwmState(h,14,out cloak,4)==0&&cloak==0;}
 static Rectangle Bounds(IntPtr h){R r;if(DwmBounds(h,9,out r,16)!=0&&!GetWindowRect(h,out r))return Rectangle.Empty;return r.Rect;}
 static bool ValidBounds(Rectangle r){return r.Width>=32&&r.Height>=32&&r.Width<=16384&&r.Height<=16384&&SystemInformation.VirtualScreen.Contains(r);}
 // Conservatively reject every intersecting visible top-level window higher in Z order.
 // No point-grid gaps, clipping, partial-window ROI or white-pixel trigger.
 static bool Uncovered(IntPtr h,Rectangle r){if(!ValidBounds(r)||GetAncestor(GetForegroundWindow(),2)!=h||!Visible(h))return false;
  var seen=new HashSet<IntPtr>();for(IntPtr other=GetWindow(h,3);other!=IntPtr.Zero;other=GetWindow(other,3)){
   if(!seen.Add(other)||seen.Count>4096)return false;if(Visible(other)&&Bounds(other).IntersectsWith(r))return false;
  }return true;
 }
 class Edge {public bool Previous;public bool Observe(bool current){bool edge=current&&!Previous;Previous=current;return edge;}}
 class Packet : IDisposable {public Bitmap Image;public long RawBytes;public Dictionary<string,object> Data;public string File;public void Dispose(){if(Image!=null){Image.Dispose();Image=null;}}}
 class State {public Edge Edge=new Edge();public double Until,PreviousCapture=-1;public int Group,Sequence;public IntPtr Editor;}
 class Meter {public List<double> Intervals=new List<double>(),CopyTimes=new List<double>();public int Captured,Saved,Dropped;public long Bytes;}
 readonly Label status=new Label();readonly PictureBox picture=new PictureBox();readonly Button begin=new Button(),finish=new Button(),prev=new Button(),next=new Button();
 readonly List<string> saved=new List<string>();readonly List<object> frames=new List<object>(),changes=new List<object>();readonly Dictionary<string,long> skips=new Dictionary<string,long>();
 readonly Dictionary<IntPtr,State> states=new Dictionary<IntPtr,State>();readonly Meter meter=new Meter();
 BlockingCollection<Packet> queue;Thread captureThread,writerThread;volatile bool stop,running;volatile string error;string directory;Process target;uint pid,image;long startTicks;IntPtr process;int index,groups;long rawPending;Stopwatch clock;Numeric metadata;
 ComposeFrames(bool auto){Text="写信窗口连续帧留存";ClientSize=new Size(1040,760);StartPosition=FormStartPosition.CenterScreen;
  Controls.Add(new Label{Left=12,Top=8,Width=1000,Height=64,Text="记录完整写信／回复／转发窗口，含窗口中可见内容，仅保存在本机。\r\n点开始后切回 Foxmail，分别打开几次目标窗口；每次进入前台录1.5秒，持续前台不重复触发。\r\n最长90秒／12组／256MB；目标间隔6ms，实际吞吐与跳过次数见 session.json；录制不会延迟Foxmail显示。"});
  begin.SetBounds(12,80,110,30);begin.Text="开始";finish.SetBounds(130,80,110,30);finish.Text="完成保存";prev.SetBounds(250,80,100,30);prev.Text="上一帧";next.SetBounds(358,80,100,30);next.Text="下一帧";
  Controls.AddRange(new Control[]{begin,finish,prev,next});status.SetBounds(12,118,1000,44);Controls.Add(status);
  picture.SetBounds(12,166,1016,580);picture.Anchor=AnchorStyles.Top|AnchorStyles.Bottom|AnchorStyles.Left|AnchorStyles.Right;picture.SizeMode=PictureBoxSizeMode.Zoom;picture.BackColor=Color.FromArgb(32,32,32);Controls.Add(picture);
  finish.Enabled=false;
  begin.Click+=(s,e)=>StartCapture();finish.Click+=(s,e)=>{if(!running)return;finish.Enabled=false;stop=true;status.Text="正在停止采集并保存队列…";};prev.Click+=(s,e)=>ShowFrame(index-1);next.Click+=(s,e)=>ShowFrame(index+1);
  FormClosing+=(s,e)=>{if(running||(captureThread!=null&&captureThread.IsAlive)||(writerThread!=null&&writerThread.IsAlive)){stop=true;e.Cancel=true;status.Text="正在完成保存，请稍候。";}else{if(queue!=null){queue.Dispose();queue=null;}Cleanup();}};
  if(auto)Shown+=(s,e)=>BeginInvoke((MethodInvoker)StartCapture);
 }
 void Cleanup(){if(picture.Image!=null){picture.Image.Dispose();picture.Image=null;}if(process!=IntPtr.Zero){CloseHandle(process);process=IntPtr.Zero;}if(target!=null){target.Dispose();target=null;}}
 static string HashFile(string path){using(var f=File.OpenRead(path))using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(f)).Replace("-","").ToLowerInvariant();}
 bool Connect(){Cleanup();var mainPids=new HashSet<uint>();EnumWindows((h,a)=>{if(ClassOf(h)=="TFoxMainFrm.UnicodeClass"&&GetAncestor(h,2)==h){uint owner;GetWindowThreadProcessId(h,out owner);mainPids.Add(owner);}return true;},IntPtr.Zero);var found=new List<Process>();foreach(uint id in mainPids){Process p=null;bool keep=false;try{p=Process.GetProcessById((int)id);if(!p.HasExited&&String.Equals(Path.GetFullPath(p.MainModule.FileName),TargetPath,StringComparison.OrdinalIgnoreCase)){found.Add(p);keep=true;}}catch{}finally{if(!keep&&p!=null)p.Dispose();}}
  if(found.Count!=1){foreach(var p in found)p.Dispose();throw new Exception("未找到唯一的指定路径Foxmail进程。");}target=found[0];pid=(uint)target.Id;startTicks=target.StartTime.ToUniversalTime().Ticks;
  if(HashFile(TargetPath)!=ExeHash)throw new Exception("Foxmail版本与已验证1.3.2不同，停止录制。");image=U(target.MainModule.BaseAddress);process=OpenProcess(0x410,false,pid);if(process==IntPtr.Zero)throw new Exception("无法只读访问数值元数据。");
  metadata=new Numeric(this);metadata.Initialize();return true;
 }
 bool Identity(IntPtr h){try{uint owner;return !target.HasExited&&target.StartTime.ToUniversalTime().Ticks==startTicks&&GetWindowThreadProcessId(h,out owner)!=0&&owner==pid&&GetAncestor(h,2)==h&&ClassOf(h)==TargetClass;}catch{return false;}}
 void StartCapture(){if(running||(captureThread!=null&&captureThread.IsAlive)||(writerThread!=null&&writerThread.IsAlive))return;try{if(queue!=null){queue.Dispose();queue=null;}Connect();saved.Clear();frames.Clear();changes.Clear();states.Clear();skips.Clear();meter.Intervals.Clear();meter.CopyTimes.Clear();meter.Captured=meter.Saved=meter.Dropped=0;meter.Bytes=0;groups=0;rawPending=0;error=null;index=0;
  directory=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"compose-frames-"+DateTime.Now.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(directory);stop=false;queue=new BlockingCollection<Packet>(3);clock=Stopwatch.StartNew();
  running=true;begin.Enabled=prev.Enabled=next.Enabled=false;finish.Enabled=true;status.Text="录制中；请切回Foxmail复现。仅完整且未遮挡的目标写信窗口会留帧。";
  writerThread=new Thread(Encode);writerThread.IsBackground=true;writerThread.Start();captureThread=new Thread(Capture);captureThread.IsBackground=true;captureThread.Start();
 }catch(Exception ex){running=false;finish.Enabled=false;status.Text=ex.Message;Cleanup();}}
 void Skip(string key){long n;skips.TryGetValue(key,out n);skips[key]=n+1;}
 static object RectData(Rectangle r){return new int[]{r.X,r.Y,r.Width,r.Height};}
 object WindowData(IntPtr h){uint owner;uint tid=GetWindowThreadProcessId(h,out owner);return new{hwnd=Hex(U(h)),pid=owner,tid=tid,parent=Hex(U(GetParent(h))),visible=IsWindowVisible(h),rect=RectData(Bounds(h))};}
 void Capture(){bool preciseSleep=timeBeginPeriod(1)==0;try{double lastSample=-100;while(!stop&&clock.Elapsed.TotalSeconds<90){double now=clock.Elapsed.TotalMilliseconds;if(target.HasExited||target.StartTime.ToUniversalTime().Ticks!=startTicks){Skip("processIdentityLost");break;}
   var windows=new List<IntPtr>();EnumWindows((h,a)=>{uint owner;GetWindowThreadProcessId(h,out owner);if(owner==pid&&ClassOf(h)==TargetClass&&GetAncestor(h,2)==h)windows.Add(h);return true;},IntPtr.Zero);
   foreach(var pair in states)if(!windows.Contains(pair.Key)){pair.Value.Edge.Observe(false);pair.Value.Until=0;}
   foreach(IntPtr h in windows){State state;if(!states.TryGetValue(h,out state)){state=new State();states.Add(h,state);}bool active=Identity(h)&&Visible(h)&&GetAncestor(GetForegroundWindow(),2)==h;
    if(state.Edge.Observe(active)){if(groups<MaxGroups){state.Group=++groups;state.Sequence=0;state.PreviousCapture=-1;state.Until=now+BurstMs;state.Editor=IntPtr.Zero;changes.Add(new{ms=now,kind="foreground-visible-entry",group=state.Group,hwnd=Hex(U(h))});}}
    if(!active){if(state.Until>now){changes.Add(new{ms=now,kind="burst-ended-on-exit",group=state.Group});state.Until=0;}continue;}
    if(state.Until<=now||state.Group==0)continue;if(now-lastSample<RequestedInterval)continue;lastSample=now;Sample(h,state);
   }
   if(groups>=MaxGroups){bool running=false;foreach(var s in states.Values)if(s.Until>now)running=true;if(!running)break;}Thread.Sleep(1);
  }
 }catch(Exception ex){error=ex.GetType().Name+": "+ex.Message;}finally{if(preciseSleep)timeEndPeriod(1);queue.CompleteAdding();writerThread.Join();try{WriteSession();}catch(Exception ex){error=ex.Message;}try{BeginInvoke((MethodInvoker)delegate{running=false;finish.Enabled=false;begin.Enabled=prev.Enabled=next.Enabled=true;status.Text="完成："+groups+"组，"+meter.Saved+"帧，丢帧"+meter.Dropped+"。 "+(error??"")+" 目录："+directory;if(saved.Count>0)ShowFrame(0);});}catch(InvalidOperationException){running=false;}}}
 void Sample(IntPtr h,State state){Rectangle rect=Bounds(h);if(!ValidBounds(rect)){Skip("outOfScreenOrInvalidBounds");return;}if(!Uncovered(h,rect)){Skip("occludedOrNotForegroundBefore");return;}
  long raw=(long)rect.Width*rect.Height*4;if(raw>MaxMemory/2){Skip("singleFrameMemoryBound");return;}if(queue.Count>=3||Interlocked.Read(ref rawPending)+raw>MaxMemory){Interlocked.Increment(ref meter.Dropped);Skip("queueOrMemoryBackpressure");return;}
  var packet=new Packet{Image=new Bitmap(rect.Width,rect.Height,PixelFormat.Format24bppRgb),RawBytes=raw,Data=new Dictionary<string,object>()};bool queued=false;
  try{double beginMs=clock.Elapsed.TotalMilliseconds;using(var g=Graphics.FromImage(packet.Image))g.CopyFromScreen(rect.Location,Point.Empty,rect.Size,CopyPixelOperation.SourceCopy);double endMs=clock.Elapsed.TotalMilliseconds;
   if(!Identity(h)||Bounds(h)!=rect||!Uncovered(h,rect)){Skip("occlusionIdentityOrBoundsChangedAfter");return;}
   double metaStart=clock.Elapsed.TotalMilliseconds;object numeric=metadata.Sample(h,state);double metaEnd=clock.Elapsed.TotalMilliseconds;
   packet.Data["group"]=state.Group;packet.Data["sequence"]=++state.Sequence;packet.Data["hwnd"]=Hex(U(h));packet.Data["utc"]=DateTime.UtcNow.ToString("o");packet.Data["captureBeginMs"]=beginMs;packet.Data["captureEndMs"]=endMs;packet.Data["captureDurationMs"]=endMs-beginMs;packet.Data["intervalMs"]=state.PreviousCapture<0?(object)null:beginMs-state.PreviousCapture;packet.Data["metadataBeginMs"]=metaStart;packet.Data["metadataEndMs"]=metaEnd;packet.Data["rect"]=RectData(rect);packet.Data["originalResolution"]=true;packet.Data["numeric"]=numeric;
   packet.File="group-"+state.Group.ToString("D2")+"-frame-"+state.Sequence.ToString("D4")+".png";
   Interlocked.Add(ref rawPending,raw);if(queue.TryAdd(packet)){queued=true;meter.Captured++;meter.CopyTimes.Add(endMs-beginMs);if(state.PreviousCapture>=0)meter.Intervals.Add(beginMs-state.PreviousCapture);state.PreviousCapture=beginMs;}else{Interlocked.Add(ref rawPending,-raw);Interlocked.Increment(ref meter.Dropped);Skip("queueFullAtEnqueue");}
  }finally{if(!queued)packet.Dispose();}
 }
 void Encode(){try{foreach(var p in queue.GetConsumingEnumerable()){try{if(stop&&meter.Bytes>=MaxBytes){Interlocked.Increment(ref meter.Dropped);continue;}byte[] png;using(var m=new MemoryStream()){p.Image.Save(m,ImageFormat.Png);png=m.ToArray();}string line=new JavaScriptSerializer().Serialize(p.Data);long charge=png.Length+Encoding.UTF8.GetByteCount(line)+1024;
    if(meter.Bytes+charge>MaxBytes-1048576){stop=true;Interlocked.Increment(ref meter.Dropped);continue;}string path=Path.Combine(directory,p.File);File.WriteAllBytes(path,png);p.Data["file"]=p.File;p.Data["pngBytes"]=png.Length;frames.Add(p.Data);saved.Add(path);meter.Bytes+=charge;meter.Saved++;
   }finally{Interlocked.Add(ref rawPending,-p.RawBytes);p.Dispose();}}}catch(Exception ex){error="PNG保存失败："+ex.Message;stop=true;foreach(var p in queue.GetConsumingEnumerable()){Interlocked.Add(ref rawPending,-p.RawBytes);p.Dispose();}}}
 static object Distribution(List<double> values){if(values.Count==0)return new{count=0,medianMs=(double?)null,p99Ms=(double?)null,maxMs=(double?)null};var a=values.ToArray();Array.Sort(a);return new{count=a.Length,medianMs=(double?)a[a.Length/2],p99Ms=(double?)a[Math.Min(a.Length-1,(int)Math.Ceiling(a.Length*.99)-1)],maxMs=(double?)a[a.Length-1]};}
 void WriteSession(){var data=new{targetPath=TargetPath,pid=pid,startTicks=startTicks,exeSHA256=ExeHash,utc=DateTime.UtcNow.ToString("o"),elapsedMs=clock.Elapsed.TotalMilliseconds,requestedIntervalMs=RequestedInterval,burstMs=BurstMs,maxSeconds=90,maxGroups=MaxGroups,maxDiskBytes=MaxBytes,maxRawPendingBytes=MaxMemory,queueCapacity=3,groups=groups,captured=meter.Captured,saved=meter.Saved,dropped=meter.Dropped,dataBytesConservative=meter.Bytes,intervals=Distribution(meter.Intervals),copyDurations=Distribution(meter.CopyTimes),skips=skips,changes=changes,frames=frames,error=error,privacy="Only exact Compose foreground window screen bounds. Numeric fields only from read-only process. No titles/text/HTML/accessibility.",limitations="Capture checks visibility/foreground/full screen bounds and higher-Z rectangle occlusion before and after each copy; a change during CopyFromScreen can race these checks. No compositor-ready assertion. Numeric metadata is non-atomic and follows each copy. Actual intervals are measured, not promised."};
  var json=new JavaScriptSerializer{MaxJsonLength=32*1024*1024}.Serialize(data);File.WriteAllText(Path.Combine(directory,"session.json"),json,new UTF8Encoding(false));}
 void ShowFrame(int n){if(saved.Count==0)return;index=Math.Max(0,Math.Min(saved.Count-1,n));if(picture.Image!=null)picture.Image.Dispose();using(var b=new Bitmap(saved[index]))picture.Image=new Bitmap(b);Text="写信连续帧 "+(index+1)+"/"+saved.Count+" — "+Path.GetFileName(saved[index]);}

 // Deliberately restricted to verified VMT/instance layouts, fixed atoms and numeric fields.
 class Numeric {
  ComposeFrames f;uint gate,composeStats,allStats;public Numeric(ComposeFrames owner){f=owner;}
  byte[] Read(ulong a,int count){if(a<65536||a>uint.MaxValue||count<1||count>128||a+(uint)count>0x100000000UL)return null;MBI m;if(VirtualQueryEx(f.process,P((uint)a),out m,(UIntPtr)Marshal.SizeOf(typeof(MBI)))==UIntPtr.Zero||m.State!=0x1000||(m.Protect&0x101)!=0||a+(uint)count>(ulong)U(m.BaseAddress)+m.RegionSize.ToUInt64())return null;byte[] b=new byte[count];IntPtr got;if(!ReadProcessMemory(f.process,P((uint)a),b,count,out got)||got.ToInt64()!=count)return null;return b;}
  uint? R32(ulong a){var b=Read(a,4);return b==null?(uint?)null:BitConverter.ToUInt32(b,0);}byte? R8(ulong a){var b=Read(a,1);return b==null?(byte?)null:b[0];}
  bool Exact(uint self,uint rva,uint size){uint v=f.image+rva;return self>=65536&&R32(self)==v&&R32(v-76)==v&&R32(v-40)==size;}
  uint Self(IntPtr hwnd,uint rva,uint size){foreach(uint a in new uint[]{0xEF91B6,0xEF91B4,0xEF5B80,0xEF5B7E}){var b=Read((ulong)f.image+a,2);if(b==null)continue;ushort atom=BitConverter.ToUInt16(b,0);if(atom<0xc000)continue;uint self=U(GetProp(hwnd,P(atom)));if(Exact(self,rva,size)&&R32((ulong)self+0x180)==U(hwnd))return self;}return 0;}
  public void Initialize(){uint v=f.image+0x90AEB8;if(R32(v-76)!=v||R32(v-40)!=0x6e8)throw new Exception("Compose布局守卫失败。");
   foreach(ProcessModule m in f.target.Modules){if(!String.Equals(m.ModuleName,"FoxmailRevealGate.dll",StringComparison.OrdinalIgnoreCase))continue;if(!String.Equals(Path.GetDirectoryName(m.FileName),Path.GetDirectoryName(TargetPath),StringComparison.OrdinalIgnoreCase)||HashFile(m.FileName)!="c1821caffcdccc4f52e67f397208de70bb38728c16b447ad3bf159bcff936082")throw new Exception("门控DLL版本不匹配。");gate=U(m.BaseAddress);composeStats=gate+ExportRva(File.ReadAllBytes(m.FileName),"FxComposeGateStats");allStats=gate+ExportRva(File.ReadAllBytes(m.FileName),"FxGateStats");}
  }
  public object Sample(IntPtr hwnd,State state){var result=new Dictionary<string,object>();result["gate"]=Gate();uint self=Self(hwnd,0x90AEB8,0x6e8);if(self==0){result["status"]="compose-identity-unresolved";return result;}result["self"]=Hex(self);
   var timer=R32((ulong)self+0x430);if(timer.HasValue&&Exact(timer.Value,0x269CB0,0x44)&&R32((ulong)timer.Value+0x38)==f.image+0x918924&&R32((ulong)timer.Value+0x3c)==self){var en=R8((ulong)timer.Value+0x40);var interval=R32((ulong)timer.Value+0x30);if(en.HasValue&&en.Value<=1&&interval.HasValue&&interval.Value<=60000)result["timer"]=new{self=Hex(timer.Value),enabled=en.Value,intervalMs=interval.Value,timerHwnd=Hex(R32((ulong)timer.Value+0x34).GetValueOrDefault())};}
   var chrome=new List<object>();uint[] fields={0x41c,0x508,0x500,0x418},vmas={0x49F9F0,0x61DB24,0x49F9F0,0x4A0C50},sizes={0x37c,0x270,0x37c,0x260};
   for(int i=0;i<fields.Length;i++){var p=R32((ulong)self+fields[i]);if(!p.HasValue||!Exact(p.Value,vmas[i],sizes[i]))continue;var h=R32((ulong)p.Value+0x180);var style=R32((ulong)p.Value+0x50);uint owner;if(!h.HasValue||!style.HasValue||!IsWindow(P(h.Value))||GetWindowThreadProcessId(P(h.Value),out owner)==0||owner!=f.pid)continue;if(R32((ulong)self+fields[i])!=p||!Exact(p.Value,vmas[i],sizes[i]))continue;chrome.Add(new{field=Hex(fields[i]),controlStyle=style.Value,opaque=(style.Value&0x40)!=0,window=f.WindowData(P(h.Value))});}result["chrome"]=chrome;
   if(state.Editor==IntPtr.Zero||!IsWindow(state.Editor)){EnumChildWindows(hwnd,(h,a)=>{string c=ClassOf(h);if(c=="TFoxHTMLEditor"||c=="TFoxHTMLEditorBase"){state.Editor=h;return false;}return true;},IntPtr.Zero);}if(state.Editor!=IntPtr.Zero)result["editor"]=Editor(state.Editor);
   if(Self(hwnd,0x90AEB8,0x6e8)!=self||R32((ulong)self+0x430)!=timer){result.Clear();result["status"]="identity-changed-during-sample";}else result["status"]="validated-numeric-only";return result;
  }
  object Editor(IntPtr hwnd){uint self=Self(hwnd,0x7946F0,0x3d0);if(self==0)self=Self(hwnd,0x783760,0x370);if(self==0)return new{status="editor-identity-unresolved"};var loaded=R8((ulong)self+0x324);var host=R32((ulong)self+0x300);if(!loaded.HasValue||loaded.Value>1||!host.HasValue)return new{status="editor-fields-unreadable"};object window=null;
   if(host.Value!=0&&Exact(host.Value,0x766E08,0x224)){var h=R32((ulong)host.Value+0x180);uint owner;if(h.HasValue&&IsWindow(P(h.Value))&&GetWindowThreadProcessId(P(h.Value),out owner)!=0&&owner==f.pid)window=f.WindowData(P(h.Value));}
   if(R32((ulong)self+0x180)!=U(hwnd)||R8((ulong)self+0x324)!=loaded||R32((ulong)self+0x300)!=host||!(Exact(self,0x7946F0,0x3d0)||Exact(self,0x783760,0x370)))return new{status="editor-raced"};return new{status="validated",hwnd=Hex(U(hwnd)),loadEnd324=loaded.Value,host300=Hex(host.Value),hostWindow=window,notPresentationProof=true};}
  object Gate(){if(gate==0)return null;var c=Read(composeStats,16);var a=Read(allStats,68);if(c==null||a==null||BitConverter.ToUInt32(c,0)!=16||BitConverter.ToUInt32(c,4)!=1||BitConverter.ToUInt32(a,0)!=68||BitConverter.ToUInt32(a,4)!=1)return null;return new{composeCalls=BitConverter.ToUInt32(c,8),composeAcquired=BitConverter.ToUInt32(c,12),released=BitConverter.ToUInt32(a,40),redraws=BitConverter.ToUInt32(a,32),releaseFailures=BitConverter.ToUInt32(a,44),unwinds=BitConverter.ToUInt32(a,60),pendingRecovery=BitConverter.ToUInt32(a,64),nonAtomic=true};}
 }
 static uint ExportRva(byte[] b,string name){int pe=BitConverter.ToInt32(b,60),op=pe+24,so=op+BitConverter.ToUInt16(b,pe+20),count=BitConverter.ToUInt16(b,pe+6);Func<uint,int> raw=delegate(uint rva){for(int i=0;i<count;i++){int s=so+i*40;uint va=BitConverter.ToUInt32(b,s+12),size=BitConverter.ToUInt32(b,s+16);if(rva>=va&&rva<va+size)return checked((int)(BitConverter.ToUInt32(b,s+20)+rva-va));}throw new Exception("导出RVA越界。");};int ex=raw(BitConverter.ToUInt32(b,op+96));uint names=BitConverter.ToUInt32(b,ex+32),ord=BitConverter.ToUInt32(b,ex+36),func=BitConverter.ToUInt32(b,ex+28);for(int i=0;i<BitConverter.ToUInt32(b,ex+24);i++){int p=raw(BitConverter.ToUInt32(b,raw(names)+(i*4))),end=p;while(b[end]!=0)end++;if(Encoding.ASCII.GetString(b,p,end-p)==name){ushort index=BitConverter.ToUInt16(b,raw(ord)+i*2);return BitConverter.ToUInt32(b,raw(func)+index*4);}}throw new Exception("缺失门控统计导出。");}
 static int SelfTest(){bool ok=true;var checks=new List<string>();Action<bool,string> check=(v,s)=>{ok&=v;checks.Add((v?"PASS ":"FAIL ")+s);};var e=new Edge();check(!e.Observe(false)&&e.Observe(true)&&!e.Observe(true)&&!e.Observe(false)&&e.Observe(true),"foreground edge and rearm; no continuous retrigger");
  check(!ValidBounds(new Rectangle(-100000,-100000,100,100))&&ValidBounds(new Rectangle(SystemInformation.VirtualScreen.Left+10,SystemInformation.VirtualScreen.Top+10,100,100)),"full bounds rejects offscreen (no cropping)");
  using(var q=new BlockingCollection<Packet>(2)){check(q.TryAdd(new Packet())&&q.TryAdd(new Packet())&&!q.TryAdd(new Packet()),"finite queue rejects overflow");q.CompleteAdding();int n=0;foreach(var p in q.GetConsumingEnumerable()){n++;p.Dispose();}check(n==2,"queue drains after completion");}
  var dir=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"self-test-"+DateTime.Now.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(dir);var timings=new List<double>();var watch=Stopwatch.StartNew();double previous=-1;
  foreach(Color color in new[]{Color.Black,Color.White,Color.FromArgb(32,32,32)}){double start=watch.Elapsed.TotalMilliseconds;using(var b=new Bitmap(1024,768,PixelFormat.Format24bppRgb)){using(var g=Graphics.FromImage(b))g.Clear(color);string file=Path.Combine(dir,color.ToArgb()+".png");b.Save(file,ImageFormat.Png);using(var restored=new Bitmap(file))check(restored.Size==b.Size&&restored.GetPixel(20,20).ToArgb()==color.ToArgb(),"full-resolution black/white/dark bitmap roundtrip");}if(previous>=0)timings.Add(start-previous);previous=start;}
  using(var own=new Form()){own.ShowInTaskbar=false;own.StartPosition=FormStartPosition.Manual;own.Bounds=new Rectangle(-24000,-24000,200,120);own.Show();Application.DoEvents();check(!ValidBounds(Bounds(own.Handle)),"own offscreen fixture cannot pass capture bounds");own.Hide();}
  check((256L*1024*1024-1048576)+2048>MaxBytes-1048576,"disk budget reserves metadata");
  var metadata=new{captureBeginMs=1.0,captureEndMs=2.0,group=1,numeric=new{timer=new{enabled=0,intervalMs=200},notPresentationProof=true}};string json=new JavaScriptSerializer().Serialize(metadata);check(json.Contains("intervalMs")&&json.Contains("captureBeginMs"),"numeric/timestamp serialization");
  var report=new{passed=ok,checks=checks,syntheticOnly=true,foxmailOpened=false,screenCaptured=false,syntheticPngIntervals=Distribution(timings),elapsedMs=watch.Elapsed.TotalMilliseconds,note="Synthetic PNG throughput is not live screen capture throughput. Live median/p99/max and dropped/occlusion counts are written per session."};File.WriteAllText(Path.Combine(dir,"self-test.json"),new JavaScriptSerializer().Serialize(report),new UTF8Encoding(false));Console.WriteLine(new JavaScriptSerializer().Serialize(report));return ok?0:1;
 }
 [STAThread] static int Main(string[] args){SetProcessDPIAware();Application.EnableVisualStyles();if(args.Length==1&&args[0]=="--self-test")return SelfTest();if(args.Length==1&&args[0]=="--connect-test"){try{using(var f=new ComposeFrames(false)){try{f.Connect();File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"connection-check.json"),new JavaScriptSerializer().Serialize(new{passed=true,pid=f.pid,startTicks=f.startTicks,readOnly=true,screenCaptured=false}),new UTF8Encoding(false));}finally{f.Cleanup();}}return 0;}catch(Exception ex){Console.Error.WriteLine(ex.Message);return 2;}}Application.Run(new ComposeFrames(Array.IndexOf(args,"--auto-start")>=0));return 0;}
}

