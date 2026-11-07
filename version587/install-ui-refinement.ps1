[CmdletBinding()]
param([switch]$Preflight, [switch]$Rollback)

$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$context = & (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')

Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
    param($instance)

    function Hash([string]$file) {
        (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    }

    $app = 'D:\Users\Public\Downloads\Foxmail'
    $exe = Join-Path $app 'Foxmail深色.exe'
    $stage = Join-Path $instance.instanceRoot 'temp\version587-ui-refinement'
    $baseline = Join-Path $instance.instanceRoot 'temp\version587-ui-followups\Foxmail深色.exe'
    $candidate = Join-Path $stage 'Foxmail深色.exe'
    $before = '3a3f9c385c3be8734c89b8b104cb18f2d2574ed4a790cf51c8ef637abfd44d5d'
    $after = '24665d0450f6a7b5efc9cba26cfc05dc9d0c8a761d6a91a093853d2ea4688f9c'

    foreach ($file in @($exe, $baseline, $candidate)) {
        $null = Assert-PortablePlainPath $file
    }
    $manifest = Get-Content -LiteralPath (Join-Path $stage 'validation.json') -Raw | ConvertFrom-Json
    if ($manifest.input -ne $baseline -or $manifest.dest -ne $candidate -or
        $manifest.baselineSHA256 -ne $before -or $manifest.candidateSHA256 -ne $after -or
        !$manifest.combinedEqualsAuditedUnion -or !$manifest.acceptedMailPaletteMatched -or
        $manifest.searchTop.offset -ne 22085904 -or $manifest.searchTop.before -ne 3 -or
        $manifest.searchTop.after -ne 4 -or $manifest.addressColorOperands -ne 6 -or
        $manifest.addressSprites -ne 2) {
        throw 'Unexpected refinement plan'
    }
    if ((Hash $baseline) -ne $before -or (Hash $candidate) -ne $after) {
        throw 'Refinement or rollback artifact changed'
    }

    # Rollback restores the pinned preimage. Later source edits must not block it.
    if (!$Rollback) {
        if ((Hash (Join-Path $PSScriptRoot 'merge-ui-refinement.cjs')) -ne $manifest.generatorSHA256) {
            throw 'Refinement generator changed'
        }
        $sources = @('search-alignment.cjs', 'patch-address-followup.cjs',
            'patch-address-sort-sprites.cjs', 'check-address-followup.cjs')
        if (($manifest.sourceBindings.file -join '|') -ne ($sources -join '|')) {
            throw 'Unexpected refinement sources'
        }
        foreach ($source in $manifest.sourceBindings) {
            if ((Hash (Join-Path $PSScriptRoot $source.file)) -ne $source.sha256) {
                throw ('Verified source changed: ' + $source.file)
            }
        }
    }

    $acceptedFiles = @{
        'Foxmail.exe' = 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'
        'FoxmailRevealGate.dll' = '0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70'
        '7.2.25.587\Template\HtmlEditor\Common\HtmlEditor.html' = 'c3a898dcbccbe41d882c0b32bd28654d32a680ab0320ec4ec2d9b9a97d4eada8'
        '7.2.25.587\Template\HtmlEditor\Common\Base.css' = '8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8'
        '7.2.25.587\Template\AddrNoteInfo\Frame.html' = '405bf5f9201556cce5fe5386726e698b9fe2e64c10399a2b24d35af0f98b151e'
    }
    foreach ($entry in $acceptedFiles.GetEnumerator()) {
        if ((Hash (Join-Path $app $entry.Key)) -ne $entry.Value) {
            throw ('Accepted companion file changed: ' + $entry.Key)
        }
    }

    $current = if ($Rollback) { $after } else { $before }
    $wanted = if ($Rollback) { $before } else { $after }
    if ((Hash $exe) -ne $current) { throw 'Installed EXE identity changed' }
    if ($Preflight) {
        @{verified = $true; targetSHA256 = $wanted; rollback = [bool]$Rollback} | ConvertTo-Json -Compress
        return
    }

    $next = [IO.File]::ReadAllBytes($(if ($Rollback) { $baseline } else { $candidate }))
    $prior = [IO.File]::ReadAllBytes($(if ($Rollback) { $candidate } else { $baseline }))
    & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $current -AppRoot $app -StopOnly | Out-Null

    $stream = $null
    $deadline = [DateTime]::UtcNow.AddSeconds(8)
    do {
        try {
            $stream = [IO.File]::Open($exe, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        } catch [IO.IOException] {
            if ([DateTime]::UtcNow -ge $deadline) { throw }
            [Threading.Thread]::Sleep(100)
        }
    } while (!$stream)

    $hasher = [Security.Cryptography.SHA256]::Create()
    try {
        $openedHash = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
        if ($openedHash -ne $current) { throw 'Installed identity changed before exclusive write' }
        try {
            $stream.Position = 0
            $stream.Write($next, 0, $next.Length)
            $stream.SetLength($next.Length)
            $stream.Flush($true)
            $stream.Position = 0
            $writtenHash = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
            if ($writtenHash -ne $wanted) {
                throw 'Written EXE hash mismatch'
            }
        } catch {
            $stream.Position = 0
            $stream.Write($prior, 0, $prior.Length)
            $stream.SetLength($prior.Length)
            $stream.Flush($true)
            throw
        }
    } finally {
        $hasher.Dispose()
        $stream.Dispose()
    }

    $launch = & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $wanted -AppRoot $app | ConvertFrom-Json
    $report = @{
        utc = [DateTime]::UtcNow.ToString('o')
        pid = $launch.pid
        exeSHA256 = $wanted
        rollback = [bool]$Rollback
        startupShow = $launch.startupShow
    }
    $report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stage 'installation.json') -Encoding utf8
    $report | ConvertTo-Json -Compress
}
