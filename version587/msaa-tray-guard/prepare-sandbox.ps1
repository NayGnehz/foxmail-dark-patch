[CmdletBinding()]
param(
    [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$')]
    [string]$InstanceId = 'version587-20261105',
    [Parameter(Mandatory)]
    [ValidatePattern('^version587-guard-wsb-[a-f0-9]{8}$')]
    [string]$SoftwareStage
)

$ErrorActionPreference = 'Stop'
$project = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$ctx = & (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId $InstanceId
Import-Module (Join-Path $ctx.environmentRoot 'bin\PortableCache.psm1')

Invoke-PortableInstance -ProjectId foxmail -InstanceId $InstanceId -Mode Prepare -Body {
    param($instance)
    $temp = Join-Path $instance.instanceRoot 'temp'
    $software = Assert-PortablePlainPath (Join-Path (Join-Path $temp $SoftwareStage) 'guest-input')
    $app = Assert-PortablePlainPath (Join-Path $software 'Foxmail')
    $original = Assert-PortablePlainPath (Join-Path $app 'Foxmail.exe')
    $packaged = Assert-PortablePlainPath (Join-Path $temp 'version587-dark-port-kit-msaa\Foxmail-Dark-Patch.cmd')
    $guestEntry = Assert-PortablePlainPath (Join-Path $app 'Foxmail-Dark-Patch.cmd')
    $build = Assert-PortablePlainPath (Join-Path $temp 'version587-msaa-tray-guard\build.json')
    $candidate = (Get-Content -LiteralPath $build -Raw | ConvertFrom-Json).candidateSHA256
    if ($candidate -notmatch '^[0-9a-f]{64}$' -or
        (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash -ne 'F208B5C29816D1A5CA5859EDBAF1B5E83F2C8E9CAB2CFE0C3FDFDD4566D5B399' -or
        (Get-FileHash -LiteralPath $guestEntry -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $packaged -Algorithm SHA256).Hash) {
        throw 'The staged software must match the verified stock executable and guarded CMD'
    }
    $mappedEntries = @(Get-ChildItem -LiteralPath $software -Force)
    $appEntries = @(Get-ChildItem -LiteralPath $app -Force)
    if (@($mappedEntries | Where-Object Name -notin 'Foxmail', 'Start-Guest.ps1').Count -or
        $appEntries.Count -ne 3 -or
        @($appEntries | Where-Object Name -notin 'Foxmail.exe', 'Foxmail-Dark-Patch.cmd', '7.2.25.587').Count) {
        throw 'The staging directory must contain only the expected software'
    }
    if (@(Get-ChildItem -LiteralPath $software -Force -Recurse |
            Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) {
        throw 'The software staging directory must not contain reparse points'
    }
    if (!(Test-Path -LiteralPath (Join-Path $app '7.2.25.587\cef4delphi\libcef.dll') -PathType Leaf)) {
        throw 'The staged application is missing its CEF runtime'
    }

    $tools = Assert-PortablePlainPath (Join-Path $temp 'version587-guard-sandbox-tools')
    [void][IO.Directory]::CreateDirectory($tools)
    $toolNames = 'guest-start.ps1', 'guest-mail.ps1', 'guest-list.ps1'
    if (@(Get-ChildItem -LiteralPath $tools -Force | Where-Object Name -notin $toolNames).Count) {
        throw 'Unexpected entry in the guest tools directory'
    }
    foreach ($name in $toolNames) {
        $source = Assert-PortablePlainPath (Join-Path $PSScriptRoot $name)
        $dest = Assert-PortablePlainPath (Join-Path $tools $name)
        [IO.File]::Copy($source, $dest, $true)
    }

    $softwareXml = [Security.SecurityElement]::Escape($software)
    $toolsXml = [Security.SecurityElement]::Escape($tools)
    $configuration = @"
<Configuration>
  <Networking>Disable</Networking>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <PrinterRedirection>Disable</PrinterRedirection>
  <AudioInput>Disable</AudioInput>
  <VideoInput>Disable</VideoInput>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>$softwareXml</HostFolder>
      <SandboxFolder>C:\FoxmailGuestInput</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
    <MappedFolder>
      <HostFolder>$toolsXml</HostFolder>
      <SandboxFolder>C:\FoxmailGuestTools</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>powershell.exe -NoLogo -NoProfile -NoExit -Command ". ([scriptblock]::Create([IO.File]::ReadAllText('C:\FoxmailGuestTools\guest-start.ps1'))) -CandidateSHA256 $candidate"</Command>
  </LogonCommand>
</Configuration>
"@
    [void][xml]$configuration
    $wsb = Assert-PortablePlainPath (Join-Path $temp 'Foxmail-Guard-Inbox-Test.wsb')
    [IO.File]::WriteAllText($wsb, $configuration, [Text.UTF8Encoding]::new($false))
    [ordered]@{sandbox = $wsb; candidateSHA256 = $candidate; software = $software; tools = $tools} |
        ConvertTo-Json -Compress
}
