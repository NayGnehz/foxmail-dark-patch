[CmdletBinding()]
param([string]$InstanceId='version587-20261105',
 [ValidateSet('version587-dark-port-kit-contrast','version587-dark-port-kit-search-chooser')][string]$KitGroup='version587-dark-port-kit-contrast')
$ErrorActionPreference='Stop'
$adapter=Join-Path (Split-Path $PSScriptRoot -Parent) 'Invoke-FoxmailPortable.ps1'
$context=& $adapter -Action Resolve -InstanceId $InstanceId
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId $InstanceId -Mode Prepare -Body {
 param($instance)
 function Hash([string]$path){(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
 function Assert($condition,[string]$message){if(!$condition){throw $message}}
 $temp=Join-Path $instance.instanceRoot 'temp'
 $stage=Join-Path $temp ('version587-contrast-cmd-check-'+[Guid]::NewGuid().ToString('N').Substring(0,8))
 [void][IO.Directory]::CreateDirectory($stage)
 $kit=Join-Path $stage 'kit';Add-Type -AssemblyName System.IO.Compression.FileSystem
 [IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $temp ($KitGroup+'\Foxmail-Dark-Port-Kit.zip')),$kit)
 $manifest=Get-Content -LiteralPath (Join-Path $kit 'manifest.json') -Raw | ConvertFrom-Json
 $rows=@($manifest.assets)+@($manifest.additionalAssets)+@(@{relative='Foxmail.exe';originalSHA256=$manifest.originalExecutableSHA256})
 Assert ($rows.Count -eq 41) 'Expected 41 original software files'
 $source='D:\Users\Public\Downloads\Foxmail'
 if(Test-Path -LiteralPath (Join-Path $source '原版备份\Foxmail.exe')){$source=Join-Path $source '原版备份'}
 $root=Join-Path $stage 'Foxmail 中文 & !';[void][IO.Directory]::CreateDirectory($root)
 $baseline=@{}
 foreach($row in $rows){
  $from=Assert-PortablePlainPath (Join-Path $source $row.relative);$to=Join-Path $root $row.relative
  Assert ((Hash $from) -eq $row.originalSHA256) ('Fixture original mismatch '+$row.relative)
  $item=Get-Item -LiteralPath $from
  [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($to));[IO.File]::Copy($from,$to)
  $copy=Get-Item -LiteralPath $to;$copy.CreationTimeUtc=$item.CreationTimeUtc;$copy.LastWriteTimeUtc=$item.LastWriteTimeUtc
  $baseline[$row.relative]=@{hash=$row.originalSHA256;creation=$copy.CreationTimeUtc.Ticks;write=$copy.LastWriteTimeUtc.Ticks}
 }
 function Verify-Original {
  foreach($row in $rows){$file=Join-Path $root $row.relative;$item=Get-Item -LiteralPath $file;$saved=$baseline[$row.relative]
   Assert ((Hash $file) -eq $saved.hash) ('Restore bytes '+$row.relative)
   Assert ($item.CreationTimeUtc.Ticks -eq $saved.creation -and $item.LastWriteTimeUtc.Ticks -eq $saved.write) ('Restore file timestamps '+$row.relative)
  }
  Assert (!(Test-Path -LiteralPath (Join-Path $root '原版备份'))) 'Backup directory remains'
  Assert (!(Test-Path -LiteralPath (Join-Path $root 'FoxmailRevealGate.dll'))) 'Helper remains'
 }
 $counter=0
 function Invoke-Cmd([string]$entry,[string]$mode,[int]$expected=0){
  $script:counter++
  $config=[Diagnostics.ProcessStartInfo]::new();$config.FileName=$env:ComSpec
  $config.Arguments='/d /c ""'+$entry+'" '+$mode+'"';$config.WorkingDirectory=$root
  $config.UseShellExecute=$false;$config.CreateNoWindow=$true
  $config.RedirectStandardInput=$true;$config.RedirectStandardOutput=$true;$config.RedirectStandardError=$true
  $config.EnvironmentVariables['TEMP']=$stage;$config.EnvironmentVariables['TMP']=$stage
  $process=[Diagnostics.Process]::new();$process.StartInfo=$config
  try{
   [void]$process.Start();$process.StandardInput.Close()
   $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
   if(!$process.WaitForExit(60000)){throw 'CMD exceeded 60 seconds'}
   $output=$stdout.Result;$errors=$stderr.Result
   [IO.File]::WriteAllText((Join-Path $stage ('cmd-'+$script:counter+'.log')),$output+$errors)
   Assert ($process.ExitCode -eq $expected) ('CMD exit '+$process.ExitCode+' '+$errors+' '+$output)
   if($expected -ne 0){return $errors}
   $start=$output.IndexOf('{');$end=$output.LastIndexOf('}')
   Assert ($start -ge 0 -and $end -gt $start) ('Missing report '+$output)
   return $output.Substring($start,$end-$start+1) | ConvertFrom-Json
  }finally{$process.Dispose()}
 }
 $cmd=Join-Path $root 'Foxmail-Dark-Patch.cmd';$new=Join-Path $temp ($KitGroup+'\Foxmail-Dark-Patch.cmd')
 [IO.File]::Copy($new,$cmd)
 $check=Invoke-Cmd $cmd 'check';Assert $check.canGenerate 'Preflight rejected fixture'
 $install=Invoke-Cmd $cmd 'apply';Assert ($install.action -eq 'installed' -and $install.backupFileCount -eq 41) 'New install count'
 $newProfile=$manifest.profiles.'5.0-msaa-contrast'
 Assert ((Hash (Join-Path $root 'Foxmail.exe')) -eq $newProfile.exeSHA256) 'New EXE mismatch'
 Assert ((Hash (Join-Path $root 'FoxmailRevealGate.dll')) -eq $newProfile.helperSHA256) 'New helper mismatch'
 foreach($row in @($manifest.assets)+@($manifest.additionalAssets)){Assert ((Hash (Join-Path $root $row.relative)) -eq $row.sha256) ('Installed asset '+$row.relative)}
 $identity=[IO.File]::ReadAllText((Join-Path $root '原版备份\backup-identity.txt'))
 Assert ($identity.StartsWith('FoxmailDarkBackup/3 ')) 'New backup must reject old incomplete restorers'
 $old=Join-Path $stage 'old.cmd';[IO.File]::Copy((Join-Path $temp 'version587-dark-port-kit-msaa\Foxmail-Dark-Patch.cmd'),$old)
 # CMD locates its own folder, so run the old entry under the fixture root.
 $oldEntry=Join-Path $root 'old.cmd';[IO.File]::Copy($old,$oldEntry)
 $rejection=Invoke-Cmd $oldEntry 'restore' 1
 Assert ($rejection -match 'not recognized') 'Old CMD did not reject the new inventory before mutation'
 Assert ((Hash (Join-Path $root 'Foxmail.exe')) -eq $newProfile.exeSHA256) 'Old CMD mutated new install'
 $restore=Invoke-Cmd $cmd 'restore';Assert $restore.backupRemoved 'New backup cleanup failed';Verify-Original
 $oldInstall=Invoke-Cmd $oldEntry 'apply';Assert ($oldInstall.backupFileCount -eq 40) 'Expected old 40-file backup'
 $oldRestore=Invoke-Cmd $cmd 'restore';Assert $oldRestore.backupRemoved 'Old backup cleanup failed';Verify-Original
 if($KitGroup -eq 'version587-dark-port-kit-search-chooser'){
  $previous=Join-Path $root 'previous.cmd';[IO.File]::Copy((Join-Path $temp 'version587-dark-port-kit-contrast\Foxmail-Dark-Patch.cmd'),$previous)
  [void](Invoke-Cmd $previous 'apply');Assert ((Hash (Join-Path $root 'Foxmail.exe')) -eq '77fcfb3a2f4552463ac89534040fce36408643a536a706e2e3cad9a47d33ba19') 'Previous v3 fixture mismatch'
  [void](Invoke-Cmd $cmd 'restore');Verify-Original
 }
 $trial=Invoke-Cmd $cmd 'trial';Assert ($trial.backupFileCount -eq 40) 'Trial changed additional attachment asset'
 Assert ((Hash (Join-Path $root '7.2.25.587\PngImages\attach_select.png')) -eq $baseline['7.2.25.587/PngImages/attach_select.png'].hash) 'Trial inherited optional asset'
 [void](Invoke-Cmd $cmd 'restore');Verify-Original
 # No-argument double-click path must install, then restore, despite PAUSE.
 [void](Invoke-Cmd $cmd '');[void](Invoke-Cmd $cmd '');Verify-Original
 $oldKit=Join-Path $stage 'old-kit'
 [IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $temp 'version587-dark-port-kit-msaa\Foxmail-Dark-Port-Kit.zip'),$oldKit)
 $powershell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
 $output=Join-Path $stage 'old-manifest-output'
 $result=& $powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $kit 'Apply-FoxmailDark.ps1') -AppRoot $root -Profile '5.0-msaa' -KitRoot $oldKit -OutputDirectory $output
 Assert ($LASTEXITCODE -eq 0) ('New loader with old manifest '+($result -join ' '))
 Assert ((Hash (Join-Path $output 'Foxmail深色.exe')) -eq 'eee4f4bd6d0241aad5e86bfaf121fd2b4a4a1a32c45d04d9584f798f699f82be') 'Old manifest produced a different executable'
 Verify-Original
 $report=@{passed=$true;kitGroup=$KitGroup;previousV3Restored=($KitGroup -eq 'version587-dark-port-kit-search-chooser');oldManifestCompatible=$true;originalFiles=41;creationAndWriteTimes=$true;newInstallRestore=$true;oldInstallNewRestore=$true;trialUnchanged=$true;doubleClickToggle=$true;oldCmdSafelyRejectsNewBackup=$true;cmdSHA256=Hash $new;stage=$stage}
 $report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stage 'validation.json') -Encoding utf8
 $report | ConvertTo-Json
}
