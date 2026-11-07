$ErrorActionPreference = 'Stop';
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false);
$status = 1;
$stage = $null;
$created = $false;
try {
    if ($PSVersionTable.PSVersion -lt [version]'5.1') { throw 'Windows PowerShell 5.1 is required'; }
    $appRoot = [IO.Path]::GetDirectoryName($env:FOXMAIL_PATCH_SELF);
    $raw = [IO.File]::ReadAllText($env:FOXMAIL_PATCH_SELF);
    $startMarker = "`n:__FOXMAIL_PAYLOAD__`r`n";
    $endMarker = "`n:__FOXMAIL_POWERSHELL__`r`n";
    $offset = $raw.IndexOf($startMarker, [StringComparison]::Ordinal);
    if ($offset -lt 0) { throw 'Embedded Foxmail patch archive missing'; }
    $offset += $startMarker.Length;
    $end = $raw.IndexOf($endMarker, $offset, [StringComparison]::Ordinal);
    if ($end -le $offset) { throw 'Embedded Foxmail patch archive incomplete'; }
    $bytes = [Convert]::FromBase64String($raw.Substring($offset, $end - $offset));
    $sha = [Security.Cryptography.SHA256]::Create();
    try {
        $digest = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant();
    } finally {
        $sha.Dispose();
    }
    if ($digest -ne '__FOXMAIL_ARCHIVE_SHA__') { throw 'Embedded Foxmail patch archive failed SHA256 verification'; }
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath());
    if ($tempRoot -eq [IO.Path]::GetPathRoot($tempRoot)) { throw 'TEMP must be an existing non-root directory'; }
    $tempRoot = $tempRoot.TrimEnd([char]92, [char]47);
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
        Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem;
        $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Read);
        [IO.Compression.ZipFileExtensions]::ExtractToDirectory($archive, $stage);
    } finally {
        if ($archive) { $archive.Dispose(); }
        $stream.Dispose();
    }
    $mode = $env:FOXMAIL_PATCH_MODE;
    $profile = if ($mode -eq 'trial') { 'deployed-trial' } else { '5.0' };
    if ($mode -eq 'trial') { $mode = 'apply'; }
    $options = @{AppRoot = $appRoot; Profile = $profile; KitRoot = $stage; Operation = $mode};
    $json = & $apply @options;
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
