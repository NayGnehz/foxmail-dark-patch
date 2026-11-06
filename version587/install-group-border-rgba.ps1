[CmdletBinding()]
param([switch]$Preflight,[switch]$Rollback)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 $stage=Join-Path $instance.instanceRoot 'temp\version587-group-border-rgba'
 $m=Get-Content -LiteralPath (Join-Path $stage 'validation.json') -Raw | ConvertFrom-Json
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 $app='D:\Users\Public\Downloads\Foxmail';$exe=Join-Path $app 'Foxmail深色.exe';$null=Assert-PortablePlainPath $app
 $baseline='540cf174a53e319529605b0cb3e171550783a6fe6455d29d16e5bc410f6d1f33'
 $candidate='233e7bdfb5f0d3e688a46b7e9eccbed3572795b5312e7d5c810ad4a8b1b387c6'
 $helper='0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70'
 $css='8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8'
 $pixels='280bfeafd34f9a88f2fbc2bcb94e6b2ed638960e1308f31e1eede22eb3572b08'
 $png='d0e4bae9d43590efb4ed3147b0c138e4e6f70b8ef7f758940c9ec2e6359a52c5'
 $oldPng='dd16157d271700bd887e1eb70f59aaeff4b4678f96259a031b2fe7513c892597'
 $expectedInput=Join-Path $instance.instanceRoot 'temp\version587-account-right-inset\Foxmail深色.exe'
 $expectedDest=Join-Path $stage 'Foxmail深色.exe'
 if($m.input -ne $expectedInput -or $m.dest -ne $expectedDest -or $m.asset -ne (Join-Path $stage 'Border.rgba.png')){throw 'Unexpected candidate artifact paths'}
 foreach($p in @($m.input,$m.dest,$m.asset)){$null=Assert-PortablePlainPath $p}
 if($m.baselineSHA256 -ne $baseline -or $m.candidateSHA256 -ne $candidate -or $m.helperSHA256 -ne $helper -or !$m.codeUnchanged -or !$m.allOtherResourcesUnchanged -or !$m.peHeadersUnchanged -or !$m.fileSizeUnchanged -or $m.changedBytes -ne 139){throw 'Group border RGBA scope guard'}
 if($m.resource.type -ne 10 -or $m.resource.name -ne 'SKIN_OTHER_BORDER_PNG' -or $m.resource.language -ne 0 -or $m.resource.offset -ne 21458500 -or $m.resource.dataEntry -ne 16454296 -or $m.resource.originalCapacity -ne 2922 -or $m.oldSize -ne 195 -or $m.newSize -ne 191){throw 'Unexpected group skin resource'}
 if($m.image.width -ne 141 -or $m.image.height -ne 22 -or $m.image.bitDepth -ne 8 -or $m.image.oldColorType -ne 3 -or $m.image.newColorType -ne 6 -or $m.image.rgbaBytes -ne 12408 -or !$m.image.allPixelAndAlphaBytesIdentical -or $m.image.oldPixelSHA256 -ne $pixels -or $m.image.newPixelSHA256 -ne $pixels -or $m.oldAssetSHA256 -ne $oldPng -or $m.newAssetSHA256 -ne $png){throw 'Pixel-preserving PNG format guard'}
 if((Hash $m.input) -ne $baseline -or (Hash $m.dest) -ne $candidate -or (Hash $m.asset) -ne $png){throw 'Candidate, asset or rollback file changed'}
 if((Hash (Join-Path $PSScriptRoot 'group-border-rgba.cjs')) -ne $m.generatorSHA256){throw 'Group border generator changed'}
 if((Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399' -or (Hash (Join-Path $app 'FoxmailRevealGate.dll')) -ne $helper -or (Hash (Join-Path $app '7.2.25.587\Template\HtmlEditor\Common\Base.css')) -ne $css){throw 'Accepted software/helper/CSS changed'}
 if((Hash (Join-Path $app '7.2.25.587\Skin\Controls\Border.png')) -ne $oldPng){throw 'External Controls border changed'}
 foreach($relative in @('skin\other\Border.png','7.2.25.587\skin\other\Border.png')){if(Test-Path -LiteralPath (Join-Path $app $relative)){throw 'External group skin appeared; reevaluate loader precedence'}}
 $current=if($Rollback){$candidate}else{$baseline};$wanted=if($Rollback){$baseline}else{$candidate}
 if((Hash $exe) -ne $current){throw 'Installed EXE changed'}
 if($Preflight){[pscustomobject]@{verified=$true;rollback=[bool]$Rollback;exeOnly=$true;targetSHA256=$wanted;helperSHA256=$helper;cssSHA256=$css}|ConvertTo-Json -Compress;return}
 & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $current -AppRoot $app -StopOnly | Out-Null
 $source=if($Rollback){$m.input}else{$m.dest}
 $stream=$null;$deadline=[DateTime]::UtcNow.AddSeconds(8)
 do{
  try{$stream=[IO.File]::Open($exe,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}
  catch [IO.IOException]{if([DateTime]::UtcNow -ge $deadline){throw};[Threading.Thread]::Sleep(100)}
 }while(!$stream)
 $nextBytes=[IO.File]::ReadAllBytes($source)
 $priorBytes=[IO.File]::ReadAllBytes($(if($Rollback){$m.dest}else{$m.input}))
 $hasher=[Security.Cryptography.SHA256]::Create()
 try{
  try{
   $stream.Position=0;$stream.Write($nextBytes,0,$nextBytes.Length);$stream.SetLength($nextBytes.Length);$stream.Flush($true)
   $stream.Position=0;$writtenHash=[BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-','').ToLowerInvariant()
   if($writtenHash -ne $wanted){throw 'Same-handle installed verification failed'}
  }catch{
   $stream.Position=0;$stream.Write($priorBytes,0,$priorBytes.Length);$stream.SetLength($priorBytes.Length);$stream.Flush($true);throw
  }
 }finally{$hasher.Dispose();$stream.Dispose()}
 if((Hash $exe) -ne $wanted){throw 'Installed verification failed'}
 $run=Start-Process -FilePath $exe -WorkingDirectory $app -WindowStyle Normal -PassThru
 $report=@{utc=[DateTime]::UtcNow.ToString('o');pid=$run.Id;rollback=[bool]$Rollback;installedSHA256=$wanted;exeOnly=$true;helperSHA256=$helper;cssSHA256=$css;startupShow='Normal';runningVerificationPending=$true}
 $report|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $stage 'installation.json') -Encoding utf8
 $report|ConvertTo-Json -Compress
}
