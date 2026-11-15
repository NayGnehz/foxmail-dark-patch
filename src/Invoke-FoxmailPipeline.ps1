[CmdletBinding()]
param(
 [Parameter(Mandatory)][string]$Script,
 [ValidateSet('node','python')][string]$Tool='node',
 [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$')][string]$InstanceId='cleanup-01a1aba4',
 [Parameter(ValueFromRemainingArguments)][string[]]$ScriptArguments=@()
)
$ErrorActionPreference='Stop'
$adapter=Join-Path $PSScriptRoot 'Invoke-FoxmailPortable.ps1'
$context=& $adapter -Action Resolve -InstanceId $InstanceId
$values=& $adapter -Action Environment -InstanceId $InstanceId
$executable=& $adapter -Action Tool -Tool $Tool -InstanceId $InstanceId
$scriptPath=[IO.Path]::GetFullPath($Script)
if(!$scriptPath.StartsWith($PSScriptRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or !(Test-Path -LiteralPath $scriptPath -PathType Leaf)){throw 'Pipeline source must belong to this project'}
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId $InstanceId -Mode Prepare -Body {
 param($instance)
 $null=Assert-PortablePlainPath $scriptPath
 $previous=@{}
 try {
  foreach($property in $values.PSObject.Properties){$previous[$property.Name]=[Environment]::GetEnvironmentVariable($property.Name,'Process');[Environment]::SetEnvironmentVariable($property.Name,[string]$property.Value,'Process')}
  foreach($key in @('FOXMAIL_PIPELINE_LEASE','FOXMAIL_PROJECT_ROOT')){$previous[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
  $env:FOXMAIL_PIPELINE_LEASE=$instance.instanceRoot
  $env:FOXMAIL_PROJECT_ROOT=$PSScriptRoot
  $null=Assert-PortablePlainPath $env:TEMP
  [void][IO.Directory]::CreateDirectory($env:TEMP)
  Push-Location -LiteralPath $env:TEMP
  try { & $executable $scriptPath @ScriptArguments; if($LASTEXITCODE){throw "Pipeline step failed: $LASTEXITCODE"} } finally {Pop-Location}
 } finally {foreach($key in $previous.Keys){[Environment]::SetEnvironmentVariable($key,$previous[$key],'Process')}}
}
