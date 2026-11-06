[CmdletBinding()]
param([switch]$Preflight,[switch]$Rollback)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 $stage=Join-Path $instance.instanceRoot 'temp\version587-compose-ready'
 $m=Get-Content -LiteralPath (Join-Path $stage 'validation.json') -Raw | ConvertFrom-Json
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 # Filled only after the actual emitted bridge and native helper pass review.
 $candidateSha='62faa3d801b1fcf8726a5b29f9636b8cc6e0fbec96e215ff7c856be6bbb5e52c'
 $helperSha='0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70'
 $baselineSha='4ca3440e7da018de28d3b920f93ba38af3f8500d1a767a7c091430577b6853c3'
 $baselineHelperSha='29efc7d9ec5b402f6a00a165a586f0762ec51aa2495cdcdc8e0a5fb31bc05515'
 if($candidateSha -notmatch '^[a-f0-9]{64}$' -or $helperSha -notmatch '^[a-f0-9]{64}$'){throw 'Async compose candidate has not been approved by its build checks'}
 if($m.baselineSHA256 -ne $baselineSha -or $m.baselineHelperSHA256 -ne $baselineHelperSha -or $m.candidateSHA256 -ne $candidateSha -or $m.helperSHA256 -ne $helperSha){throw 'Async compose candidate identity guard'}
 $app='D:\Users\Public\Downloads\Foxmail'
 $null=Assert-PortablePlainPath $app
 $exe=Join-Path $app 'Foxmail深色.exe';$dll=Join-Path $app 'FoxmailRevealGate.dll'
 foreach($file in @($m.input,$m.dest,$m.helperInput,$m.helper)){$null=Assert-PortablePlainPath $file}
 if((Hash $m.input) -ne $baselineSha -or (Hash $m.dest) -ne $candidateSha -or (Hash $m.helperInput) -ne $baselineHelperSha -or (Hash $m.helper) -ne $helperSha){throw 'Candidate or rollback software changed'}
 if((Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399' -or (Hash (Join-Path $app '7.2.25.587\Template\HtmlEditor\Common\Base.css')) -ne '8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8'){throw 'Other baseline software changed'}
 if(!$Rollback){
  if(!$m.passed -or !$m.nativeOwnWindowsPassed -or !$m.productionHelperPassed -or $m.bridgeCases -lt 3840 -or !$m.originalEntryUnchanged -or !$m.acceptedBorderPayloadsPreserved -or !$m.FxColdRunPreserved){throw 'Async compose validation did not pass'}
  if($m.validatedFiles.Count -lt 20){throw 'Incomplete async validation bindings'}
  foreach($f in $m.validatedFiles){
   $null=Assert-PortablePlainPath $f.path
   if((Hash $f.path) -ne $f.sha256){throw 'Async source, fixture or validation evidence changed'}
  }
  foreach($required in @($m.dest,$m.helper,(Join-Path $PSScriptRoot 'compose-ready-package.cjs'))){
   if(!@($m.validatedFiles|Where-Object {$_.path -eq $required}).Count){throw 'Required candidate validation binding is missing'}
  }
 }
 $files=@(
  @{target=$exe;prior=$m.input;next=$m.dest;priorSha=$baselineSha;nextSha=$candidateSha},
  @{target=$dll;prior=$m.helperInput;next=$m.helper;priorSha=$baselineHelperSha;nextSha=$helperSha}
 )
 if($Rollback){foreach($f in $files){$tmp=$f.prior;$f.prior=$f.next;$f.next=$tmp;$tmp=$f.priorSha;$f.priorSha=$f.nextSha;$f.nextSha=$tmp}}
 foreach($f in $files){if((Hash $f.target) -ne $f.priorSha){throw 'Installed software changed'}}
 if($Preflight){[pscustomobject]@{verified=$true;rollback=[bool]$Rollback;targetSHA256=$files[0].nextSha;helperSHA256=$files[1].nextSha}|ConvertTo-Json -Compress;return}
 & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $files[0].priorSha -AppRoot $app -StopOnly | Out-Null
 $streams=@();$priorBytes=@();$nextBytes=@()
 function StreamHash([IO.FileStream]$stream){
  $stream.Position=0;$sha=[Security.Cryptography.SHA256]::Create()
  try{return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 }
 try {
  foreach($f in $files){
   $stream=$null;$deadline=[DateTime]::UtcNow.AddSeconds(8)
   do{
    try{$stream=[IO.File]::Open($f.target,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}
    catch [IO.IOException]{if([DateTime]::UtcNow -ge $deadline){throw};[Threading.Thread]::Sleep(100)}
   }while(!$stream)
   $streams+=,$stream
   if((StreamHash $stream) -ne $f.priorSha){throw 'Stopped file changed before exclusive replacement'}
   $priorBytes+=,[IO.File]::ReadAllBytes($f.prior)
   $nextBytes+=,[IO.File]::ReadAllBytes($f.next)
  }
  function WriteChecked([IO.FileStream]$stream,[byte[]]$bytes,[string]$expected){
   $stream.Position=0;$stream.Write($bytes,0,$bytes.Length);$stream.SetLength($bytes.Length);$stream.Flush($true)
   $actual=StreamHash $stream
   if($actual -ne $expected){throw 'Exclusive-handle replacement verification failed'}
  }
  try{for($i=0;$i -lt $files.Count;$i++){WriteChecked $streams[$i] $nextBytes[$i] $files[$i].nextSha}}
  catch{
   for($i=0;$i -lt $files.Count;$i++){WriteChecked $streams[$i] $priorBytes[$i] $files[$i].priorSha}
   throw
  }
 } finally {foreach($stream in $streams){$stream.Dispose()}}
 $run=Start-Process -FilePath $exe -WorkingDirectory $app -WindowStyle Normal -PassThru
 $report=@{utc=[DateTime]::UtcNow.ToString('o');pid=$run.Id;rollback=[bool]$Rollback;installedSHA256=$files[0].nextSha;helperSHA256=$files[1].nextSha;candidateOnly=$true;startupShow='Normal';runningVerificationPending=$true}
 $report|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $stage 'installation.json') -Encoding utf8
 $report|ConvertTo-Json -Compress
}
