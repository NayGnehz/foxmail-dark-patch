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
    $exeName = 'Foxmail深色.exe'
    $exe = Join-Path $app $exeName
    $archive = Join-Path $instance.workspaceRoot '_releases\foxmail\5.0'
    $manifestPath = Join-Path $archive 'manifest.json'
    $baseline = Join-Path $archive ('payload\' + $exeName)
    $stage = Join-Path $instance.instanceRoot 'temp\version587-compose-polish'
    $candidate = Join-Path $stage $exeName
    $before = '24665d0450f6a7b5efc9cba26cfc05dc9d0c8a761d6a91a093853d2ea4688f9c'
    $after = '1cc82aae50abc671d4c70f5afc596f590035c639a7946817a3a97cd9fa1f00ab'
    $helper = '1a42c70987f206fb09bd69cfbe88cf836ca318bf614dd0dfeea12a86dd3c4041'
    $current = if ($Rollback) { $after } else { $before }
    $wanted = if ($Rollback) { $before } else { $after }
    if ((Hash $manifestPath) -ne 'd03209a8d39d645b1451c1e014dffb050928db7d19ef5cb50281710c9126e25b' -or
        (Hash $baseline) -ne $before -or
        (Hash (Join-Path $app 'Foxmail.exe')) -ne 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399') {
        throw 'Expected the sealed 5.0 recovery package and the original Foxmail 7.2.25.587'
    }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.release -ne '5.0' -or $manifest.files.Count -ne 41) { throw 'Unexpected 5.0 inventory' }
    foreach ($file in $manifest.files) {
        $expected = switch ($file.relative) {
            $exeName { $current }
            'FoxmailRevealGate.dll' { $helper }
            default { $file.sha256 }
        }
        if ((Hash (Join-Path $app $file.relative)) -ne $expected) { throw ('Installed software changed: ' + $file.relative) }
    }
    if (!$Rollback) {
        $reportPath = Join-Path $stage 'validation.json'
        $null = Assert-PortablePlainPath $reportPath
        $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
        if ($report.baselineSHA256 -ne $before -or $report.candidateSHA256 -ne $after -or
            !$report.independentUnionVerified -or !$report.recipientABI.passed -or
            $report.recipientABI.cases -ne 1280 -or (Hash $candidate) -ne $after) {
            throw 'Unexpected compose candidate or byte-diff proof'
        }
        $sources = @('compose-polish.cjs', 'compose-recipient-contrast.cjs', 'compose-toolbar-shadow.cjs')
        foreach ($name in $sources) {
            if ((Hash (Join-Path $PSScriptRoot $name)) -ne $report.sourceSHA256.PSObject.Properties[$name].Value) {
                throw ('Verified compose source changed: ' + $name)
            }
        }
    }

    if ($Preflight) {
        [pscustomobject]@{verified=$true; rollback=[bool]$Rollback; files=41; exeSHA256=$wanted; helperSHA256=$helper} | ConvertTo-Json -Compress
        return
    }

    . (Join-Path $PSScriptRoot 'replace-verified-software.ps1')
    $next = [IO.File]::ReadAllBytes($(if ($Rollback) { $baseline } else { $candidate }))
    if ((Get-FoxmailBytesHash $next) -ne $wanted) { throw 'Requested EXE changed before stop' }
    & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $current -AppRoot $app -StopOnly | Out-Null
    Set-FoxmailVerifiedSoftware -Target $exe -Replacement $next -Before $current -After $wanted

    if ((Hash $exe) -ne $wanted) { throw 'Installed EXE hash changed before launch' }
    $run = & (Join-Path $PSScriptRoot 'restart-visible.ps1') -ExpectedSha $wanted -AppRoot $app | ConvertFrom-Json
    [pscustomobject]@{pid=$run.pid; startupShow=$run.startupShow; rollback=[bool]$Rollback; exeSHA256=$wanted; helperSHA256=$helper} | ConvertTo-Json -Compress
}
