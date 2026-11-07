$ErrorActionPreference = 'Stop';
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false);
$status = 1;
$stage = $null;
$created = $false;
try {
    $appRoot = [IO.Path]::GetDirectoryName($env:FOXMAIL_PATCH_SELF);
    $raw = [IO.File]::ReadAllText($env:FOXMAIL_PATCH_SELF);
    $marker = [string][char]10 + ':__FOXMAIL_PAYLOAD__' + [char]13 + [char]10;
    $offset = $raw.LastIndexOf($marker, [StringComparison]::Ordinal);
    if ($offset -lt 0) { throw 'Embedded Foxmail patch archive missing'; }
    $bytes = [Convert]::FromBase64String($raw.Substring($offset + $marker.Length));
    $sha = [Security.Cryptography.SHA256]::Create();
    try {
        $digest = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant();
    } finally {
        $sha.Dispose();
    }
    if ($digest -ne '__FOXMAIL_ARCHIVE_SHA__') { throw 'Embedded Foxmail patch archive failed SHA256 verification'; }
    $tempRoot = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath([IO.Path]::GetTempPath()));
    if (![IO.Path]::GetDirectoryName($tempRoot)) { throw 'TEMP must be an existing non-root directory'; }
    for ($dir = $tempRoot; $dir; $dir = [IO.Path]::GetDirectoryName($dir)) {
        $item = Get-Item -LiteralPath $dir -Force;
        if (!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'TEMP must use plain directories';
        }
    }
    $stage = [IO.Path]::Combine($tempRoot, 'foxmail-dark-' + [Guid]::NewGuid().ToString('N'));
    if (Test-Path -LiteralPath $stage) { throw 'Temporary directory already exists'; }
    [void][IO.Directory]::CreateDirectory($stage);
    $created = $true;
    $stream = [IO.MemoryStream]::new($bytes, $false);
    $archive = $null;
    try {
        $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Read);
        [IO.Compression.ZipFileExtensions]::ExtractToDirectory($archive, $stage);
    } finally {
        if ($archive) { $archive.Dispose(); }
        $stream.Dispose();
    }
    $profile = if ($env:FOXMAIL_PATCH_MODE -eq 'trial') { 'deployed-trial' } else { '5.0' };
    $options = @{AppRoot = $appRoot; Profile = $profile};
    if ($env:FOXMAIL_PATCH_MODE -ne 'check') {
        $parent = [IO.Directory]::GetParent($appRoot);
        if (!$parent) { throw 'Run this CMD in a Foxmail folder below the drive root'; }
        $folder = [IO.Path]::GetFileName($appRoot) + '-dark-overlay-' + $profile;
        $options.OutputDirectory = [IO.Path]::Combine($parent.FullName, $folder);
    }
    $json = & ([IO.Path]::Combine($stage, 'Apply-FoxmailDark.ps1')) @options;
    $json | Write-Output;
    $report = $json | ConvertFrom-Json;
    $status = if ($report.canGenerate) { 0 } else { 2 };
} catch {
    [Console]::Error.WriteLine($_.Exception.Message);
} finally {
    if ($created) {
        try {
            $directory = Get-Item -LiteralPath $stage -Force;
            if (!$directory.PSIsContainer -or $directory.FullName -ne $stage -or
                $directory.Parent.FullName -ne $tempRoot -or
                ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                throw 'Temporary directory identity changed';
            }
            $items = @(Get-ChildItem -LiteralPath $stage -Recurse -Force);
            if ($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) {
                throw 'Unexpected reparse point in temporary directory';
            }
            Remove-Item -LiteralPath $stage -Recurse -Force;
        } catch {
            [Console]::Error.WriteLine('Temporary cleanup failed. ' + $_.Exception.Message);
            $status = 1;
        }
    }
}
exit $status;
