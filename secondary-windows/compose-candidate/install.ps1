param([Parameter(Mandatory)][string]$TargetRoot,[string]$InstanceId='cleanup-01a1aba4',[switch]$Preflight,[switch]$Rollback)
$ErrorActionPreference='Stop'
$target=[IO.Path]::GetFullPath($TargetRoot)
$project=Get-Item -LiteralPath $PSScriptRoot
while($project -and !(Test-Path -LiteralPath (Join-Path $project.FullName 'Invoke-FoxmailPortable.ps1'))){$project=$project.Parent}
if($project){
 $context=& (Join-Path $project.FullName 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId $InstanceId
 $candidateRoot=Join-Path $context.instanceRoot 'temp\compose-candidate'
}else{
 $candidateRoot=$PSScriptRoot
 if(!(Test-Path -LiteralPath (Join-Path $candidateRoot 'install-plan.json'))){throw 'Candidate plan missing; use the source entry or its registered cache installer'}
}
$plan=Get-Content -LiteralPath (Join-Path $candidateRoot 'install-plan.json') -Raw | ConvertFrom-Json
function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
function SafePath([string]$root,[string]$relative){
 $resolved=[IO.Path]::GetFullPath((Join-Path $root $relative))
 if(!$resolved.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Path outside authorized copy'}
 return $resolved
}
if(!$plan.eligibleForInstall -or $plan.version -ne '1.3.2-compose-candidate' -or $plan.files.Count -ne 4 -or $plan.fileCount -ne 4){throw 'Unverified install plan'}
if((Hash (Join-Path $target 'Foxmail.exe')) -ne $plan.originalSHA256){throw 'Original executable version changed'}
$backup=SafePath $target $plan.backup
$payload=Join-Path $candidateRoot 'payload'
foreach($f in $plan.files){
 $current=SafePath $target $f.relative
 $saved=SafePath $backup $f.relative
 if($Rollback){
  if((Hash $current) -ne $f.candidateSHA256 -or (Hash $saved) -ne $f.baselineSHA256){throw ('Rollback hash mismatch: '+$f.relative)}
 }else{
  if((Hash $current) -ne $f.baselineSHA256 -or (Hash (SafePath $payload $f.relative)) -ne $f.candidateSHA256){throw ('Install hash mismatch: '+$f.relative)}
  if((Test-Path -LiteralPath $saved) -and (Hash $saved) -ne $f.baselineSHA256){throw ('Existing backup differs: '+$f.relative)}
 }
}
if($Preflight){'Preflight PASS: four files, baseline, candidate and original verified; no files changed.';return}
if(Get-CimInstance Win32_Process | Where-Object {$_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe'}){throw 'Save work and fully exit Foxmail and its tray before installing'}
foreach($name in @('Foxmail深色.exe','FoxmailRevealGate.dll')){
 $lock=[IO.File]::Open((Join-Path $target $name),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $lock.Dispose()
}
if($Rollback){
 foreach($f in $plan.files){Copy-Item -LiteralPath (SafePath $backup $f.relative) -Destination (SafePath $target $f.relative) -Force}
 foreach($f in $plan.files){if((Hash (SafePath $target $f.relative)) -ne $f.baselineSHA256){throw 'Rollback verification failed'}}
 ($plan.files | Where-Object {$_.relative -eq 'Foxmail深色.exe'}).baselineSHA256 | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
 'Restored exact 1.3.1 executable, helper, compose template and build metadata.'
 return
}
foreach($f in $plan.files){
 $saved=SafePath $backup $f.relative
 New-Item -ItemType Directory -Path (Split-Path -Parent $saved) -Force | Out-Null
 if(!(Test-Path -LiteralPath $saved)){Copy-Item -LiteralPath (SafePath $target $f.relative) -Destination $saved}
 if((Hash $saved) -ne $f.baselineSHA256){throw 'Backup verification failed'}
}
try{
 foreach($f in $plan.files){Copy-Item -LiteralPath (SafePath $payload $f.relative) -Destination (SafePath $target $f.relative) -Force}
 foreach($f in $plan.files){if((Hash (SafePath $target $f.relative)) -ne $f.candidateSHA256){throw 'Installed hash mismatch'}}
}catch{
 foreach($f in $plan.files){Copy-Item -LiteralPath (SafePath $backup $f.relative) -Destination (SafePath $target $f.relative) -Force}
 throw
}
($plan.files | Where-Object {$_.relative -eq 'Foxmail深色.exe'}).candidateSHA256 | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
'Installed 1.3.2 compose candidate; exact 1.3.1 backup retained at '+$backup
