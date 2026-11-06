[CmdletBinding()]
param([switch]$Preflight,[switch]$Rollback,[string]$AppRoot='D:\Users\Public\Downloads\Foxmail')
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 $stage=Join-Path $instance.instanceRoot 'temp\version587-next'
 $evidence=Get-Content -LiteralPath (Join-Path $stage 'validation.json') -Raw|ConvertFrom-Json
 $browser=Get-Content -LiteralPath (Join-Path $stage 'shell-tests.json') -Raw|ConvertFrom-Json
 if(!$browser.passed -or $browser.exportCases -ne 12 -or !(Select-String -LiteralPath (Join-Path $stage 'edge-tests.log') -SimpleMatch 'PASS: 5184 actual x86 edge masks')){throw 'Required validation missing'}
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 $app=[IO.Path]::GetFullPath($AppRoot).TrimEnd('\');$null=Assert-PortablePlainPath $app
 if((Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'){throw 'Original 587 changed'}
 if((Hash (Join-Path $app 'FoxmailRevealGate.dll')) -ne 'c1821caffcdccc4f52e67f397208de70bb38728c16b447ad3bf159bcff936082'){throw 'Existing synchronous helper changed'}
 $plan=@(
  @{relative='Foxmail深色.exe';before='aba62e036d6ba41d46eaf63e3036488143a707458ff20cbefebb567816e3b78d';after=$evidence.candidateSHA256;source=$evidence.dest},
  @{relative=$evidence.template.relative;before=$evidence.template.beforeSHA256;after=$evidence.template.afterSHA256;source=$evidence.template.source}
 )
 $backup=Join-Path $stage 'rollback'
 foreach($f in $plan){
  $target=Join-Path $app $f.relative
  $before=if($Rollback){$f.after}else{$f.before};if((Hash $target) -ne $before){throw ('Installed file differs: '+$f.relative)}
  $source=if($Rollback){Join-Path $backup $f.relative}else{$f.source}
  $after=if($Rollback){$f.before}else{$f.after};if((Hash $source) -ne $after){throw ('Replacement differs: '+$f.relative)}
 }
 $busy=@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($app+'\',[StringComparison]::OrdinalIgnoreCase) -and $_.Name -like 'Foxmail*.exe'})
 if($Preflight){[pscustomobject]@{filesValidated=$true;target=$app;files=$plan.Count;runningProcesses=$busy.Count;readyToReplace=($busy.Count -eq 0);rollback=[bool]$Rollback}|ConvertTo-Json;return}
 if($busy.Count){throw 'Save contents and fully exit Foxmail including the tray icon before replacement'}
 if(!$Rollback){foreach($f in $plan){$p=Join-Path $backup $f.relative;$null=Assert-PortablePlainPath (Split-Path $p -Parent);[void][IO.Directory]::CreateDirectory((Split-Path $p -Parent));if(Test-Path -LiteralPath $p){if((Hash $p) -ne $f.before){throw 'Backup collision'}}else{Copy-Item -LiteralPath (Join-Path $app $f.relative) -Destination $p};if((Hash $p) -ne $f.before){throw 'Backup verification failed'}}}
 try{
  foreach($f in $plan){$source=if($Rollback){Join-Path $backup $f.relative}else{$f.source};Copy-Item -LiteralPath $source -Destination (Join-Path $app $f.relative) -Force}
  foreach($f in $plan){$wanted=if($Rollback){$f.before}else{$f.after};if((Hash (Join-Path $app $f.relative)) -ne $wanted){throw 'Installed byte verification failed'}}
 }catch{
  foreach($f in $plan){$source=if($Rollback){$f.source}else{Join-Path $backup $f.relative};Copy-Item -LiteralPath $source -Destination (Join-Path $app $f.relative) -Force};throw
 }
 $report=@{utc=[DateTime]::UtcNow.ToString('o');rollback=[bool]$Rollback;target=$app;candidateSHA256=$evidence.candidateSHA256;templateSHA256=$evidence.template.afterSHA256;originalAndHelperUnchanged=$true;accountsOrMessageDataAccessed=$false;visualAccepted=$false}
 [IO.File]::WriteAllText((Join-Path $stage 'installation.json'),($report|ConvertTo-Json),[Text.UTF8Encoding]::new($false));$report|ConvertTo-Json
}
