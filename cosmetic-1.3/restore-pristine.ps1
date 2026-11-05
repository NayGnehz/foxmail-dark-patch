param([switch]$Preflight)
$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$backup=Join-Path $target 'DarkModeBackup'
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'pristine-restore-plan.json') -Raw | ConvertFrom-Json
function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
function SafePath([string]$root,[string]$relative){$p=[IO.Path]::GetFullPath((Join-Path $root $relative));if(!$p.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Path outside intended directory'};return $p}
if((Hash (Join-Path $target 'Foxmail.exe')) -ne $plan.originalSHA256){throw 'Original executable changed'}
foreach($file in $plan.files){if((Hash (SafePath $backup $file.source)) -ne $file.SHA256){throw ('Pristine source changed: '+$file.source)}}
if($Preflight){'Pristine restore preflight PASS: all original skins, reading template and editor CSS verified.';return}
if(Get-CimInstance Win32_Process | Where-Object {$_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe'}){throw 'Please fully exit Foxmail before restoration'}
$snapshot=Join-Path $backup ('BeforePristine13-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
foreach($file in $plan.files){$saved=SafePath $snapshot $file.relative;New-Item -ItemType Directory -Path (Split-Path -Parent $saved) -Force | Out-Null;Copy-Item -LiteralPath (SafePath $target $file.relative) -Destination $saved}
try{
 foreach($file in $plan.files){Copy-Item -LiteralPath (SafePath $backup $file.source) -Destination (SafePath $target $file.relative) -Force}
 foreach($file in $plan.files){if((Hash (SafePath $target $file.relative)) -ne $file.SHA256){throw 'Restored asset mismatch'}}
}catch{foreach($file in $plan.files){Copy-Item -LiteralPath (SafePath $snapshot $file.relative) -Destination (SafePath $target $file.relative) -Force};throw}
'Original assets restored. Run the unchanged Foxmail.exe; dark executable was retained separately.'
