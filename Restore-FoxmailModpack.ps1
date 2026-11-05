param([Parameter(Mandatory)][string]$TargetRoot,[switch]$VerifyOnly)
$ErrorActionPreference='Stop'
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$target=[IO.Path]::GetFullPath($TargetRoot)
# Deployment target is explicit; moving this modification package never moves user data.
$payload=Join-Path $PSScriptRoot 'payload'
if((Get-FileHash -LiteralPath (Join-Path $target 'Foxmail.exe')).Hash -ne $manifest.originalExecutableSHA256){throw 'Foxmail base version changed; restore stopped'}
foreach($file in $manifest.files){
 $source=[IO.Path]::GetFullPath((Join-Path $payload $file.relative))
 $dest=[IO.Path]::GetFullPath((Join-Path $target $file.relative))
 if(!$source.StartsWith($payload+'\',[StringComparison]::OrdinalIgnoreCase) -or !$dest.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid path'}
 if((Get-FileHash -LiteralPath $source).Hash -ne $file.sha256){throw ('Archive hash mismatch: '+$file.relative)}
}
if($VerifyOnly){'Archive integrity and target base version PASS; no files changed.';return}
if(Get-CimInstance Win32_Process | Where-Object {$_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe'}){throw 'Save work and fully exit Foxmail and its error reporter first'}
$backup=Join-Path $target ('DarkModeBackup\BeforeRestore1.0-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $backup | Out-Null
$previous=@()
foreach($file in $manifest.files){
 $dest=Join-Path $target $file.relative
 $saved=Join-Path $backup $file.relative
 if(Test-Path -LiteralPath $dest -PathType Leaf){
  New-Item -ItemType Directory -Path (Split-Path -Parent $saved) -Force | Out-Null
  Copy-Item -LiteralPath $dest -Destination $saved
  $hash=(Get-FileHash -LiteralPath $saved).Hash
  if((Get-FileHash -LiteralPath $dest).Hash -ne $hash){throw 'Backup verification failed'}
  $previous+=([ordered]@{relative=$file.relative;sha256=$hash})
 }
}
$previous | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $backup 'previous-hashes.json') -Encoding UTF8
try{
 foreach($file in $manifest.files){
  $dest=Join-Path $target $file.relative
  New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $payload $file.relative) -Destination $dest -Force
  if((Get-FileHash -LiteralPath $dest).Hash -ne $file.sha256){throw ('Restore verification failed: '+$file.relative)}
 }
}catch{
 foreach($file in $previous){Copy-Item -LiteralPath (Join-Path $backup $file.relative) -Destination (Join-Path $target $file.relative) -Force}
 throw
}
($manifest.files | Where-Object {$_.relative -eq 'Foxmail深色.exe'}).sha256 | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
'Restored Foxmail dark 1.0. Previous files saved in '+$backup
