param([switch]$Preflight,[switch]$Rollback)
$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'install-plan.json') -Raw | ConvertFrom-Json
$backup=Join-Path $target 'DarkModeBackup\BeforeCosmetic1.3-49DA9033'
$payload=Join-Path $PSScriptRoot 'payload'
function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
function SafePath([string]$root,[string]$relative){
 $result=[IO.Path]::GetFullPath((Join-Path $root $relative))
 if(!$result.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Path outside intended directory'}
 return $result
}
if(!$plan.eligibleForInstall -or $plan.version -ne '1.3-candidate' -or $plan.files.Count -ne 8 -or $plan.fileCount -ne 8){throw 'Unexpected or unverified plan'}
if((Hash (Join-Path $target 'Foxmail.exe')) -ne $plan.originalSHA256){throw 'Original Foxmail version changed'}
if((Hash (Join-Path $target 'FoxmailRevealGate.dll')) -ne $plan.helperSHA256){throw 'Validated reveal helper changed'}
foreach($file in $plan.files){
 $current=SafePath $target $file.relative
 $staged=SafePath $payload $file.relative
 $saved=SafePath $backup $file.relative
 if($Rollback){
  if((Hash $current) -ne $file.candidateSHA256 -or (Hash $saved) -ne $file.baselineSHA256){throw ('Rollback source mismatch: '+$file.relative)}
 }else{
  if((Hash $current) -ne $file.baselineSHA256 -or (Hash $staged) -ne $file.candidateSHA256){throw ('Install source mismatch: '+$file.relative)}
  if($file.pristineBackup){
   $original=SafePath (Join-Path $target 'DarkModeBackup') $file.pristineBackup
   if(Test-Path -LiteralPath $original){if((Hash $original) -ne $file.pristineSHA256){throw 'Pristine backup mismatch'}}elseif($file.baselineSHA256 -ne $file.pristineSHA256){throw 'Required pristine backup missing'}
  }
 }
}
if($Preflight){'Preflight PASS: candidate, installed baseline, original executable and helper verified; no file changes.';return}
if(Get-CimInstance Win32_Process | Where-Object {$_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe'}){throw 'Please save work and fully exit Foxmail, including tray and error reporter'}
$lock=[IO.File]::Open((Join-Path $target 'Foxmail深色.exe'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$lock.Dispose()
if($Rollback){
 foreach($file in $plan.files){Copy-Item -LiteralPath (SafePath $backup $file.relative) -Destination (SafePath $target $file.relative) -Force}
 foreach($file in $plan.files){if((Hash (SafePath $target $file.relative)) -ne $file.baselineSHA256){throw 'Rollback verification failed'}}
 ($plan.files | Where-Object {$_.relative -eq 'Foxmail深色.exe'}).baselineSHA256 | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
 'Restored exact 1.2 executable, all five external sprites, editor stylesheet and metadata.'
 return
}
foreach($file in $plan.files){
 $current=SafePath $target $file.relative
 $saved=SafePath $backup $file.relative
 New-Item -ItemType Directory -Path (Split-Path -Parent $saved) -Force | Out-Null
 if(Test-Path -LiteralPath $saved){if((Hash $saved) -ne $file.baselineSHA256){throw 'Existing backup differs'}}else{Copy-Item -LiteralPath $current -Destination $saved}
 if((Hash $saved) -ne $file.baselineSHA256){throw 'Backup verification failed'}
 if($file.pristineBackup){
  $original=SafePath (Join-Path $target 'DarkModeBackup') $file.pristineBackup
  New-Item -ItemType Directory -Path (Split-Path -Parent $original) -Force | Out-Null
  if(Test-Path -LiteralPath $original){if((Hash $original) -ne $file.pristineSHA256){throw 'Pristine backup changed'}}else{Copy-Item -LiteralPath $current -Destination $original}
  if((Hash $original) -ne $file.pristineSHA256){throw 'Pristine backup verification failed'}
 }
}
try{
 foreach($file in $plan.files){Copy-Item -LiteralPath (SafePath $payload $file.relative) -Destination (SafePath $target $file.relative) -Force}
 foreach($file in $plan.files){if((Hash (SafePath $target $file.relative)) -ne $file.candidateSHA256){throw 'Installed hash mismatch'}}
}catch{
 foreach($file in $plan.files){Copy-Item -LiteralPath (SafePath $backup $file.relative) -Destination (SafePath $target $file.relative) -Force}
 throw
}
($plan.files | Where-Object {$_.relative -eq 'Foxmail深色.exe'}).candidateSHA256 | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
'Installed 1.3 secondary-page candidate. Exact 1.2 baseline retained at '+$backup
