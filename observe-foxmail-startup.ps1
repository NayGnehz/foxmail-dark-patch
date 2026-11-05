$ErrorActionPreference='Stop'
$copyRoot='D:\Users\Public\Downloads\Foxmail'
$exe=Join-Path $copyRoot 'Foxmail深色.exe'
if(Get-Process -Name 'Foxmail深色','Foxmail' -ErrorAction SilentlyContinue){throw 'Foxmail already running; no launch performed'}
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;
public static class StartupWindows {
 public class Item { public long hwnd; public uint pid; public string cls; public bool visible,iconic; public int style,exStyle,width,height; }
 delegate bool EnumProc(IntPtr h,IntPtr p);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p,IntPtr l);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder b,int n);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h,int i);
 [StructLayout(LayoutKind.Sequential)] struct Rect {public int l,t,r,b;}
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
 public static Item[] Read(uint[] ids) {var wanted=new HashSet<uint>(ids);var list=new List<Item>();EnumWindows((h,p)=>{uint id;GetWindowThreadProcessId(h,out id);if(!wanted.Contains(id))return true;var s=new StringBuilder(128);GetClassName(h,s,s.Capacity);string c=s.ToString();if(c!="TFoxMainFrm.UnicodeClass"&&c!="TApplication"&&c!="TOptionForm.UnicodeClass")return true;Rect r;GetWindowRect(h,out r);list.Add(new Item{hwnd=h.ToInt64(),pid=id,cls=c,visible=IsWindowVisible(h),iconic=IsIconic(h),style=GetWindowLong(h,-16),exStyle=GetWindowLong(h,-20),width=r.r-r.l,height=r.b-r.t});return true;},IntPtr.Zero);return list.ToArray();}
}
'@
$clock=[Diagnostics.Stopwatch]::StartNew()
$startedAt=[DateTimeOffset]::Now.ToString('o')
$records=[Collections.Generic.List[object]]::new()
$last=''
$firstMain=$null
$launch=Start-Process -FilePath $exe -WorkingDirectory $copyRoot -WindowStyle Normal -PassThru
Write-Output ('Launched once: PID '+$launch.Id)
while($clock.Elapsed.TotalSeconds -lt 30){
 $ids=@(Get-Process -Name 'Foxmail深色' -ErrorAction SilentlyContinue | Where-Object {try{$_.Path -eq $exe}catch{$false}} | Select-Object -ExpandProperty Id)
 $windows=@([StartupWindows]::Read([uint32[]]$ids))
 $bugs=@(Get-Process -Name 'TxBugReport' -ErrorAction SilentlyContinue).Count
 $snapshot=[ordered]@{pids=$ids;windows=$windows;bugReportCount=$bugs}
 $key=$snapshot | ConvertTo-Json -Depth 6 -Compress
 if($key -ne $last){$records.Add([ordered]@{elapsedMs=$clock.Elapsed.TotalMilliseconds;state=$snapshot});$last=$key}
 if($null -eq $firstMain -and @($windows | Where-Object {$_.cls -eq 'TFoxMainFrm.UnicodeClass' -and $_.visible}).Count){$firstMain=$clock.Elapsed.TotalMilliseconds;Write-Output ('Main window visible after '+[math]::Round($firstMain)+' ms')}
 Start-Sleep -Milliseconds 50
}
$report=[ordered]@{startedAt=$startedAt;finishedAt=[DateTimeOffset]::Now.ToString('o');executable=$exe;executableSHA256=(Get-FileHash -LiteralPath $exe).Hash;launchCount=1;launchPID=$launch.Id;firstMainVisibleMs=$firstMain;durationMs=$clock.Elapsed.TotalMilliseconds;requestedPollIntervalMs=50;records=$records;limitations='One Start-Process launch, not an Explorer double-click comparison; filesystem memory cache not flushed; no pixels, text, mail, configuration or process memory read.'}
$report | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'audit-baseline-startup.json') -Encoding UTF8
Write-Output ('Saved '+$records.Count+' changed states; firstMainVisibleMs='+$firstMain)
