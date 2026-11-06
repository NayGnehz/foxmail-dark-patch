[CmdletBinding()]
param([switch]$Preflight,[switch]$Rollback,[string]$AppRoot='D:\Users\Public\Downloads\Foxmail')
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
$stage=Join-Path $context.instanceRoot 'temp\version587-selection-only'
$plan=Get-Content -LiteralPath (Join-Path $stage 'validation.json') -Raw|ConvertFrom-Json
function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
if((Hash $plan.dest) -ne $plan.candidateSHA256 -or (Hash $plan.baselineSource) -ne $plan.baselineSHA256 -or (Hash $plan.template.source) -ne $plan.template.afterSHA256){throw 'Recovery source hash mismatch'}
if($plan.changedBytes -ne 12){throw 'Unexpected selection-only code delta'}
if(!$Rollback){
 # Reuse the checked two-file rollback transaction, before applying colors only.
 if($Preflight){& (Join-Path $PSScriptRoot 'install-next.ps1') -Rollback -Preflight -AppRoot $AppRoot;[pscustomobject]@{candidateValidated=$true;selectionChangedBytes=12;candidateSHA256=$plan.candidateSHA256;headersAndManifestUnchanged=$true}|ConvertTo-Json;return}
 & (Join-Path $PSScriptRoot 'install-next.ps1') -Rollback -AppRoot $AppRoot
}
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 $app=[IO.Path]::GetFullPath($AppRoot).TrimEnd('\');$null=Assert-PortablePlainPath $app
 $target=Join-Path $app 'Foxmail深色.exe'
 $expected=if($Rollback){$plan.candidateSHA256}else{$plan.baselineSHA256}
 if((Hash $target) -ne $expected){throw 'Current executable changed'}
 if((Hash (Join-Path $app $plan.template.relative)) -ne $plan.template.afterSHA256){throw 'Editor shell is not the restored baseline'}
 if((Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399' -or (Hash (Join-Path $app 'FoxmailRevealGate.dll')) -ne 'c1821caffcdccc4f52e67f397208de70bb38728c16b447ad3bf159bcff936082'){throw 'Original or helper changed'}
 $busy=@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($app+'\',[StringComparison]::OrdinalIgnoreCase) -and $_.Name -like 'Foxmail*.exe'})
 if($Preflight){[pscustomobject]@{validated=$true;rollback=[bool]$Rollback;runningProcesses=$busy.Count;readyToReplace=($busy.Count -eq 0)}|ConvertTo-Json;return}
 if($busy.Count){throw 'Save contents and fully exit Foxmail before replacement'}
 $source=if($Rollback){$plan.baselineSource}else{$plan.dest};$wanted=if($Rollback){$plan.baselineSHA256}else{$plan.candidateSHA256}
 try{Copy-Item -LiteralPath $source -Destination $target -Force;if((Hash $target) -ne $wanted){throw 'Installed hash mismatch'}}catch{Copy-Item -LiteralPath $plan.baselineSource -Destination $target -Force;throw}
 $report=@{utc=[DateTime]::UtcNow.ToString('o');rollback=[bool]$Rollback;installedSHA256=$wanted;selectionChangedBytes=12;edgeAndEarlyRootExperimentRemoved=$true;headersAndDpiManifestUnchanged=$true;visualAccepted=$false}
 [IO.File]::WriteAllText((Join-Path $stage 'installation.json'),($report|ConvertTo-Json),[Text.UTF8Encoding]::new($false));$report|ConvertTo-Json
}
