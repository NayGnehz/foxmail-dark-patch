[CmdletBinding()]
param([switch]$Preflight,[switch]$Rollback,[string]$AppRoot='D:\Users\Public\Downloads\Foxmail')
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 $stage=Join-Path $instance.instanceRoot 'temp\version587-reveal'
 $evidence=Get-Content -LiteralPath (Join-Path $stage 'validation.json') -Raw|ConvertFrom-Json
 $audit=Get-Content -LiteralPath (Join-Path $stage 'final-audit.json') -Raw|ConvertFrom-Json
 if(!$audit.passed -or $audit.candidateSHA256 -ne $evidence.candidateSHA256 -or $audit.helperSHA256 -ne $evidence.helperSHA256){throw 'Candidate evidence mismatch'}
 $app=[IO.Path]::GetFullPath($AppRoot).TrimEnd('\')
 $null=Assert-PortablePlainPath $app
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 if((Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'){throw 'Original 587 executable changed'}
 $plan=@(
  @{name='Foxmail深色.exe';before='119c1b48936303346f113bef62f92258b19447ed5504cb72c002b0e9aefa5fb3';after=$evidence.candidateSHA256;candidate=$evidence.dest},
  @{name='FoxmailRevealGate.dll';before='dc931f44a9b671a53d3100d3485bb015692afd6de53a0040406d8b6aa12aac00';after=$evidence.helperSHA256;candidate=$evidence.helper}
 )
 $backup=Join-Path $stage 'rollback'
 foreach($f in $plan){
  $target=Join-Path $app $f.name
  $expected=if($Rollback){$f.after}else{$f.before}
  if((Hash $target) -ne $expected){throw ('Current file changed: '+$f.name)}
  $source=if($Rollback){Join-Path $backup $f.name}else{$f.candidate}
  $wanted=if($Rollback){$f.before}else{$f.after}
  if((Hash $source) -ne $wanted){throw ('Replacement hash differs: '+$f.name)}
 }
 $busy=@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($app+'\',[StringComparison]::OrdinalIgnoreCase) -and $_.Name -like 'Foxmail*.exe'})
 if($Preflight){[pscustomobject]@{validated=$true;target=$app;files=$plan.Count;runningProcesses=$busy.Count;readyToReplace=($busy.Count -eq 0);rollback=[bool]$Rollback}|ConvertTo-Json;return}
 if($busy.Count){throw 'Save contents and fully exit this Foxmail before replacement'}
 if(!$Rollback){
  $null=Assert-PortablePlainPath $backup
  [void][IO.Directory]::CreateDirectory($backup)
  foreach($f in $plan){$p=Join-Path $backup $f.name;if(Test-Path -LiteralPath $p){if((Hash $p) -ne $f.before){throw 'Backup collision'}}else{Copy-Item -LiteralPath (Join-Path $app $f.name) -Destination $p};if((Hash $p) -ne $f.before){throw 'Backup verification failed'}}
 }
 try{
  foreach($f in $plan){$source=if($Rollback){Join-Path $backup $f.name}else{$f.candidate};Copy-Item -LiteralPath $source -Destination (Join-Path $app $f.name) -Force}
  foreach($f in $plan){$wanted=if($Rollback){$f.before}else{$f.after};if((Hash (Join-Path $app $f.name)) -ne $wanted){throw 'Installed hash mismatch'}}
 }catch{
  foreach($f in $plan){$source=if($Rollback){$f.candidate}else{Join-Path $backup $f.name};Copy-Item -LiteralPath $source -Destination (Join-Path $app $f.name) -Force}
  throw
 }
 $report=@{utc=[DateTime]::UtcNow.ToString('o');rollback=[bool]$Rollback;target=$app;candidateSHA256=$evidence.candidateSHA256;helperSHA256=$evidence.helperSHA256;original587Unchanged=$true;assetsOrAccountsChanged=$false;visualAccepted=$false}
 [IO.File]::WriteAllText((Join-Path $stage 'installation.json'),($report|ConvertTo-Json),[Text.UTF8Encoding]::new($false));$report|ConvertTo-Json
}
