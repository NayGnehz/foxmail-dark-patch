[CmdletBinding()]
param([switch]$Preflight,[switch]$Rollback)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 $app='D:\Users\Public\Downloads\Foxmail';$null=Assert-PortablePlainPath $app
 $stage=Join-Path $instance.instanceRoot 'temp\version587-ui-followups'
 $m=Get-Content -LiteralPath (Join-Path $stage 'validation.json') -Raw|ConvertFrom-Json
 $before='233e7bdfb5f0d3e688a46b7e9eccbed3572795b5312e7d5c810ad4a8b1b387c6'
 $after='3a3f9c385c3be8734c89b8b104cb18f2d2574ed4a790cf51c8ef637abfd44d5d'
 $frameBefore='ebcef379a55b031075ca82f70ad412c9361fe41295cfd7d5d9090a522dcd834a'
 $frameAfter='405bf5f9201556cce5fe5386726e698b9fe2e64c10399a2b24d35af0f98b151e'
 $exe=Join-Path $app 'Foxmail深色.exe';$frame=Join-Path $app '7.2.25.587\Template\AddrNoteInfo\Frame.html'
 if($m.input -ne (Join-Path $instance.instanceRoot 'temp\version587-group-border-rgba\Foxmail深色.exe') -or $m.dest -ne (Join-Path $stage 'Foxmail深色.exe')){throw 'Unexpected EXE artifact paths'}
 if($m.baselineSHA256 -ne $before -or $m.candidateSHA256 -ne $after -or !$m.layersDisjoint -or !$m.guardedChainedPatchMatches -or !$m.otherResourcesUnchanged -or !$m.peHeadersAndFileSizeUnchanged -or $m.changedBytes -ne 10695 -or $m.search.changes -ne 8 -or $m.search.changedBytes -ne 10650 -or $m.search.pixelChecks -ne 410 -or $m.address.nativeColorOperands -ne 10 -or $m.address.dfmNumericProperties -ne 5 -or $m.address.changedBytes -ne 45){throw 'Combined patch scope guard'}
 if($m.template.beforeSHA256 -ne $frameBefore -or $m.template.afterSHA256 -ne $frameAfter -or $m.template.relative -ne '7.2.25.587/Template/AddrNoteInfo/Frame.html' -or !$m.template.scriptsAndContentUnchanged -or !$m.template.screenOnly -or !$m.templateTests.passed -or $m.templateTests.cases -ne 8 -or $m.templateTests.candidateSHA256 -ne $frameAfter){throw 'Address HTML verification guard'}
 $htmlStage=Join-Path $instance.instanceRoot 'temp\version587-address-html'
 if($m.template.before -ne (Join-Path $htmlStage 'Frame.before.html') -or $m.template.source -ne (Join-Path $htmlStage 'Frame.html')){throw 'Unexpected template artifact paths'}
 foreach($p in @($exe,$frame,$m.input,$m.dest,$m.template.before,$m.template.source)){$null=Assert-PortablePlainPath $p}
 if((Hash $m.input) -ne $before -or (Hash $m.dest) -ne $after -or (Hash $m.template.before) -ne $frameBefore -or (Hash $m.template.source) -ne $frameAfter){throw 'Candidate or rollback artifact changed'}
 if(!$Rollback){
  if((Hash (Join-Path $PSScriptRoot 'ui-followups.cjs')) -ne $m.generatorSHA256){throw 'Combined patch generator changed'}
  $expectedSources=@('search-style.cjs','check-search-style.cjs','patch-address-native.cjs','address-book-html.cjs','address-book-screen.css','verify-address-book-html.cjs')
  if($m.sourceBindings.Count -ne 6){throw 'Unexpected source bindings'}
  foreach($f in $m.sourceBindings){if($f.file -notin $expectedSources -or (Hash (Join-Path $PSScriptRoot $f.file)) -ne $f.sha256){throw 'Verified component source changed'}}
 }
 if((Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399' -or (Hash (Join-Path $app 'FoxmailRevealGate.dll')) -ne '0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70' -or (Hash (Join-Path $app '7.2.25.587\Template\HtmlEditor\Common\HtmlEditor.html')) -ne 'c3a898dcbccbe41d882c0b32bd28654d32a680ab0320ec4ec2d9b9a97d4eada8' -or (Hash (Join-Path $app '7.2.25.587\Template\HtmlEditor\Common\Base.css')) -ne '8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8'){throw 'Accepted software or compose text/caret baseline changed'}
 $current=if($Rollback){$after}else{$before};$wanted=if($Rollback){$before}else{$after}
 $currentFrame=if($Rollback){$frameAfter}else{$frameBefore};$wantedFrame=if($Rollback){$frameBefore}else{$frameAfter}
 if((Hash $exe) -ne $current -or (Hash $frame) -ne $currentFrame){throw 'Installed software changed'}
 if($Preflight){[pscustomobject]@{verified=$true;rollback=[bool]$Rollback;files=2;targetSHA256=$wanted;frameSHA256=$wantedFrame;composeAndHelperUnchanged=$true}|ConvertTo-Json -Compress;return}
 & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $current -AppRoot $app -StopOnly | Out-Null
 $nextExe=[IO.File]::ReadAllBytes($(if($Rollback){$m.input}else{$m.dest}))
 $priorExe=[IO.File]::ReadAllBytes($(if($Rollback){$m.dest}else{$m.input}))
 $nextFrame=[IO.File]::ReadAllBytes($(if($Rollback){$m.template.before}else{$m.template.source}))
 $priorFrame=[IO.File]::ReadAllBytes($(if($Rollback){$m.template.source}else{$m.template.before}))
 $stream=$null;$deadline=[DateTime]::UtcNow.AddSeconds(8)
 do{try{$stream=[IO.File]::Open($exe,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}catch [IO.IOException]{if([DateTime]::UtcNow -ge $deadline){throw};[Threading.Thread]::Sleep(100)}}while(!$stream)
 $hasher=[Security.Cryptography.SHA256]::Create()
 try{
  try{
   $stream.Position=0;$stream.Write($nextExe,0,$nextExe.Length);$stream.SetLength($nextExe.Length);$stream.Flush($true)
   $stream.Position=0;$written=[BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-','').ToLowerInvariant()
   if($written -ne $wanted){throw 'Same-handle EXE verification failed'}
   [IO.File]::WriteAllBytes($frame,$nextFrame);if((Hash $frame) -ne $wantedFrame){throw 'Template verification failed'}
  }catch{
   $stream.Position=0;$stream.Write($priorExe,0,$priorExe.Length);$stream.SetLength($priorExe.Length);$stream.Flush($true)
   [IO.File]::WriteAllBytes($frame,$priorFrame);throw
  }
 }finally{$hasher.Dispose();$stream.Dispose()}
 if((Hash $exe) -ne $wanted -or (Hash $frame) -ne $wantedFrame){throw 'Installed identity changed after transaction'}
 $run=Start-Process -FilePath $exe -WorkingDirectory $app -WindowStyle Normal -PassThru
 $report=@{utc=[DateTime]::UtcNow.ToString('o');pid=$run.Id;rollback=[bool]$Rollback;files=2;exeSHA256=$wanted;frameSHA256=$wantedFrame;composeAndHelperUnchanged=$true;startupShow='Normal';visualAccepted=$false}
 $report|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $stage 'installation.json') -Encoding utf8
 $report|ConvertTo-Json -Compress
}
