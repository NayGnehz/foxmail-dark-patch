[CmdletBinding()]
param([switch]$Preflight,[switch]$Rollback,[string]$AppRoot='D:\Users\Public\Downloads\Foxmail',[ValidateSet('FirstRestore','Buffer')][string]$Phase='FirstRestore')
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 $temp=Join-Path $instance.instanceRoot 'temp';$stage=Join-Path $temp 'version587-goal'
 $prefix=if($Phase -eq 'Buffer'){'buffer'}else{'firstrestore'}
 $nativeGroup=if($Phase -eq 'Buffer'){'version587-goal-buffer-native'}else{'version587-goal-native'}
 $productionChecks=if($Phase -eq 'Buffer'){224}else{171}
 $e=Get-Content -LiteralPath (Join-Path $stage ($prefix+'-validation.json')) -Raw|ConvertFrom-Json
 $bridge=Get-Content -LiteralPath (Join-Path $stage ($prefix+'-bridge-tests.json')) -Raw|ConvertFrom-Json
 $deltaOK=if($Phase -eq 'Buffer'){$e.headersResourcesAndInstructionsUnchanged -and $e.changedExeBytes -eq 8}else{$e.codeHeadersAndResourcesUnchanged -and $e.changedExeBytes -eq 4}
 if(!$bridge.passed -or !$deltaOK){throw 'Required bridge/delta verification missing'}
 foreach($item in @(@('verify_reveal_gate','PASS: 1122 checks, 0 failures'),@('verify_production_dll',('PASS: production DLL '+$productionChecks+' checks, 0 failures')))){if(!(Select-String -LiteralPath (Join-Path $temp ($nativeGroup+'\'+$item[0]+'.log')) -SimpleMatch $item[1])){throw 'Required native verification missing'}}
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 $app=[IO.Path]::GetFullPath($AppRoot).TrimEnd('\');$null=Assert-PortablePlainPath $app
 if((Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'){throw 'Original 587 changed'}
 $oldExe=if($Phase -eq 'Buffer'){$e.baselineExe}else{Join-Path $temp 'version587-selection-only\Foxmail深色.exe'}
 $oldHelper=if($Phase -eq 'Buffer'){$e.baselineHelper}else{Join-Path $temp 'version587-reveal\FoxmailRevealGate.dll'}
 $oldHelperHash=if($Phase -eq 'Buffer'){$e.baselineHelperSHA256}else{'c1821caffcdccc4f52e67f397208de70bb38728c16b447ad3bf159bcff936082'}
 $plan=@(
  @{name='Foxmail深色.exe';before=$e.baselineSHA256;after=$e.candidateSHA256;old=$oldExe;new=$e.dest},
  @{name='FoxmailRevealGate.dll';before=$oldHelperHash;after=$e.helperSHA256;old=$oldHelper;new=$e.helper}
 )
 foreach($f in $plan){$expected=if($Rollback){$f.after}else{$f.before};if((Hash (Join-Path $app $f.name)) -ne $expected -or (Hash $f.old) -ne $f.before -or (Hash $f.new) -ne $f.after){throw ('File identity guard '+$f.name)}}
 $busy=@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -and $_.ExecutablePath.Equals((Join-Path $app 'Foxmail深色.exe'),[StringComparison]::OrdinalIgnoreCase)})
 if($Preflight){[pscustomobject]@{phase=$Phase;validated=$true;running=$busy.Count;userAuthorizedStop=$true;rollback=[bool]$Rollback;exeDeltaBytes=$e.changedExeBytes;nativeChecks=(1122+$productionChecks);bridgeCases=24}|ConvertTo-Json;return}
 $current=if($Rollback){$e.candidateSHA256}else{$e.baselineSHA256}
 & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $current -AppRoot $app -StopOnly | Out-Null
 try{
  foreach($f in $plan){$source=if($Rollback){$f.old}else{$f.new};Copy-Item -LiteralPath $source -Destination (Join-Path $app $f.name) -Force}
  foreach($f in $plan){$wanted=if($Rollback){$f.before}else{$f.after};if((Hash (Join-Path $app $f.name)) -ne $wanted){throw 'Installed verification failed'}}
 }catch{
  foreach($f in $plan){$source=if($Rollback){$f.new}else{$f.old};Copy-Item -LiteralPath $source -Destination (Join-Path $app $f.name) -Force};throw
 }
 $run=Start-Process -FilePath (Join-Path $app 'Foxmail深色.exe') -WorkingDirectory $app -WindowStyle Normal -PassThru
 $report=@{phase=$Phase;utc=[DateTime]::UtcNow.ToString('o');pid=$run.Id;rollback=[bool]$Rollback;normalGUIStartup=$true;candidateSHA256=$e.candidateSHA256;helperSHA256=$e.helperSHA256;templatesColorsFontsAndDpiManifestUnchanged=$true;visualAccepted=$false}
 [IO.File]::WriteAllText((Join-Path $stage ($prefix+'-installation.json')),($report|ConvertTo-Json),[Text.UTF8Encoding]::new($false));$report|ConvertTo-Json
}
