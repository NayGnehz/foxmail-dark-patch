[CmdletBinding()]
param([Parameter(Mandatory)][ValidatePattern('^[0-9a-fA-F]{64}$')][string]$ExpectedSha,[string]$AppRoot='D:\Users\Public\Downloads\Foxmail',[switch]$StopOnly)
# User authorized ending this Foxmail copy before updates on 2026-11-06.
# This is an interactive GUI under test: never pass SW_HIDE at startup.
$ErrorActionPreference='Stop'
$app=[IO.Path]::GetFullPath($AppRoot).TrimEnd('\');$exe=Join-Path $app 'Foxmail深色.exe'
if((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash -ne $ExpectedSha){throw 'Executable identity changed; no process was ended'}
$ours=@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -and $_.ExecutablePath.Equals($exe,[StringComparison]::OrdinalIgnoreCase)})
$foreign=@(Get-CimInstance Win32_Process|Where-Object {$_.Name -like 'Foxmail*.exe' -and $_.ExecutablePath -and !$_.ExecutablePath.Equals($exe,[StringComparison]::OrdinalIgnoreCase)})
if($foreign.Count){throw 'Another Foxmail executable is running; not ending the unmodified original'}
$main=@($ours|Where-Object {(Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue).MainWindowHandle -ne [IntPtr]::Zero})
foreach($row in @($main)+@($ours)){
 $p=Get-Process -Id $row.ProcessId -ErrorAction SilentlyContinue
 if($p -and $p.Path -and $p.Path.Equals($exe,[StringComparison]::OrdinalIgnoreCase)){
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
 }
}
$deadline=[DateTime]::UtcNow.AddSeconds(5)
do{
 $left=@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -and $_.ExecutablePath.Equals($exe,[StringComparison]::OrdinalIgnoreCase)})
 if(!$left.Count){break}
 foreach($row in $left){$p=Get-Process -Id $row.ProcessId -ErrorAction SilentlyContinue;if($p -and $p.Path -and $p.Path.Equals($exe,[StringComparison]::OrdinalIgnoreCase)){Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue}}
 [Threading.Thread]::Sleep(150)
}while([DateTime]::UtcNow -lt $deadline)
$left=@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -and $_.ExecutablePath.Equals($exe,[StringComparison]::OrdinalIgnoreCase)})
if($left.Count){throw 'Foxmail process remains; not launching a second instance'}
if($StopOnly){[pscustomobject]@{stopped=$true;matchedProcesses=$ours.Count;programFilesChanged=$false}|ConvertTo-Json -Compress;return}
$run=Start-Process -FilePath $exe -WorkingDirectory $app -WindowStyle Normal -PassThru
[pscustomobject]@{launched=$true;pid=$run.Id;startupShow='Normal';executableSHA256=$ExpectedSha.ToLowerInvariant();programFilesChanged=$false}|ConvertTo-Json -Compress
