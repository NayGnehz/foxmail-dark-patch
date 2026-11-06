[CmdletBinding()]
param([switch]$Preflight,[switch]$Rollback)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 $stage=Join-Path $instance.instanceRoot 'temp\version587-account-instance-counter'
 $m=Get-Content -LiteralPath (Join-Path $stage 'validation.json') -Raw | ConvertFrom-Json
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 $app='D:\Users\Public\Downloads\Foxmail';$exe=Join-Path $app 'Foxmail深色.exe';$null=Assert-PortablePlainPath $app
 if($m.baselineSHA256 -ne '62faa3d801b1fcf8726a5b29f9636b8cc6e0fbec96e215ff7c856be6bbb5e52c' -or $m.candidateSHA256 -ne '38a4634a2ca439e33ee3578a4b4df6a3fc685f651285b7066fdc72774483030e' -or !$m.originalEntryUnchanged -or !$m.originalPayloadsExceptSlotsUnchanged -or $m.hooks.Count -ne 4){throw 'Account instance counter scope guard'}
 $slots=@(0x76a6b0,0x76a6bc,0x76a6c0,0x76a6c4);$targets=@(0x47aebc,0x76abc0,0x76ab78,0x76ab9c)
 for($i=0;$i -lt 4;$i++){if($m.hooks[$i].slotRva -ne $slots[$i] -or $m.hooks[$i].targetRva -ne $targets[$i]){throw 'Unexpected account drawing dispatch'}}
 if($m.helperSHA256 -ne '0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70'){throw 'Accepted helper identity changed'}
 if((Hash $m.input) -ne $m.baselineSHA256 -or (Hash $m.dest) -ne $m.candidateSHA256){throw 'Candidate or rollback file changed'}
 if((Hash (Join-Path $PSScriptRoot 'account-instance-counter.cjs')) -ne $m.generatorSHA256){throw 'Counter generator changed'}
 if((Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399' -or (Hash (Join-Path $app 'FoxmailRevealGate.dll')) -ne $m.helperSHA256 -or (Hash (Join-Path $app '7.2.25.587\Template\HtmlEditor\Common\Base.css')) -ne $m.cssSHA256){throw 'Baseline software changed'}
 if(!$Rollback){
  $abi=Get-Content -LiteralPath (Join-Path $stage 'abi-validation.json') -Raw | ConvertFrom-Json
  if(!$abi.passed -or $abi.fixtureExitCode -ne 0 -or $abi.expectedCases -ne 8192 -or $abi.candidateSHA256 -ne $m.candidateSHA256){throw 'Native ABI validation is missing or stale'}
  if((Hash (Join-Path $PSScriptRoot 'verify-account-instance-counter.c')) -ne $abi.sourceSHA256 -or (Hash (Join-Path $stage 'account-instance-counter-stub.h')) -ne $abi.headerSHA256 -or (Hash (Join-Path $stage 'verify-account-instance-counter.exe')) -ne $abi.fixtureSHA256){throw 'ABI validation inputs changed'}
 }
 $current=if($Rollback){$m.candidateSHA256}else{$m.baselineSHA256}
 $wanted=if($Rollback){$m.baselineSHA256}else{$m.candidateSHA256}
 if((Hash $exe) -ne $current){throw 'Installed EXE changed'}
 if($Preflight){[pscustomobject]@{verified=$true;rollback=[bool]$Rollback;candidateOnly=$true;targetSHA256=$wanted}|ConvertTo-Json -Compress;return}
 & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $current -AppRoot $app -StopOnly | Out-Null
 $source=if($Rollback){$m.input}else{$m.dest}
 # Reserve the exact stopped image while its mapping is released; use the same
 # handle for recovery. No unrelated process or application directory is used.
 $stream=$null;$deadline=[DateTime]::UtcNow.AddSeconds(8)
 do{
  try{$stream=[IO.File]::Open($exe,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}
  catch [IO.IOException]{if([DateTime]::UtcNow -ge $deadline){throw};[Threading.Thread]::Sleep(100)}
 }while(!$stream)
 $nextBytes=[IO.File]::ReadAllBytes($source)
 $priorBytes=[IO.File]::ReadAllBytes($(if($Rollback){$m.dest}else{$m.input}))
 try{
  try{$stream.Position=0;$stream.Write($nextBytes,0,$nextBytes.Length);$stream.SetLength($nextBytes.Length);$stream.Flush($true)}
  catch{$stream.Position=0;$stream.Write($priorBytes,0,$priorBytes.Length);$stream.SetLength($priorBytes.Length);$stream.Flush($true);throw}
 }finally{$stream.Dispose()}
 if((Hash $exe) -ne $wanted){throw 'Installed verification failed'}
 $run=Start-Process -FilePath $exe -WorkingDirectory $app -WindowStyle Normal -PassThru
 $report=@{utc=[DateTime]::UtcNow.ToString('o');pid=$run.Id;rollback=[bool]$Rollback;installedSHA256=$wanted;candidateOnly=$true;startupShow='Normal';runningVerificationPending=$true}
 $report|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $stage 'installation.json') -Encoding utf8
 $report|ConvertTo-Json -Compress
}
