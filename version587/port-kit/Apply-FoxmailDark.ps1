#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$AppRoot,
    [ValidatePattern('^\d+\.\d+\.\d+\.\d+$')][string]$VersionFolder,
    [ValidateNotNullOrEmpty()][string]$OutputDirectory,
    [ValidateSet('5.0', 'deployed-trial')][string]$Profile = '5.0',
    [Parameter(DontShow)][string]$KitRoot = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'
$comparison = [StringComparison]::OrdinalIgnoreCase
$absolute = '^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$))'
$hashPattern = '^[0-9a-f]{64}$'
$baseVersion = '7.2.25.587'
$Profile = $Profile.ToLowerInvariant()

function Get-PlainPath([string]$path) {
    if ($path -match '^[\\/]{2}[.?][\\/]|[\x00-\x1f]|[ .](?:[\\/]|$)') {
        throw 'Invalid Windows path'
    }
    $full = [IO.Path]::GetFullPath($path)
    if ($full.Substring([IO.Path]::GetPathRoot($full).Length).Contains(':')) {
        throw 'Alternate data streams are not accepted'
    }
    for ($itemPath = $full; $itemPath; $itemPath = [IO.Path]::GetDirectoryName($itemPath)) {
        $item = Get-Item -LiteralPath $itemPath -Force -ErrorAction SilentlyContinue
        if ($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw ('Reparse point is outside the supported path model ' + $itemPath)
        }
    }
    return $full
}

function Read-Json([string]$path) {
    $safe = Get-PlainPath $path
    [IO.File]::ReadAllText($safe) | ConvertFrom-Json
}

function Get-Sha256($bytesOrStream) {
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        [BitConverter]::ToString($algorithm.ComputeHash($bytesOrStream)).Replace('-', '').ToLowerInvariant()
    } finally {
        $algorithm.Dispose()
    }
}

function Get-SoftwareHash([string]$path) {
    $stream = [IO.File]::OpenRead($path)
    try {
        Get-Sha256 $stream
    } finally {
        $stream.Dispose()
    }
}

function Read-Integer($value, [string]$label) {
    $number = 0L
    if ($null -eq $value -or ![long]::TryParse([string]$value, [Globalization.NumberStyles]::None,
            [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
        throw ('Invalid integer in ' + $label)
    }
    return $number
}

function Read-CheckedBytes([string]$path, [long]$length, [string]$hash) {
    $safe = Get-PlainPath $path
    if ((Get-Item -LiteralPath $safe).Length -ne $length) {
        throw ('Software length differs from the manifest ' + $safe)
    }
    $bytes = [IO.File]::ReadAllBytes($safe)
    if ($bytes.LongLength -ne $length -or (Get-Sha256 $bytes) -ne $hash) {
        throw ('Software hash differs from the manifest ' + $safe)
    }
    return ,$bytes
}

function Get-ExecutableLayout([string]$path) {
    $stream = [IO.File]::OpenRead($path)
    $reader = [IO.BinaryReader]::new($stream)
    try {
        if ($stream.Length -lt 64 -or $reader.ReadUInt16() -ne 0x5a4d) {
            return @{architecture = 'unknown'; format = 'not-pe'}
        }
        $stream.Position = 60
        $pe = $reader.ReadUInt32()
        if ($pe -lt 64 -or $pe -gt $stream.Length - 26) {
            return @{architecture = 'unknown'; format = 'invalid-pe'}
        }
        $stream.Position = $pe
        if ($reader.ReadUInt32() -ne 0x4550) {
            return @{architecture = 'unknown'; format = 'invalid-pe'}
        }
        $machine = $reader.ReadUInt16()
        $architecture = switch ($machine) {
            0x014c { 'x86' }
            0x8664 { 'x64' }
            0xaa64 { 'arm64' }
            default { 'unknown' }
        }
        $stream.Position = $pe + 20
        $optionalSize = $reader.ReadUInt16()
        if ($optionalSize -lt 2 -or $pe + 24 + $optionalSize -gt $stream.Length) {
            return @{architecture = $architecture; format = 'invalid-pe'}
        }
        $stream.Position = $pe + 24
        $format = switch ($reader.ReadUInt16()) {
            0x010b { 'PE32' }
            0x020b { 'PE32+' }
            default { 'invalid-pe' }
        }
        return @{architecture = $architecture; format = $format; machine = ('0x{0:x4}' -f $machine)}
    } finally {
        $reader.Dispose()
    }
}

function Convert-Hex([string]$hex) {
    if ([Environment]::Version.Major -ge 5) { return ,([Convert]::FromHexString($hex)) }
    $bytes = [byte[]]::new($hex.Length / 2)
    for ($i = 0; $i -lt $bytes.Length; $i++) {
        $bytes[$i] = [Convert]::ToByte($hex.Substring($i * 2, 2), 16)
    }
    return ,$bytes
}

$kit = Get-PlainPath $KitRoot
$manifest = Read-Json (Join-Path $kit 'manifest.json')
if ($manifest.schema -ne 1 -or $manifest.baseVersion -cne $baseVersion -or
    $manifest.originalExecutableSHA256 -notmatch $hashPattern -or @($manifest.assets).Count -ne 39 -or
    $null -eq $manifest.profiles) {
    throw 'Invalid Foxmail kit manifest'
}
$entry = $manifest.profiles.PSObject.Properties[$Profile]
if ($null -eq $entry) { throw ('Missing patch profile ' + $Profile) }
$selected = $entry.Value
if ($selected.exeSHA256 -notmatch $hashPattern -or $selected.helperSHA256 -notmatch $hashPattern -or
    $selected.patch -cne "profiles/$Profile/exe-delta.json" -or
    $selected.helper -cne "profiles/$Profile/FoxmailRevealGate.dll") {
    throw ('Invalid patch profile ' + $Profile)
}
$originalLength = Read-Integer $manifest.originalExecutableLength 'original EXE length'
$exeLength = Read-Integer $selected.exeLength 'patched EXE length'
$helperLength = Read-Integer $selected.helperLength 'helper length'
if ($originalLength -lt 64 -or $exeLength -lt $originalLength -or $exeLength -gt [int]::MaxValue -or
    $helperLength -lt 64 -or $helperLength -gt [int]::MaxValue) { throw 'Invalid patch profile lengths' }

$root = Get-PlainPath $AppRoot
if (![IO.Directory]::Exists($root)) { throw 'AppRoot must be the Foxmail software folder' }
$exe = Get-PlainPath (Join-Path $root 'Foxmail.exe')
if (![IO.File]::Exists($exe)) { throw 'AppRoot must contain Foxmail.exe' }
$layout = Get-ExecutableLayout $exe
$fileVersion = [Diagnostics.FileVersionInfo]::GetVersionInfo($exe).FileVersion
$versionMatch = [regex]::Match([string]$fileVersion, '(?<![\d.])\d+\.\d+\.\d+\.\d+(?![\d.])')
$detectedVersion = if ($versionMatch.Success) { $versionMatch.Value } else { $null }
if (!$VersionFolder) {
    if (!$detectedVersion) { throw 'Cannot infer the version folder. Specify -VersionFolder explicitly.' }
    $VersionFolder = $detectedVersion
}
$exeHash = Get-SoftwareHash $exe
$length = (Get-Item -LiteralPath $exe).Length
$exeMatches = $layout.architecture -eq 'x86' -and $layout.format -eq 'PE32' -and
    $length -eq $originalLength -and $exeHash -eq $manifest.originalExecutableSHA256

$paths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$assetRows = @(
    foreach ($asset in $manifest.assets) {
        $relative = [string]$asset.relative
        if ($relative -notmatch '^7\.2\.25\.587/(?:PngImages|Skin|Template)/(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+\.(?:png|html|css)$' -or
            $relative -match '(?:^|/)\.{1,2}(?:/|$)|[.](?:/|$)' -or !$paths.Add($relative) -or
            $asset.sha256 -notmatch $hashPattern -or
            ($null -ne $asset.originalSHA256 -and $asset.originalSHA256 -notmatch $hashPattern)) {
            throw ('Invalid asset manifest entry ' + $relative)
        }
        $assetLength = Read-Integer $asset.length 'asset length'
        if ($assetLength -gt [int]::MaxValue) { throw ('Asset exceeds the supported length ' + $relative) }
        $targetRelative = $VersionFolder + $relative.Substring($baseVersion.Length)
        $target = Get-PlainPath (Join-Path $root $targetRelative)
        $observedHash = $null
        $status = 'missing'
        if ([IO.File]::Exists($target)) {
            $observedHash = Get-SoftwareHash $target
            $status = if ($observedHash -eq $asset.sha256) { 'alreadyDark' }
                elseif ($asset.originalSHA256 -and $observedHash -eq $asset.originalSHA256) { 'matchesOriginal' }
                else { 'changed' }
        }
        [ordered]@{relative = $targetRelative; status = $status; sha256 = $observedHash; originalKnown = [bool]$asset.originalSHA256}
    }
)
$blockedAssets = @($assetRows | Where-Object { $_.status -in 'missing', 'changed' })
$blockers = @(
    if (!$exeMatches) { 'The original executable does not match the supported PE32 x86 input.' }
    if ($VersionFolder -ne $baseVersion) { 'The selected software version folder has no generation profile.' }
    if ($blockedAssets.Count) { 'One or more named software files are missing or have an unverified preimage.' }
)
$report = [ordered]@{
    schema = 1
    profile = $Profile
    supportedVersion = $baseVersion
    appRoot = $root
    versionFolder = $VersionFolder
    executable = [ordered]@{
        detectedVersion = $detectedVersion
        fileVersion = $fileVersion
        architecture = $layout.architecture
        format = $layout.format
        machine = $layout.machine
        sha256 = $exeHash
        length = $length
        matchesOriginal = [bool]$exeMatches
    }
    assets = $assetRows
    canGenerate = $blockers.Count -eq 0
    blockers = $blockers
    generated = $false
    outputDirectory = $null
}
if (!$PSBoundParameters.ContainsKey('OutputDirectory') -or !$report.canGenerate) {
    $report | ConvertTo-Json -Depth 6
    return
}

if ($OutputDirectory -notmatch $absolute) { throw 'OutputDirectory must be a new absolute directory' }
$output = Get-PlainPath $OutputDirectory
$rootPrefix = $root.TrimEnd('\', '/') + '\'
if ($output.TrimEnd('\', '/').Equals($root.TrimEnd('\', '/'), $comparison) -or
    $output.StartsWith($rootPrefix, $comparison) -or (Test-Path -LiteralPath $output)) {
    throw 'OutputDirectory must not exist or be inside AppRoot'
}
$output = $output.TrimEnd('\', '/')
$parent = [IO.Path]::GetDirectoryName($output)
if (!$parent -or ![IO.Directory]::Exists($parent)) { throw 'The parent of OutputDirectory must already exist' }

$delta = Read-Json (Join-Path $kit $selected.patch)
if ($null -eq $delta.edits -or $delta.append -isnot [string]) { throw 'Invalid executable delta' }
$source = Read-CheckedBytes $exe $originalLength $manifest.originalExecutableSHA256
$append = [Convert]::FromBase64String($delta.append)
if ($source.LongLength + $append.LongLength -ne $exeLength) { throw 'Unexpected executable delta length' }
$patched = [byte[]]::new([int]$exeLength)
[Array]::Copy($source, $patched, $source.Length)
[Array]::Copy($append, 0, $patched, $source.Length, $append.Length)
$end = 0L
foreach ($edit in $delta.edits) {
    $offset = Read-Integer $edit.offset 'delta offset'
    if ($edit.before -isnot [string] -or $edit.after -isnot [string] -or
        $edit.before -notmatch '^(?:[0-9a-f]{2})+$' -or $edit.after -notmatch '^(?:[0-9a-f]{2})+$' -or
        $edit.before.Length -ne $edit.after.Length) { throw 'Invalid executable edit bytes' }
    $count = [int]($edit.before.Length / 2)
    if ($offset -lt $end -or $offset -gt $originalLength - $count) {
        throw 'Executable delta edits overlap or exceed the original image'
    }
    if ([BitConverter]::ToString($source, [int]$offset, $count).Replace('-', '') -ne $edit.before) {
        throw ('Executable delta preimage mismatch at byte ' + $offset)
    }
    [Array]::Copy((Convert-Hex $edit.after), 0, $patched, [int]$offset, $count)
    $end = $offset + $count
}
if ((Get-Sha256 $patched) -ne $selected.exeSHA256) { throw 'Patched executable SHA256 verification failed' }
$exeName = 'Foxmail' + [char]0x6df1 + [char]0x8272 + '.exe'
$files = @(
    @{relative = $exeName; bytes = $patched; sha256 = $selected.exeSHA256}
    @{relative = 'FoxmailRevealGate.dll'; bytes = (Read-CheckedBytes (Join-Path $kit $selected.helper) $helperLength $selected.helperSHA256); sha256 = $selected.helperSHA256}
    foreach ($asset in $manifest.assets) {
        $payload = Join-Path (Join-Path $kit 'payload') $asset.relative
        @{relative = $asset.relative; bytes = (Read-CheckedBytes $payload ([long]$asset.length) $asset.sha256); sha256 = $asset.sha256}
    }
)

# Publish one directory after every output file is written and verified.
$staging = Get-PlainPath (Join-Path $parent ('.foxmail-patch-' + [Guid]::NewGuid().ToString('N')))
$stagePrefix = $staging + '\'
$createdFiles = [Collections.Generic.List[string]]::new()
$createdDirectories = [Collections.Generic.List[string]]::new()
try {
    if (Test-Path -LiteralPath $staging) { throw 'Staging path already exists' }
    [void][IO.Directory]::CreateDirectory($staging)
    $createdDirectories.Add($staging)
    foreach ($file in $files) {
        $dest = Get-PlainPath (Join-Path $staging $file.relative)
        if (!$dest.StartsWith($stagePrefix, $comparison)) { throw 'Output path left the staging directory' }
        $missing = [Collections.Generic.List[string]]::new()
        for ($dir = [IO.Path]::GetDirectoryName($dest); ![IO.Directory]::Exists($dir); $dir = [IO.Path]::GetDirectoryName($dir)) {
            if (!$dir.StartsWith($stagePrefix, $comparison)) { throw 'Output parent left the staging directory' }
            $missing.Add($dir)
        }
        for ($i = $missing.Count - 1; $i -ge 0; $i--) {
            $plain = Get-PlainPath $missing[$i]
            [void][IO.Directory]::CreateDirectory($plain)
            $createdDirectories.Add($plain)
        }
        $stream = [IO.File]::Open($dest, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try {
            $createdFiles.Add($dest)
            $stream.Write($file.bytes, 0, $file.bytes.Length)
            $stream.Flush($true)
        } finally {
            $stream.Dispose()
        }
        if ((Get-SoftwareHash $dest) -ne $file.sha256) {
            throw ('Staged file SHA256 verification failed ' + $file.relative)
        }
    }
    [IO.Directory]::Move($staging, $output)
} catch {
    $failure = $_
    for ($i = $createdFiles.Count - 1; $i -ge 0; $i--) {
        try { [IO.File]::Delete((Get-PlainPath $createdFiles[$i])) }
        catch { Write-Warning ('Could not remove staged file ' + $createdFiles[$i]) }
    }
    for ($i = $createdDirectories.Count - 1; $i -ge 0; $i--) {
        try { [IO.Directory]::Delete((Get-PlainPath $createdDirectories[$i])) }
        catch { Write-Warning ('Could not remove staging directory ' + $createdDirectories[$i]) }
    }
    throw $failure
}
$report.generated = $true
$report.outputDirectory = $output
$report.outputExecutableSHA256 = $selected.exeSHA256
$report.outputHelperSHA256 = $selected.helperSHA256
$report.outputFileCount = $files.Count
$report | ConvertTo-Json -Depth 6
