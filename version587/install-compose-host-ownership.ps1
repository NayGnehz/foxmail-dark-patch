[CmdletBinding()]
param([switch]$Preflight, [switch]$Rollback)

$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$context = & (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')

Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
    param($instance)

    function Hash([string]$file) {
        $null = Assert-PortablePlainPath $file
        (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    }

    $app = 'D:\Users\Public\Downloads\Foxmail'
    $exe = Join-Path $app 'Foxmail深色.exe'
    $target = Join-Path $app 'FoxmailRevealGate.dll'
    $archive = Join-Path $instance.workspaceRoot '_releases\foxmail\5.0'
    $manifestPath = Join-Path $archive 'manifest.json'
    $baseline = Join-Path $archive 'payload\FoxmailRevealGate.dll'
    $stage = Join-Path $instance.instanceRoot 'temp\version587-compose-ready-check-host-ownership'
    $candidate = Join-Path $stage 'FoxmailRevealGate.dll'
    $originalSha = 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'
    $exeSha = '24665d0450f6a7b5efc9cba26cfc05dc9d0c8a761d6a91a093853d2ea4688f9c'
    $before = '0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70'
    $after = '1a42c70987f206fb09bd69cfbe88cf836ca318bf614dd0dfeea12a86dd3c4041'
    $current = if ($Rollback) { $after } else { $before }
    $wanted = if ($Rollback) { $before } else { $after }
    if ((Hash $manifestPath) -ne 'd03209a8d39d645b1451c1e014dffb050928db7d19ef5cb50281710c9126e25b' -or
        (Hash $baseline) -ne $before -or (Hash (Join-Path $app 'Foxmail.exe')) -ne $originalSha) {
        throw 'Expected the sealed 5.0 recovery package and the original Foxmail 7.2.25.587'
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.release -ne '5.0' -or $manifest.files.Count -ne 41) { throw 'Unexpected 5.0 inventory' }
    foreach ($file in $manifest.files) {
        $expected = if ($file.relative -eq 'FoxmailRevealGate.dll') { $current } else { $file.sha256 }
        if ((Hash (Join-Path $app $file.relative)) -ne $expected) { throw ('Installed software changed: ' + $file.relative) }
    }

    if (!$Rollback) {
        $report = Join-Path $stage 'native-validation.json'
        if ((Hash $candidate) -ne $after -or
            (Hash $report) -ne '49d6cd9fed07fa6a7f53e889010eaf3a68cbebe1efd34c41eef1c23aba3201f7') {
            throw 'Candidate DLL or native validation changed'
        }
        $validation = Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
        if (!$validation.passed -or $validation.dllSHA256 -ne $after -or $validation.dll -ne $candidate) {
            throw 'Expected the tested compose host ownership DLL'
        }
        foreach ($name in @('compose-ready-async.h', 'compose-ready-api.h')) {
            $source = Join-Path $PSScriptRoot $name
            if ((Hash $source) -ne $validation.sourceHashes.PSObject.Properties[$source].Value) {
                throw ('Validated helper source changed: ' + $name)
            }
        }
    }

    if ($Preflight) {
        [pscustomobject]@{verified=$true; rollback=[bool]$Rollback; files=41; exeSHA256=$exeSha; helperSHA256=$wanted} | ConvertTo-Json -Compress
        return
    }

    function BytesHash([byte[]]$bytes) {
        [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
    }
    function StreamHash([IO.FileStream]$stream) {
        $stream.Position = 0
        [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant()
    }
    function WriteChecked([IO.FileStream]$stream, [byte[]]$bytes, [string]$expected) {
        $stream.Position = 0
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.SetLength($bytes.Length)
        $stream.Flush($true)
        if ((StreamHash $stream) -ne $expected) { throw 'Exclusive-handle DLL verification failed' }
    }

    $next = [IO.File]::ReadAllBytes($(if ($Rollback) { $baseline } else { $candidate }))
    if ((BytesHash $next) -ne $wanted) { throw 'Requested DLL changed before stop' }
    & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $exeSha -AppRoot $app -StopOnly | Out-Null

    $stream = $null
    $deadline = [DateTime]::UtcNow.AddSeconds(8)
    do {
        try { $stream = [IO.File]::Open($target, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
        catch [IO.IOException] {
            if ([DateTime]::UtcNow -ge $deadline) { throw }
            [Threading.Thread]::Sleep(100)
        }
    } while (!$stream)

    try {
        if ((StreamHash $stream) -ne $current) { throw 'Installed DLL identity changed before exclusive write' }
        $stream.Position = 0
        $prior = [byte[]]::new([int]$stream.Length)
        $stream.ReadExactly($prior)
        try { WriteChecked $stream $next $wanted }
        catch {
            WriteChecked $stream $prior $current
            throw
        }
    } finally {
        $stream.Dispose()
    }

    if ((Hash $target) -ne $wanted) { throw 'Installed DLL hash changed before launch' }
    $run = & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $exeSha -AppRoot $app | ConvertFrom-Json
    [pscustomobject]@{pid=$run.pid; startupShow=$run.startupShow; rollback=[bool]$Rollback; exeSHA256=$exeSha; helperSHA256=$wanted} | ConvertTo-Json -Compress
}
