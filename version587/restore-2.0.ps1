[CmdletBinding()]
param([Parameter(Mandatory)][string]$TargetRoot,[switch]$VerifyOnly)
$ErrorActionPreference='Stop'
$ancestor=Get-Item -LiteralPath $PSScriptRoot
while($ancestor -and !(Test-Path -LiteralPath (Join-Path $ancestor.FullName '_env\contracts\portable-v1.json'))){$ancestor=$ancestor.Parent}
if(!$ancestor){throw 'Shared portable environment not found'}
$context=& (Join-Path $ancestor.FullName '_env\bin\Invoke-Portable.ps1') -Action Resolve -ProjectId foxmail -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 $release=$PSScriptRoot;$payload=Join-Path $release 'payload';$target=[IO.Path]::GetFullPath($TargetRoot).TrimEnd('\')
 $null=Assert-PortablePlainPath $target
 $m=Get-Content -LiteralPath (Join-Path $release 'manifest.json') -Raw|ConvertFrom-Json
 if($m.release -ne '2.0' -or (Hash (Join-Path $target 'Foxmail.exe')) -ne $m.originalExecutableSHA256){throw 'Expected original Foxmail 7.2.25.587'}
 foreach($f in $m.files){
  if($f.relative -notmatch '^(Foxmail深色\.exe|FoxmailRevealGate\.dll|7\.2\.25\.587/(PngImages|Skin|Template)/[^:]+)$' -or $f.relative.Contains('..')){throw 'Unexpected payload path'}
  $source=[IO.Path]::GetFullPath((Join-Path $payload $f.relative));$dest=[IO.Path]::GetFullPath((Join-Path $target $f.relative))
  if(!$source.StartsWith($payload+'\',[StringComparison]::OrdinalIgnoreCase) -or !$dest.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Path outside allowed root'}
  $null=Assert-PortablePlainPath $source;$null=Assert-PortablePlainPath $dest
  if((Hash $source) -ne $f.sha256){throw ('Payload mismatch '+$f.relative)}
 }
 if($VerifyOnly){[pscustomobject]@{verified=$true;files=$m.files.Count;targetBase='7.2.25.587';changed=$false}|ConvertTo-Json;return}
 $busy=@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase) -and $_.Name -like 'Foxmail*.exe'})
 if($busy.Count){throw 'Fully exit this Foxmail copy before restoration'}
 $backup=Join-Path $instance.instanceRoot ('temp\restore-2.0-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff'));$null=Assert-PortablePlainPath $backup
 $previous=@()
 foreach($f in $m.files){
  $dest=Join-Path $target $f.relative;$saved=Join-Path $backup $f.relative
  if(!(Test-Path -LiteralPath $dest -PathType Leaf)){throw ('Current software file missing '+$f.relative)}
  [void][IO.Directory]::CreateDirectory((Split-Path $saved -Parent));Copy-Item -LiteralPath $dest -Destination $saved
  $hash=Hash $saved;if((Hash $dest) -ne $hash){throw 'Backup verification failed'};$previous+=@{relative=$f.relative;sha256=$hash}
 }
 try{
  foreach($f in $m.files){Copy-Item -LiteralPath (Join-Path $payload $f.relative) -Destination (Join-Path $target $f.relative) -Force;if((Hash (Join-Path $target $f.relative)) -ne $f.sha256){throw 'Restoration verification failed'}}
 }catch{foreach($f in $previous){Copy-Item -LiteralPath (Join-Path $backup $f.relative) -Destination (Join-Path $target $f.relative) -Force};throw}
 [pscustomobject]@{restored='2.0';files=$m.files.Count;backup=$backup;started=$false}|ConvertTo-Json
}
