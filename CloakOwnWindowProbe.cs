using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
class CloakOwnWindowProbe {
 delegate IntPtr Proc(IntPtr h,uint m,IntPtr w,IntPtr l);
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct WC{public uint style;public Proc proc;public int ce,we;public IntPtr instance,icon,cursor,brush;public string menu,name;}
 [StructLayout(LayoutKind.Sequential)]struct Paint{public IntPtr dc;public int erase,l,t,r,b,restore,update;[MarshalAs(UnmanagedType.ByValArray,SizeConst=32)]public byte[] reserved;}
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern ushort RegisterClass(ref WC cls);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern bool UnregisterClass(string cls,IntPtr instance);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern IntPtr CreateWindowEx(int ex,string cls,string title,int style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr arg);
 [DllImport("user32.dll")]static extern bool DestroyWindow(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern IntPtr DefWindowProc(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")]static extern IntPtr BeginPaint(IntPtr h,out Paint paint);
 [DllImport("user32.dll")]static extern bool EndPaint(IntPtr h,ref Paint paint);
 [DllImport("user32.dll")]static extern bool ShowWindow(IntPtr h,int command);
 [DllImport("user32.dll")]static extern bool RedrawWindow(IntPtr h,IntPtr rect,IntPtr region,uint flags);
 [DllImport("user32.dll")]static extern int GetWindowLong(IntPtr h,int index);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("dwmapi.dll")]static extern int DwmSetWindowAttribute(IntPtr h,int attribute,ref int value,int size);
 [DllImport("dwmapi.dll")]static extern int DwmGetWindowAttribute(IntPtr h,int attribute,out uint value,int size);
 static IntPtr parent,child;static int parentPaint,childPaint;static Proc proc=WindowProc;
 static IntPtr WindowProc(IntPtr h,uint m,IntPtr w,IntPtr l){if(m==15){if(h==parent)parentPaint++;if(h==child)childPaint++;Paint p;BeginPaint(h,out p);EndPaint(h,ref p);return IntPtr.Zero;}return DefWindowProc(h,m,w,l);}
 static string name;
 static void Create(){name="CloakOwnProbe_"+Process.GetCurrentProcess().Id;var cls=new WC{name=name,proc=proc};if(RegisterClass(ref cls)==0)throw new Exception("RegisterClass failed");parent=CreateWindowEx(0x80,name,"",unchecked((int)0x80000000),-32000,-32000,180,100,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);if(parent==IntPtr.Zero)throw new Exception("Create parent failed");child=CreateWindowEx(0,name,"",0x50000000,4,4,90,40,parent,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);if(child==IntPtr.Zero)throw new Exception("Create child failed");}
 static int Set(IntPtr h,int value){return DwmSetWindowAttribute(h,13,ref value,4);}
 static object Snapshot(string stage){uint cloaked;int hr=DwmGetWindowAttribute(parent,14,out cloaked,4);return new{stage=stage,getHresult=hr,cloaked=cloaked,style=(uint)GetWindowLong(parent,-16),exStyle=(uint)GetWindowLong(parent,-20),visible=IsWindowVisible(parent),parentPaint=parentPaint,childPaint=childPaint};}
 static void Cleanup(){if(parent!=IntPtr.Zero){Set(parent,0);ShowWindow(parent,0);DestroyWindow(parent);parent=IntPtr.Zero;}if(name!=null)UnregisterClass(name,IntPtr.Zero);GC.KeepAlive(proc);}
 static int Main(string[] args){if(args.Length>0&&args[0]=="--child"){try{Create();Console.WriteLine(parent.ToInt64());Console.Out.Flush();Console.ReadLine();return 0;}finally{Cleanup();}}
  var steps=new List<object>();Process subprocess=null;IntPtr other=IntPtr.Zero;int? finalUncloak=null;string failure=null;bool ownPass=false;object cross=null;
  try{Create();uint initialStyle=(uint)GetWindowLong(parent,-16),initialEx=(uint)GetWindowLong(parent,-20);steps.Add(Snapshot("initialHidden"));int hr=Set(parent,1);steps.Add(new{stage="setCloak",hresult=hr});if(hr<0)throw new Exception("own cloak failed");uint cloak;int get=DwmGetWindowAttribute(parent,14,out cloak,4);steps.Add(Snapshot("cloakedHidden"));if(get<0||(cloak&1)==0)throw new Exception("own cloak readback failed");if(GetWindowLong(parent,-20)!=(int)initialEx||GetWindowLong(parent,-16)!=(int)initialStyle)throw new Exception("cloak modified window styles");
   ShowWindow(parent,4);steps.Add(Snapshot("shownNoActivateOffscreenCloaked"));bool redraw=RedrawWindow(parent,IntPtr.Zero,IntPtr.Zero,0x181);steps.Add(new{stage="redraw0x181",success=redraw,parentPaint=parentPaint,childPaint=childPaint});if(!redraw)throw new Exception("RedrawWindow failed");
   hr=Set(parent,0);steps.Add(new{stage="uncloak",hresult=hr});steps.Add(Snapshot("uncloakedOffscreen"));if(hr<0)throw new Exception("own uncloak failed");get=DwmGetWindowAttribute(parent,14,out cloak,4);uint afterStyle=(uint)GetWindowLong(parent,-16),afterEx=(uint)GetWindowLong(parent,-20);ownPass=get>=0&&(cloak&1)==0&&afterEx==initialEx&&(afterStyle&~0x10000000u)==(initialStyle&~0x10000000u);if(!ownPass)throw new Exception("uncloak/style consistency failed");
   subprocess=Process.Start(new ProcessStartInfo{FileName=System.Reflection.Assembly.GetExecutingAssembly().Location,Arguments="--child",UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardOutput=true,RedirectStandardInput=true});string line=subprocess.StandardOutput.ReadLine();other=new IntPtr(long.Parse(line));int crossSet=Set(other,1);uint crossValue;int crossGet=DwmGetWindowAttribute(other,14,out crossValue,4);int crossReset=Set(other,0);cross=new{target="only this probe's own spawned child process hidden HWND",setHresult=crossSet,getHresult=crossGet,cloakedReadback=crossValue,resetHresult=crossReset,accepted=crossSet>=0&&crossGet>=0&&(crossValue&1)!=0};if(crossReset<0)throw new Exception("child uncloak failed");
  }catch(Exception ex){failure=ex.Message;}finally{if(other!=IntPtr.Zero)Set(other,0);if(subprocess!=null){try{subprocess.StandardInput.WriteLine("done");subprocess.StandardInput.Flush();subprocess.WaitForExit(3000);}catch{}subprocess.Dispose();}if(parent!=IntPtr.Zero)finalUncloak=Set(parent,0);Cleanup();}
  var report=new{observedAt=DateTimeOffset.Now.ToString("o"),scope="Only own offscreen native parent/child windows plus own spawned process; no Foxmail access",ownSequencePass=ownPass,error=failure,parentPaint=parentPaint,childPaint=childPaint,styleNote="ShowWindow necessarily toggles WS_VISIBLE. Cloak did not modify style/exstyle; non-visibility style bits and all exstyle bits checked unchanged.",steps=steps,crossProcess=cross,finalUncloakHresult=finalUncloak,dwmFlushCalled=false,limit="Own-window API success does not prove Foxmail frame readiness, white-flash repair, or interaction safety. External hook arrives asynchronously; no whole-session present guarantee."};string json=new JavaScriptSerializer().Serialize(report);File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"audit-own-cloak-probe.json"),json,Encoding.UTF8);Console.WriteLine(json);return failure==null?0:1;
 }
}
