using System;using System.Collections.Generic;using System.Diagnostics;using System.IO;using System.Runtime.InteropServices;using System.Web.Script.Serialization;
// Own hidden fixture windows only. No Foxmail discovery, hooks or interaction.
class TimerCadenceProbe {
 [StructLayout(LayoutKind.Sequential)]struct RECT{public int l,t,r,b;}
 [DllImport("kernel32",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateWaitableTimerEx(IntPtr attrs,string name,uint flags,uint access);
 [DllImport("kernel32",SetLastError=true)]static extern bool SetWaitableTimer(IntPtr timer,ref long due,int period,IntPtr routine,IntPtr arg,bool resume);
 [DllImport("kernel32")]static extern uint WaitForSingleObject(IntPtr h,uint timeout);
 [DllImport("kernel32")]static extern bool CancelWaitableTimer(IntPtr h);
 [DllImport("kernel32")]static extern bool CloseHandle(IntPtr h);
 [DllImport("user32",CharSet=CharSet.Unicode)]static extern IntPtr CreateWindowEx(uint ex,string cls,string title,uint style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr inst,IntPtr param);
 [DllImport("user32")]static extern bool DestroyWindow(IntPtr h);
 [DllImport("user32")]static extern int GetWindowLong(IntPtr h,int index);
 [DllImport("user32")]static extern bool IsWindow(IntPtr h);
 [DllImport("user32")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32")]static extern bool IsIconic(IntPtr h);
 [DllImport("user32")]static extern bool IsZoomed(IntPtr h);
 [DllImport("user32")]static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 static double Percentile(double[] a,double p){return a[Math.Min(a.Length-1,(int)Math.Ceiling(a.Length*p)-1)];}
 static int Main(){var windows=new List<IntPtr>();IntPtr timer=IntPtr.Zero;try{
  for(int i=0;i<3;i++){var h=CreateWindowEx(0,"STATIC","",0,0,0,600,400,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);if(h==IntPtr.Zero)throw new Exception("fixture creation failed");windows.Add(h);}
  timer=CreateWaitableTimerEx(IntPtr.Zero,null,2,0x001F0003);if(timer==IntPtr.Zero)throw new Exception("high-resolution timer unavailable: "+Marshal.GetLastWin32Error());
  long due=-10000;if(!SetWaitableTimer(timer,ref due,1,IntPtr.Zero,IntPtr.Zero,false))throw new Exception("timer start failed");
  var intervals=new double[10000];int count=0,over5=0,over10=0,over20=0,over100=0;long last=0;double costMax=0;long sink=0;
  var process=Process.GetCurrentProcess();double cpu0=process.TotalProcessorTime.TotalMilliseconds;var watch=Stopwatch.StartNew();
  while(watch.ElapsedMilliseconds<5000){if(WaitForSingleObject(timer,1000)!=0)throw new Exception("timer wait failed");long now=Stopwatch.GetTimestamp();
   if(last!=0){double gap=(now-last)*1000.0/Stopwatch.Frequency;if(count<intervals.Length)intervals[count++]=gap;if(gap>5)over5++;if(gap>10)over10++;if(gap>20)over20++;if(gap>100)over100++;}last=now;
   foreach(var h in windows){uint pid;RECT r;sink+=GetWindowLong(h,-16)+GetWindowLong(h,-20)+GetWindowThreadProcessId(h,out pid);sink+=IsWindow(h)?1:0;sink+=IsWindowVisible(h)?1:0;sink+=IsIconic(h)?1:0;sink+=IsZoomed(h)?1:0;if(GetWindowRect(h,out r))sink+=r.r-r.l;}
   costMax=Math.Max(costMax,(Stopwatch.GetTimestamp()-now)*1000.0/Stopwatch.Frequency);
  }
  double elapsed=watch.Elapsed.TotalMilliseconds,cpu=process.TotalProcessorTime.TotalMilliseconds-cpu0;Array.Resize(ref intervals,count);Array.Sort(intervals);double sum=0;foreach(double x in intervals)sum+=x;
  var result=new{scope="Three own hidden STATIC fixture windows; not Foxmail",timerMode="CREATE_WAITABLE_TIMER_HIGH_RESOLUTION periodic1ms",durationMs=elapsed,samples=count,minMs=intervals[0],meanMs=sum/count,p50Ms=Percentile(intervals,.50),p95Ms=Percentile(intervals,.95),p99Ms=Percentile(intervals,.99),maxMs=intervals[count-1],over5ms=over5,over10ms=over10,over20ms=over20,over100ms=over100,readLoopMaxMs=costMax,cpuCoreEquivalentPercent=cpu/elapsed*100,logicalProcessors=Environment.ProcessorCount,check=sink};
  string json=new JavaScriptSerializer().Serialize(result);File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"timer-cadence-probe.json"),json);Console.WriteLine(json);return 0;
 }catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}finally{if(timer!=IntPtr.Zero){CancelWaitableTimer(timer);CloseHandle(timer);}foreach(var h in windows)DestroyWindow(h);}}
}
