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
 $stage=Join-Path $instance.instanceRoot 'temp\version587-compose-screen-colors'
 $m=Get-Content -LiteralPath (Join-Path $stage 'validation.json') -Raw|ConvertFrom-Json
 $tests=Get-Content -LiteralPath (Join-Path $stage 'screen-colors-tests.json') -Raw|ConvertFrom-Json
 $exeSha='233e7bdfb5f0d3e688a46b7e9eccbed3572795b5312e7d5c810ad4a8b1b387c6'
 $before='dd712386a5282d14c6a509598cdf47eb1b502bc966ca3f5eaab59b3620902501'
 $after='c3a898dcbccbe41d882c0b32bd28654d32a680ab0320ec4ec2d9b9a97d4eada8'
 $relative='7.2.25.587/Template/HtmlEditor/Common/HtmlEditor.html';$target=Join-Path $app $relative
 if($m.relative -ne $relative -or $m.input -ne $target -or $m.before -ne (Join-Path $stage 'HtmlEditor.before.html') -or $m.source -ne (Join-Path $stage 'HtmlEditor.html')){throw 'Unexpected static template paths'}
 foreach($p in @($target,$m.before,$m.source)){$null=Assert-PortablePlainPath $p}
 if($m.beforeSHA256 -ne $before -or $m.afterSHA256 -ne $after -or $m.encoding -ne 'utf16le' -or !$m.preservesChromaticHue -or !$m.caretOnlyNormalRule -or !$m.screenOnly -or !$m.originalTemplatePreserved -or !$m.firstStylePreserved -or $m.editableDomWrites -or $m.computedElementColorChanges -or $m.clipboardAccess -or $m.exportFunctionChanges){throw 'Screen colour scope guard'}
 if((Hash $m.before) -ne $before -or (Hash $m.source) -ne $after -or (Hash (Join-Path $PSScriptRoot 'compose-screen-colors.cjs')) -ne $m.generatorSHA256 -or (Hash (Join-Path $PSScriptRoot 'editor-screen-colors.css')) -ne $m.cssSHA256 -or (Hash (Join-Path $PSScriptRoot 'editor-screen-colors.js')) -ne $m.scriptSHA256 -or (Hash (Join-Path $PSScriptRoot 'editor-foreground-colors.js')) -ne $m.algorithmSHA256){throw 'Candidate sources changed'}
 if(!$tests.passed -or $tests.exportCases -ne 12 -or $tests.editingCases -ne 6 -or $tests.colorMathCases -ne 500 -or !$tests.hueGroupsAndBackgroundsChecked -or !$tests.caretDarkAndLightBackdropsChecked -or !$tests.lifecycleCleanupChecked -or !$tests.normalElementColorAndCommandsIdentical -or !$tests.bodyAndExportIdentical -or !$tests.firstStylePreserved -or !$tests.rangeEndpointUpdated -or !$tests.beforeAfterPrintIsolated -or $tests.clipboardAccess -or !$tests.syntheticOnly -or $tests.candidateSHA256 -ne $after -or $tests.colorAlgorithmSHA256 -ne $m.algorithmSHA256 -or (Hash (Join-Path $PSScriptRoot 'verify-compose-screen-colors.cjs')) -ne $tests.verifierSHA256 -or (Hash (Join-Path $PSScriptRoot 'verify-compose-screen-ink.cjs')) -ne $tests.harnessSHA256){throw 'Required actual exporter/editing/colour verification changed'}
 if((Hash (Join-Path $app 'Foxmail深色.exe')) -ne $exeSha -or (Hash (Join-Path $app 'FoxmailRevealGate.dll')) -ne '0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70' -or (Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399' -or (Hash (Join-Path $app '7.2.25.587\Template\HtmlEditor\Common\Base.css')) -ne '8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8'){throw 'Accepted software baseline changed'}
 $cef=(Get-Item -LiteralPath (Join-Path $app '7.2.25.587\cef4delphi\libcef.dll')).VersionInfo.FileVersion
 if($cef -ne '126.0.0+g03dfd39+chromium-126.0.6478.270'){throw 'Target Chromium version changed; recheck Highlight/stylesheet APIs'}
 $current=if($Rollback){$after}else{$before};$wanted=if($Rollback){$before}else{$after}
 if((Hash $target) -ne $current){throw 'Installed template changed'}
 if($Preflight){[pscustomobject]@{verified=$true;rollback=[bool]$Rollback;templateOnly=$true;targetSHA256=$wanted;cef=$cef}|ConvertTo-Json -Compress;return}
 & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $exeSha -AppRoot $app -StopOnly | Out-Null
 $source=if($Rollback){$m.before}else{$m.source};$prior=if($Rollback){$m.source}else{$m.before}
 try{[IO.File]::WriteAllBytes($target,[IO.File]::ReadAllBytes($source));if((Hash $target) -ne $wanted){throw 'Installed template verification failed'}}
 catch{[IO.File]::WriteAllBytes($target,[IO.File]::ReadAllBytes($prior));throw}
 $run=Start-Process -FilePath (Join-Path $app 'Foxmail深色.exe') -WorkingDirectory $app -WindowStyle Normal -PassThru
 $report=@{utc=[DateTime]::UtcNow.ToString('o');pid=$run.Id;rollback=[bool]$Rollback;templateOnly=$true;installedSHA256=$wanted;exeSHA256=$exeSha;startupShow='Normal';visualAccepted=$false;cef=$cef}
 $report|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $stage 'installation.json') -Encoding utf8
 $report|ConvertTo-Json -Compress
}
