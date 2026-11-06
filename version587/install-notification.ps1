[CmdletBinding()]
param([switch]$Preflight,[switch]$Rollback,[string]$AppRoot='D:\Users\Public\Downloads\Foxmail')
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 $stage=Join-Path $instance.instanceRoot 'temp\version587-notification'
 $m=Get-Content -LiteralPath (Join-Path $stage 'validation.json') -Raw|ConvertFrom-Json
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 $app=[IO.Path]::GetFullPath($AppRoot).TrimEnd('\');$null=Assert-PortablePlainPath $app
 if(!$m.allNonColorBytesUnchanged -or !$m.noNewHooksOrInstructions -or $m.changes.Count -ne 9 -or $m.changedBytes -ne 27){throw 'Toast color scope guard'}
 if((Hash $m.input) -ne $m.baselineSHA256 -or (Hash $m.dest) -ne $m.candidateSHA256 -or (Hash (Join-Path $app 'FoxmailRevealGate.dll')) -ne $m.helperSHA256){throw 'Software identity changed'}
 if((Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'){throw 'Original 587 changed'}
 $current=if($Rollback){$m.candidateSHA256}else{$m.baselineSHA256}
 if((Hash (Join-Path $app 'Foxmail深色.exe')) -ne $current){throw 'Installed candidate changed'}
 if($Preflight){[pscustomobject]@{verified=$true;changedBytes=$m.changedBytes;rollback=[bool]$Rollback;onlyNotificationColors=$true}|ConvertTo-Json;return}
 & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $current -AppRoot $app -StopOnly | Out-Null
 $source=if($Rollback){$m.input}else{$m.dest};$wanted=if($Rollback){$m.baselineSHA256}else{$m.candidateSHA256}
 try{Copy-Item -LiteralPath $source -Destination (Join-Path $app 'Foxmail深色.exe') -Force;if((Hash (Join-Path $app 'Foxmail深色.exe')) -ne $wanted){throw 'Installed verification failed'}}catch{Copy-Item -LiteralPath $(if($Rollback){$m.dest}else{$m.input}) -Destination (Join-Path $app 'Foxmail深色.exe') -Force;throw}
 $run=Start-Process -FilePath (Join-Path $app 'Foxmail深色.exe') -WorkingDirectory $app -WindowStyle Normal -PassThru
 $report=@{utc=[DateTime]::UtcNow.ToString('o');pid=$run.Id;rollback=[bool]$Rollback;installedSHA256=$wanted;onlyNotificationColors=$true;visualAccepted=$false};$report|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $stage 'installation.json') -Encoding utf8;$report|ConvertTo-Json
}
