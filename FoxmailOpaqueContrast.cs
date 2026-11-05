using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// Experimental, main-window-only A/B probe. Never starts enabled by default.
class FoxmailOpaqueContrast : Form {
 const string ExactPath=@"D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe", ExactClass="TFoxMainFrm.UnicodeClass";
 const int Layered=0x80000, ExIndex=-20;
 delegate bool EnumProc(IntPtr h,IntPtr a);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p,IntPtr a);
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h,uint f);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h,int i);
 [DllImport("user32.dll")] static extern uint GetClassLong(IntPtr h,int i);
 [DllImport("user32.dll",SetLastError=true)] static extern int SetWindowLong(IntPtr h,int i,int v);
 [DllImport("kernel32.dll")] static extern void SetLastError(uint e);
 [DllImport("user32.dll",SetLastError=true)] static extern bool SetLayeredWindowAttributes(IntPtr h,uint key,byte alpha,uint flags);
 [DllImport("user32.dll",SetLastError=true)] static extern bool GetLayeredWindowAttributes(IntPtr h,out uint key,out byte alpha,out uint flags);
 [DllImport("user32.dll")] static extern bool RedrawWindow(IntPtr h,IntPtr r,IntPtr region,uint flags);
 [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
 readonly Label status=new Label(); readonly Timer timer=new Timer(); readonly List<object> events=new List<object>();
 Process process; IntPtr hwnd,processHandle; uint pid,thread; long start; bool owned,resetObserved,ownershipConflict,automaticAttempted; DateTime enabled;
 static string ClassOf(IntPtr h){var b=new StringBuilder(256);GetClassName(h,b,b.Capacity);return b.ToString();}
 static bool SafeStyles(int ex,uint cls){return (ex&(Layered|0x02000000|0x00200000))==0&&(cls&0xE0)==0;}
 static bool Safe(IntPtr h){return IsWindow(h)&&GetAncestor(h,2)==h&&(GetWindowLong(h,-16)&0x40000000)==0&&SafeStyles(GetWindowLong(h,ExIndex),GetClassLong(h,-26));}
 static bool Bit(IntPtr h,bool on){int current=GetWindowLong(h,ExIndex),wanted=on?current|Layered:current&~Layered;SetLastError(0);int previous=SetWindowLong(h,ExIndex,wanted);int error=Marshal.GetLastWin32Error();return (previous!=0||error==0)&&GetWindowLong(h,ExIndex)==wanted;}
 static bool Opaque(IntPtr h){uint key,flags;byte alpha;return GetLayeredWindowAttributes(h,out key,out alpha,out flags)&&key==0&&alpha==255&&flags==2;}
 static bool Activate(IntPtr h,out bool pending){pending=false;if(!Safe(h))return false;if(!Bit(h,true)){pending=(GetWindowLong(h,ExIndex)&Layered)!=0;if(pending&&Bit(h,false))pending=false;return false;}pending=true;
  if(SetLayeredWindowAttributes(h,0,255,2)&&Opaque(h))return true;
  // No previous layered bit existed, so a failed activation owns only that new bit.
  uint k,f;byte a;bool attrs=GetLayeredWindowAttributes(h,out k,out a,out f);
  if(!attrs||(k==0&&a==255&&f==2)){if(Bit(h,false)){pending=false;RedrawWindow(h,IntPtr.Zero,IntPtr.Zero,0x485);}}return false;
 }
 FoxmailOpaqueContrast(bool enable){Text="Foxmail 主窗口显示缓存对照（实验）";ClientSize=new Size(670,240);StartPosition=FormStartPosition.CenterScreen;
  Controls.Add(new Label{Left=15,Top=12,Width=640,Height=70,Text="默认不改动。仅对指定主窗口测试显示缓存，保持完全不透明。\r\n这是渲染假设验证，可能影响主窗口绘制，不能保证消除闪烁。\r\n10分钟自动恢复；关闭时恢复。不会修改邮件、子窗口或结束 Foxmail。"});
  status.SetBounds(15,90,640,75);Controls.Add(status);
  var on=new Button{Left=15,Top=180,Width=195,Text="开启不透明分层"};var off=new Button{Left=230,Top=180,Width=180,Text="恢复原样"};var exit=new Button{Left=430,Top=180,Width=220,Text="恢复并结束"};Controls.AddRange(new Control[]{on,off,exit});
  on.Click+=(s,e)=>EnableProbe();off.Click+=(s,e)=>Restore("manual");exit.Click+=(s,e)=>Close();
  timer.Interval=1000;timer.Tick+=(s,e)=>{if(!owned)return;bool gone;if(!Identity(out gone)){if(gone){owned=false;Log("targetGone");}return;}if((GetWindowLong(hwnd,ExIndex)&Layered)==0){owned=false;resetObserved=true;status.Text="应用已清除分层位，未重新开启。";Log("applicationReset");return;}if(!Opaque(hwnd)&&!ownershipConflict){ownershipConflict=true;status.Text="检测到应用更改分层属性；停止自动恢复，避免覆盖。";Log("attributesChanged");}if(!automaticAttempted&&DateTime.UtcNow-enabled>=TimeSpan.FromMinutes(10)){automaticAttempted=true;Restore("automatic10minutes");}};timer.Start();
  FormClosing+=(s,e)=>{if(!Restore("closing")){e.Cancel=true;return;}timer.Stop();if(process!=null)process.Dispose();};
  status.Text="未改动。点击开启才会查找并修改指定主窗口。";Log("initialNoMutation");if(enable)Shown+=(s,e)=>EnableProbe();
 }
 bool Connect(){if(owned)return false;if(process!=null){process.Dispose();process=null;}var found=new List<Tuple<Process,IntPtr,uint>>();var retained=new List<Process>();
  foreach(var p in Process.GetProcessesByName("Foxmail深色")){bool keep=false;try{if(!String.Equals(Path.GetFullPath(p.MainModule.FileName),ExactPath,StringComparison.OrdinalIgnoreCase))continue;IntPtr ph=p.Handle;if(p.HasExited)continue;retained.Add(p);keep=true;EnumWindows((h,a)=>{uint id;uint t=GetWindowThreadProcessId(h,out id);if(id==(uint)p.Id&&ClassOf(h)==ExactClass&&GetAncestor(h,2)==h)found.Add(Tuple.Create(p,h,t));return true;},IntPtr.Zero);}catch{}finally{if(!keep)p.Dispose();}}
  if(found.Count!=1){foreach(var p in retained)p.Dispose();return false;}process=found[0].Item1;hwnd=found[0].Item2;thread=found[0].Item3;pid=(uint)process.Id;processHandle=process.Handle;start=process.StartTime.ToUniversalTime().Ticks;foreach(var p in retained)if(p!=process)p.Dispose();return true;
 }
 bool Identity(out bool gone){gone=false;try{if(process==null)return false;if(process.HasExited){gone=true;return false;}if(process.Handle!=processHandle||process.StartTime.ToUniversalTime().Ticks!=start)return false;if(!IsWindow(hwnd)){gone=true;return false;}uint id;return GetWindowThreadProcessId(hwnd,out id)==thread&&id==pid&&ClassOf(hwnd)==ExactClass&&GetAncestor(hwnd,2)==hwnd;}catch{return false;}}
 void EnableProbe(){if(owned){status.Text="已有待恢复的改动。";return;}bool gone;if(!Connect()||!Identity(out gone)||!Safe(hwnd)){status.Text="拒绝操作：目标不唯一、身份不符或已有不兼容样式。";Log("rejected");return;}resetObserved=false;ownershipConflict=false;automaticAttempted=false;bool ok=Activate(hwnd,out owned);enabled=DateTime.UtcNow;status.Text=ok?"已开启显示缓存对照，保持完全不透明；10分钟后恢复。":owned?"启用失败且存在待恢复位；请点击恢复。":"启用失败，已回退。";Log(ok?"enabled":"activationFailed");}
 bool Restore(string reason){if(!owned)return true;bool gone;if(!Identity(out gone)){if(gone){owned=false;Log(reason+"Gone");return true;}status.Text="身份复核失败，保留待恢复状态。";Log(reason+"IdentityRejected");return false;}
  if((GetWindowLong(hwnd,ExIndex)&Layered)==0){owned=false;resetObserved=true;Log(reason+"AlreadyReset");return true;}
  if(ownershipConflict||!Opaque(hwnd)){status.Text="应用更改了分层属性；为避免覆盖其透明度，暂停恢复。请自行重启 Foxmail 后关闭此工具。";Log(reason+"OwnershipConflict");return false;}
  if(!Bit(hwnd,false)){status.Text="恢复样式失败，请重试。";Log(reason+"Failed");return false;}owned=false;bool redraw=RedrawWindow(hwnd,IntPtr.Zero,IntPtr.Zero,0x485);status.Text="已清除本工具的分层位。";Log(reason+(redraw?"Restored":"RestoredRedrawFailed"));return true;
 }
 void Log(string action){object snapshot=null;bool gone;if(Identity(out gone)){uint key,flags;byte alpha;bool read=GetLayeredWindowAttributes(hwnd,out key,out alpha,out flags);snapshot=new{exStyle=GetWindowLong(hwnd,ExIndex),layerAttributesReadable=read,colorKey=key,alpha=alpha,flags=flags};}events.Add(new{snapshot=snapshot,mutatedBit="WS_EX_LAYERED",requestedAlpha=255,requestedFlags=2,at=DateTime.UtcNow.ToString("o"),action=action,path=ExactPath,pid=pid,hwnd=hwnd.ToInt64().ToString("X"),thread=thread,startTicks=start,pendingRestore=owned,applicationReset=resetObserved,ownershipConflict=ownershipConflict});try{File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"audit-opaque-contrast.json"),new JavaScriptSerializer().Serialize(new{events=events}),Encoding.UTF8);}catch{status.Text+=" 记录文件写入失败。";}}
 [STAThread] static int Main(string[] args){if(args.Length>0&&args[0]=="--fixture"){var f=new Form{ShowInTaskbar=false};f.Controls.Add(new Panel());Console.WriteLine(f.Handle.ToInt64());Console.Out.Flush();Application.Run(f);return 0;}if(args.Length>0&&args[0]=="--self-test")return SelfTest();Application.EnableVisualStyles();Application.Run(new FoxmailOpaqueContrast(args.Length==1&&args[0]=="--enable"));return 0;}
 static int SelfTest(){var results=new List<object>();bool all=true;using(var own=new Form()){own.Controls.Add(new Panel());IntPtr h=own.Handle;bool pending;bool enabled=Activate(h,out pending)&&pending&&Opaque(h);SetWindowLong(h,ExIndex,GetWindowLong(h,ExIndex)|0x80);bool restored=Bit(h,false)&&(GetWindowLong(h,ExIndex)&0x80)!=0;SetWindowLong(h,ExIndex,GetWindowLong(h,ExIndex)|Layered);bool reject=!Activate(h,out pending);Bit(h,false);Bit(h,true);SetLayeredWindowAttributes(h,0,254,2);bool ownershipGuard=!Opaque(h);Bit(h,false);bool compositeReject=!SafeStyles(0x02000000,0);bool noRedirectReject=!SafeStyles(0x00200000,0);bool invalid=!Activate(IntPtr.Zero,out pending);bool childReject=!Safe(own.Controls[0].Handle);all=enabled&&restored&&reject&&invalid&&childReject&&ownershipGuard&&compositeReject&&noRedirectReject;results.Add(new{fixture="own",enabled=enabled,restoredPreservingOtherBit=restored,preexistingLayerRejected=reject,invalidRejected=invalid,childRejected=childReject,unexpectedAlphaRejected=ownershipGuard,compositeRejected=compositeReject,noRedirectRejected=noRedirectReject});}
  var info=new ProcessStartInfo(Application.ExecutablePath,"--fixture"){UseShellExecute=false,RedirectStandardOutput=true,CreateNoWindow=true};using(var p=Process.Start(info)){IntPtr h=IntPtr.Zero;try{string line=p.StandardOutput.ReadLine();long value;if(!long.TryParse(line,out value))throw new Exception("fixture handle missing");h=new IntPtr(value);uint id;bool identity=GetWindowThreadProcessId(h,out id)!=0&&id==(uint)p.Id;bool pending;bool enabled=identity&&Activate(h,out pending)&&Opaque(h);bool restored=Bit(h,false)&&(GetWindowLong(h,ExIndex)&Layered)==0;results.Add(new{fixture="spawnedProcess",identity=identity,enabled=enabled,restored=restored});all&=enabled&&restored;}finally{if(h!=IntPtr.Zero)PostMessage(h,0x10,IntPtr.Zero,IntPtr.Zero);if(!p.WaitForExit(5000))all=false;}}
  File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"audit-opaque-contrast-selftest.json"),new JavaScriptSerializer().Serialize(new{at=DateTime.UtcNow.ToString("o"),passed=all,results=results}),Encoding.UTF8);Console.WriteLine(all?"SELF-TEST PASS":"SELF-TEST FAIL");return all?0:1;
 }
}
