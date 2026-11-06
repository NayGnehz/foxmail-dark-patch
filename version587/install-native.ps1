[CmdletBinding()]
param([switch]$Preflight,[switch]$Rollback)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
$stage=Join-Path $context.instanceRoot 'temp\version587-native'
$evidence=Get-Content -LiteralPath (Join-Path $stage 'native-colors-validation.json') -Raw|ConvertFrom-Json
$app='D:\Users\Public\Downloads\Foxmail'
$target=Join-Path $app 'Foxmail深色.exe'
$backup=Join-Path $stage 'rollback\Foxmail深色.exe'
function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
$baseline='9594dfb079e3e8e5a824d84bc193741561eb6c08dcf120e0c1215847c4ad30c6'
if((Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'){throw 'Upgraded original changed'}
$expected=if($Rollback){$evidence.candidateSHA256}else{$baseline}
if((Hash $target) -ne $expected){throw 'Current dark executable differs'}
$source=if($Rollback){$backup}else{$evidence.dest}
$wanted=if($Rollback){$baseline}else{$evidence.candidateSHA256}
if((Hash $source) -ne $wanted){throw 'Replacement hash differs'}
foreach($check in @(@('native-api-tests.log','PASS: startup + 62100'),@('initial-erase-tests.log','PASS 1509'),@('editor-canvas-tests.log','1040 assertions'))){if(!(Select-String -LiteralPath (Join-Path $stage $check[0]) -SimpleMatch $check[1])){throw 'Required test result missing'}}
$busy=@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($app+'\',[StringComparison]::OrdinalIgnoreCase) -and $_.Name -like 'Foxmail*.exe'})
if($Preflight){[pscustomobject]@{filesValidated=$true;runningProcesses=$busy.Count;readyToReplace=($busy.Count -eq 0);candidateSHA256=$evidence.candidateSHA256}|ConvertTo-Json;return}
if($busy.Count){throw 'Foxmail is running; save contents and fully exit before replacement'}
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
$null=Assert-PortablePlainPath (Split-Path $backup -Parent)
if(!$Rollback){[void][IO.Directory]::CreateDirectory((Split-Path $backup -Parent));if(Test-Path -LiteralPath $backup){if((Hash $backup) -ne $baseline){throw 'Backup collision'}}else{Copy-Item -LiteralPath $target -Destination $backup};if((Hash $backup) -ne $baseline){throw 'Backup verification failed'}}
try{Copy-Item -LiteralPath $source -Destination $target -Force;if((Hash $target) -ne $wanted){throw 'Installed hash mismatch'}}catch{if(!$Rollback){Copy-Item -LiteralPath $backup -Destination $target -Force};throw}
$report=@{utc=[DateTime]::UtcNow.ToString('o');rollback=[bool]$Rollback;installedSHA256=(Hash $target);original587Unchanged=$true;assetsOrAccountsChanged=$false;helperChanged=$false;visualAccepted=$false}
[IO.File]::WriteAllText((Join-Path $stage 'installation.json'),($report|ConvertTo-Json),[Text.UTF8Encoding]::new($false));$report|ConvertTo-Json
