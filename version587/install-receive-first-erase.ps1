[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$SuiteReport,[string]$InstanceId='version587-20261105')
$ErrorActionPreference='Stop'
$adapter=Join-Path (Split-Path $PSScriptRoot -Parent) 'Invoke-FoxmailPortable.ps1'
$context=& $adapter -Action Resolve -InstanceId $InstanceId
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId $InstanceId -Mode Prepare -Body {
 param($instance)
 function Assert($condition,[string]$message){if(!$condition){throw $message}}
 function Hash([string]$file){$null=Assert-PortablePlainPath $file;(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()}
 $temp=Join-Path $instance.instanceRoot 'temp'
 $null=Assert-PortablePlainPath $SuiteReport
 Assert ([IO.Path]::GetFullPath($SuiteReport).StartsWith($temp+'\',[StringComparison]::OrdinalIgnoreCase)) 'Suite report outside instance cache'
 $suite=Get-Content -LiteralPath $SuiteReport -Raw | ConvertFrom-Json
 $group='version587-dark-port-kit-receive-first-erase'
 $new=Join-Path $temp ($group+'\Foxmail-Dark-Patch.cmd')
 Assert ($suite.passed -and $suite.kitGroup -eq $group -and $suite.creationAndWriteTimes -and $suite.previousChooserV3Restored -and (Hash $new) -eq $suite.cmdSHA256) 'Expected passing CMD suite bound to this package'
 $report=Get-Content -LiteralPath (Join-Path $temp 'version587-receive-first-erase\validation.json') -Raw | ConvertFrom-Json
 $root=Assert-PortablePlainPath 'D:\Users\Public\Downloads\Foxmail'
 function Check-Closed {
  $active=@(Get-Process -Name Foxmail -ErrorAction SilentlyContinue | Where-Object {$_.Path -and [IO.Path]::GetDirectoryName($_.Path) -eq $root})
  Assert ($active.Count -eq 0) 'Close the Downloads Foxmail normally before installation'
 }
 Check-Closed
 $startingSHA=Hash (Join-Path $root 'Foxmail.exe')
 $startsOriginal=$startingSHA -eq 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'
 Assert ($startsOriginal -or $startingSHA -eq $report.baselineSHA256) 'Expected original or accepted chooser first-erase EXE before deployment'
 $backup=Join-Path $root '原版备份'
 if($startsOriginal){Assert (!(Test-Path -LiteralPath $backup)) 'Unexpected backup next to original EXE';$originalRoot=$root}
 else{$originalRoot=Assert-PortablePlainPath $backup}
 $run=Join-Path $temp ('version587-receive-first-erase-downloads-'+[Guid]::NewGuid().ToString('N').Substring(0,8))
 [void][IO.Directory]::CreateDirectory($run)
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $zip=[IO.Compression.ZipFile]::OpenRead((Join-Path $temp ($group+'\Foxmail-Dark-Port-Kit.zip')))
 try{$reader=[IO.StreamReader]::new($zip.GetEntry('manifest.json').Open());try{$manifest=$reader.ReadToEnd() | ConvertFrom-Json}finally{$reader.Dispose()}}finally{$zip.Dispose()}
 $rows=@($manifest.assets)+@($manifest.additionalAssets)+@(@{relative='Foxmail.exe';originalSHA256=$manifest.originalExecutableSHA256})
 Assert ($rows.Count -eq 41) 'Unexpected original software inventory'
 $baseline=@{}
 foreach($row in $rows){
  $file=Assert-PortablePlainPath (Join-Path $originalRoot $row.relative);$item=Get-Item -LiteralPath $file
  Assert ((Hash $file) -eq $row.originalSHA256) ('Unexpected backed-up software '+$row.relative)
  $baseline[$row.relative]=@{hash=$row.originalSHA256;creation=$item.CreationTimeUtc.Ticks.ToString();write=$item.LastWriteTimeUtc.Ticks.ToString()}
 }
 $baseline | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $run 'baseline.json') -Encoding utf8
 $entry=Join-Path $root 'Foxmail-Dark-Patch.cmd'
 Check-Closed
 [IO.File]::Copy($new,$entry,$true)
 function Invoke-Cmd([string]$mode,[string]$name){
  Check-Closed
  $config=[Diagnostics.ProcessStartInfo]::new();$config.FileName=$env:ComSpec
  $config.Arguments='/d /c ""'+$entry+'" '+$mode+'"';$config.WorkingDirectory=$root
  $config.UseShellExecute=$false;$config.CreateNoWindow=$true
  $config.RedirectStandardInput=$true;$config.RedirectStandardOutput=$true;$config.RedirectStandardError=$true
  $config.EnvironmentVariables['TEMP']=$run;$config.EnvironmentVariables['TMP']=$run
  $process=[Diagnostics.Process]::new();$process.StartInfo=$config
  try{
   [void]$process.Start();$process.StandardInput.Close()
   $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
   if(!$process.WaitForExit(60000)){throw 'CMD exceeded 60 seconds'}
   $output=$stdout.Result;$errors=$stderr.Result
   Assert ($process.ExitCode -eq 0) ('CMD failed '+$output+' '+$errors)
   $start=$output.IndexOf('{');$end=$output.LastIndexOf('}');Assert ($start -ge 0 -and $end -gt $start) 'Missing CMD report'
   $result=$output.Substring($start,$end-$start+1) | ConvertFrom-Json
   $result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $run ($name+'.json')) -Encoding utf8
   return $result
  }finally{$process.Dispose()}
 }
 function Verify-Original {
  foreach($row in $rows){$file=Join-Path $root $row.relative;$item=Get-Item -LiteralPath $file;$saved=$baseline[$row.relative]
   Assert ((Hash $file) -eq $saved.hash -and $item.CreationTimeUtc.Ticks.ToString() -eq $saved.creation -and $item.LastWriteTimeUtc.Ticks.ToString() -eq $saved.write) ('Original software/times mismatch '+$row.relative)
  }
  Assert (!(Test-Path -LiteralPath $backup)) 'Backup directory remains after restore'
  Assert (!(Test-Path -LiteralPath (Join-Path $root 'FoxmailRevealGate.dll'))) 'Helper remains after restore'
 }
 function Verify-Installed {
  $profile=$manifest.profiles.'5.0-msaa-contrast'
  Assert ((Hash (Join-Path $root 'Foxmail.exe')) -eq $report.candidateSHA256 -and $profile.exeSHA256 -eq $report.candidateSHA256) 'Final executable mismatch'
  Assert ((Hash (Join-Path $root 'FoxmailRevealGate.dll')) -eq $profile.helperSHA256) 'Helper mismatch'
  foreach($row in @($manifest.assets)+@($manifest.additionalAssets)){Assert ((Hash (Join-Path $root $row.relative)) -eq $row.sha256) ('Installed software asset mismatch '+$row.relative)}
 }
 if(!$startsOriginal){$restored=Invoke-Cmd 'restore' 'previous-restore';Assert $restored.backupRemoved 'Previous backup cleanup failed'}
 Verify-Original
 $installed=Invoke-Cmd 'apply' 'new-install';Assert ($installed.action -eq 'installed' -and $installed.backupFileCount -eq 41) 'New install failed';Verify-Installed
 $restored=Invoke-Cmd 'restore' 'new-restore';Assert $restored.backupRemoved 'New backup cleanup failed';Verify-Original
 $installed=Invoke-Cmd 'apply' 'final-install';Assert ($installed.action -eq 'installed' -and $installed.backupFileCount -eq 41) 'Final install failed';Verify-Installed
 $result=@{passed=$true;run=$run;originalFiles=41;fileCreationAndWriteTimesRestored=$true;previousChooserV3Restored=(!$startsOriginal);startedWithOriginal=$startsOriginal;newInstallRestore=$true;finalState='installed';visualAcceptance='pending';exeSHA256=$report.candidateSHA256;cmdSHA256=Hash $entry;cmdBytes=(Get-Item -LiteralPath $entry).Length}
 $result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $run 'validation.json') -Encoding utf8
 $result | ConvertTo-Json
}
