[CmdletBinding()]
param([switch]$Preflight,[switch]$Rollback,[string]$AppRoot='D:\Users\Public\Downloads\Foxmail')
$ErrorActionPreference='Stop'
if(!$Rollback){throw 'Rejected candidate: user reported white editor and unresponsive window on 2026-11-06. Forward installation is disabled; rollback remains available.'}
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 $stage=Join-Path $instance.instanceRoot 'temp\version587-goal-paper'
 $paper=Get-Content -LiteralPath (Join-Path $stage 'validation.json') -Raw|ConvertFrom-Json
 $pen=Get-Content -LiteralPath (Join-Path $stage 'pen-validation.json') -Raw|ConvertFrom-Json
 $shell=Get-Content -LiteralPath (Join-Path $stage 'shell-tests.json') -Raw|ConvertFrom-Json
 if(!$shell.passed -or !$shell.bodyAndExportIdentical -or !$shell.screenOnly -or $shell.exportCases -ne 12){throw 'Actual exporter verification missing'}
 if($paper.changedExeBytes -ne 3 -or !$pen.onlyAppendedHookAndPEHeaderChanged -or $pen.startupWinApiCalls -ne 0 -or $pen.paperSHA256 -ne $paper.candidateSHA256){throw 'Candidate scope guard'}
 if(!(Select-String -LiteralPath (Join-Path $stage 'editor-tests.log') -SimpleMatch '1040 assertions') -or !(Select-String -LiteralPath (Join-Path $stage 'pen-tests.log') -SimpleMatch 'PASS: startup + 1 native x86 checks')){throw 'Native verification missing'}
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 $app=[IO.Path]::GetFullPath($AppRoot).TrimEnd('\');$null=Assert-PortablePlainPath $app
 if((Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'){throw 'Original 587 changed'}
 if((Hash (Join-Path $app 'FoxmailRevealGate.dll')) -ne $paper.helperSHA256 -or (Hash $paper.helper) -ne $paper.helperSHA256){throw 'Accepted first-tray helper changed'}
 $plan=@(
  @{name='Foxmail深色.exe';before=$paper.baselineSHA256;after=$pen.candidateSHA256;old=$paper.baselineExe;new=$pen.dest},
  @{name=$paper.css.relative;before=$paper.css.beforeSHA256;after=$paper.css.afterSHA256;old=$paper.css.before;new=$paper.css.source}
 )
 foreach($f in $plan){
  $expected=if($Rollback){$f.after}else{$f.before}
  $null=Assert-PortablePlainPath (Join-Path $app $f.name)
  if((Hash (Join-Path $app $f.name)) -ne $expected -or (Hash $f.old) -ne $f.before -or (Hash $f.new) -ne $f.after){throw ('File identity guard '+$f.name)}
 }
 if($Preflight){[pscustomobject]@{validated=$true;rollback=[bool]$Rollback;exportCases=12;nativeEditorAssertions=1040;nativePenChecks=1;firstTrayHelperRetained=$true}|ConvertTo-Json;return}
 $current=if($Rollback){$pen.candidateSHA256}else{$paper.baselineSHA256}
 & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $current -AppRoot $app -StopOnly | Out-Null
 try{
  foreach($f in $plan){$source=if($Rollback){$f.old}else{$f.new};Copy-Item -LiteralPath $source -Destination (Join-Path $app $f.name) -Force}
  foreach($f in $plan){$wanted=if($Rollback){$f.before}else{$f.after};if((Hash (Join-Path $app $f.name)) -ne $wanted){throw 'Installed verification failed'}}
 }catch{
  foreach($f in $plan){$source=if($Rollback){$f.new}else{$f.old};Copy-Item -LiteralPath $source -Destination (Join-Path $app $f.name) -Force};throw
 }
 $run=Start-Process -FilePath (Join-Path $app 'Foxmail深色.exe') -WorkingDirectory $app -WindowStyle Normal -PassThru
 $report=@{utc=[DateTime]::UtcNow.ToString('o');pid=$run.Id;rollback=[bool]$Rollback;normalGUIStartup=$true;installedExeSHA256=(Hash (Join-Path $app 'Foxmail深色.exe'));installedCssSHA256=(Hash (Join-Path $app $paper.css.relative));helperSHA256=$paper.helperSHA256;visualAccepted=$false}
 [IO.File]::WriteAllText((Join-Path $stage 'installation.json'),($report|ConvertTo-Json),[Text.UTF8Encoding]::new($false));$report|ConvertTo-Json
}
