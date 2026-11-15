# Project adapter derived from _env/templates/portable-template.ps1.
[CmdletBinding()]
param(
 [ValidateSet('Resolve','Environment','Tool')][string]$Action='Resolve',
 [string]$Tool='node',
 [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$')][string]$InstanceId='cleanup-01a1aba4'
)
$ErrorActionPreference='Stop'
$ancestor=Get-Item -LiteralPath $PSScriptRoot
while($ancestor -and !(Test-Path -LiteralPath (Join-Path $ancestor.FullName '_env\contracts\portable-v1.json'))){$ancestor=$ancestor.Parent}
if(!$ancestor){throw 'Restore the registered shared environment beside Foxmail first'}
$entry=Join-Path $ancestor.FullName '_env\bin\Invoke-Portable.ps1'
$context=& $entry -Action Resolve -ProjectId foxmail -InstanceId $InstanceId
if($Action -eq 'Resolve'){return $context}
if($Action -eq 'Tool'){
 if($Tool -eq 'zig'){
  $manifest=Get-Content -LiteralPath (Join-Path $context.environmentRoot 'manifests\ziglang-0.13.0-foxmail.json') -Raw | ConvertFrom-Json
  if($manifest.version -ne '0.13.0'){throw 'Unexpected shared Zig identity'}
  $path=Join-Path $context.environmentRoot 'tools\ziglang\0.13.0\win-x64\ziglang\zig.exe'
  if(!(Test-Path -LiteralPath $path -PathType Leaf)){throw 'Restore shared Zig 0.13.0 first'}
  return $path
 }
 return & $entry -Action Tool -ProjectId foxmail -InstanceId $InstanceId -Tool $Tool
}
$values=& $entry -Action Environment -ProjectId foxmail -InstanceId $InstanceId
$capstone=Join-Path $context.environmentRoot 'tools\python-libs\capstone\5.0.9\win-x64'
if(!(Test-Path -LiteralPath (Join-Path $capstone 'capstone\__init__.py'))){throw 'Restore shared Capstone 5.0.9 first'}
$values | Add-Member -NotePropertyName PYTHONPATH -NotePropertyValue $capstone -Force
$values | Add-Member -NotePropertyName ZIG_LOCAL_CACHE_DIR -NotePropertyValue (Join-Path $values.TEMP 'zig-local-cache') -Force
$values | Add-Member -NotePropertyName ZIG_GLOBAL_CACHE_DIR -NotePropertyValue (Join-Path $values.TEMP 'zig-global-cache') -Force
return $values
