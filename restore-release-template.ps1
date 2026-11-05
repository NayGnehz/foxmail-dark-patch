[CmdletBinding()]
param([Parameter(Mandatory)][string]$TargetRoot,[switch]$VerifyOnly)
$ErrorActionPreference='Stop'
$context=& (Join-Path $PSScriptRoot 'Invoke-FoxmailPortable.ps1') -Action Resolve
$entry=Join-Path $context.workspaceRoot '_发布\foxmail\1.0\恢复1.0.ps1'
if(!(Test-Path -LiteralPath $entry -PathType Leaf)){throw 'Restore the accepted 1.0 modification package under _发布/foxmail/1.0'}
& $entry -TargetRoot $TargetRoot -VerifyOnly:$VerifyOnly