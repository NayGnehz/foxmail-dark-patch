[CmdletBinding()]
param([switch]$Preflight,[switch]$Rollback)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
$stage=Join-Path $context.instanceRoot 'temp\version587'
$report=Get-Content -LiteralPath (Join-Path $stage 'validation.json') -Raw|ConvertFrom-Json
$app='D:\Users\Public\Downloads\Foxmail'
function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
function AppPath([string]$relative){$p=[IO.Path]::GetFullPath((Join-Path $app $relative));if(!$p.StartsWith($app+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Path outside copy'};return $p}
if((Hash (AppPath 'Foxmail.exe')) -ne $report.sourceSHA256){throw 'Upgraded original changed'}
if($report.rejected.Count){throw 'Unresolved assets; installation blocked'}
if(!(Select-String -LiteralPath (Join-Path $stage 'native-api-tests.log') -SimpleMatch 'PASS: startup + 62100 native x86 checks')){throw 'Native verification missing'}
$files=@([pscustomobject]@{relative='Foxmail深色.exe';source=$report.dest;originalSHA256='086e0c1d3cdcb204d0cd64db1e51b60aa86fa55d144ab530734fc783c94dbdf1';candidateSHA256=$report.candidateSHA256})+@($report.assets)
$backup=Join-Path $stage 'rollback'
foreach($f in $files){
 $target=AppPath $f.relative
 $expected=if($Rollback){$f.candidateSHA256}else{$f.originalSHA256}
 if((Hash $target) -ne $expected){throw ('Current software differs: '+$f.relative)}
 $source=if($Rollback){Join-Path $backup $f.relative}else{$f.source}
 $sourceHash=if($Rollback){$f.originalSHA256}else{$f.candidateSHA256}
 if((Hash $source) -ne $sourceHash){throw ('Replacement differs: '+$f.relative)}
}
$busy=@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($app+'\',[StringComparison]::OrdinalIgnoreCase) -and $_.Name -like 'Foxmail*.exe'})
if($busy.Count){throw 'Foxmail is running; save content and fully exit before replacing software'}
if($Preflight){'587 preflight passed; no changes made';return}
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
$null=Assert-PortablePlainPath $backup
if(!$Rollback){foreach($f in $files){$saved=Join-Path $backup $f.relative;[void][IO.Directory]::CreateDirectory((Split-Path $saved -Parent));if(Test-Path -LiteralPath $saved){if((Hash $saved) -ne $f.originalSHA256){throw 'Backup collision'}}else{Copy-Item -LiteralPath (AppPath $f.relative) -Destination $saved};if((Hash $saved) -ne $f.originalSHA256){throw 'Backup validation failed'}}}
$changed=@()
try{
 foreach($f in $files){$source=if($Rollback){Join-Path $backup $f.relative}else{$f.source};$changed+=,$f;Copy-Item -LiteralPath $source -Destination (AppPath $f.relative) -Force}
 foreach($f in $files){$expected=if($Rollback){$f.originalSHA256}else{$f.candidateSHA256};if((Hash (AppPath $f.relative)) -ne $expected){throw 'Installed byte validation failed'}}
}catch{
 if(!$Rollback){foreach($f in $changed){Copy-Item -LiteralPath (Join-Path $backup $f.relative) -Destination (AppPath $f.relative) -Force}}
 throw
}
$audit=@{utc=[DateTime]::UtcNow.ToString('o');rollback=[bool]$Rollback;version='7.2.25.587';softwareFiles=$files.Count;newExecutableSHA256=(Hash (AppPath 'Foxmail深色.exe'));originalUnchanged=((Hash (AppPath 'Foxmail.exe')) -eq $report.sourceSHA256);dataOrAccountsChanged=$false;oldCoordinatePatchesUsed=$false}
[IO.File]::WriteAllText((Join-Path $stage 'installation.json'),($audit|ConvertTo-Json),[Text.UTF8Encoding]::new($false));$audit|ConvertTo-Json
