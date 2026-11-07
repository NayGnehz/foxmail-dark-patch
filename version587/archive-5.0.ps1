[CmdletBinding()]
param([Parameter(Mandatory)][string]$AppRoot)

$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$context = & (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')

Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
    param($instance)

    function Hash([string]$file) {
        (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    }

    $app = [IO.Path]::GetFullPath($AppRoot).TrimEnd('\')
    $releases = [IO.Path]::GetFullPath((Join-Path $context.workspaceRoot '_releases\foxmail'))
    $release = Join-Path $releases '5.0'
    $stage = [IO.Path]::GetFullPath((Join-Path $instance.instanceRoot 'temp\release-5.0-staging'))
    $previousManifest = Join-Path $releases '4.0\manifest.json'
    foreach ($file in @($app, $release, $stage, $previousManifest)) {
        $null = Assert-PortablePlainPath $file
    }
    if ((Test-Path -LiteralPath $release) -or (Test-Path -LiteralPath $stage)) {
        throw '5.0 archive or staging already exists'
    }
    if ((Hash $previousManifest) -ne '31f92b2f8f746e11614cf586631b22c3affb36ed06cc9db61f92754ed9cd9c61') {
        throw '4.0 asset inventory changed'
    }

    $original = Join-Path $app 'Foxmail.exe'
    $null = Assert-PortablePlainPath $original
    $originalHash = 'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'
    $base = Get-Content -LiteralPath $previousManifest -Raw | ConvertFrom-Json
    if ($base.release -ne '4.0' -or $base.files.Count -ne 39 -or
        $base.originalExecutableSHA256 -ne $originalHash -or (Hash $original) -ne $originalHash) {
        throw 'Expected Foxmail 7.2.25.587 and the verified 4.0 inventory'
    }

    $exeHash = '24665d0450f6a7b5efc9cba26cfc05dc9d0c8a761d6a91a093853d2ea4688f9c'
    $files = @(
        foreach ($file in $base.files) {
            $digest = if ($file.relative -eq 'Foxmail深色.exe') { $exeHash } else { $file.sha256 }
            [ordered]@{relative = $file.relative; sha256 = $digest}
        }
        [ordered]@{relative = '7.2.25.587/Template/HtmlEditor/Common/HtmlEditor.html'; sha256 = 'c3a898dcbccbe41d882c0b32bd28654d32a680ab0320ec4ec2d9b9a97d4eada8'}
        [ordered]@{relative = '7.2.25.587/Template/AddrNoteInfo/Frame.html'; sha256 = '405bf5f9201556cce5fe5386726e698b9fe2e64c10399a2b24d35af0f98b151e'}
    )
    if ($files.Count -ne 41 -or @($files.relative | Sort-Object -Unique).Count -ne 41) {
        throw 'Expected 41 distinct payload files'
    }
    foreach ($file in $files) {
        if ($file.relative -notmatch '^(Foxmail深色\.exe|FoxmailRevealGate\.dll|7\.2\.25\.587/(PngImages|Skin|Template)/[^:]+)$' -or
            $file.relative.Contains('..')) {
            throw 'Unexpected payload path'
        }
        $source = [IO.Path]::GetFullPath((Join-Path $app $file.relative))
        if (!$source.StartsWith($app + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Payload source outside the application directory'
        }
        $null = Assert-PortablePlainPath $source
        if ((Hash $source) -ne $file.sha256) { throw ('Accepted file changed: ' + $file.relative) }
        $file.length = (Get-Item -LiteralPath $source).Length
    }

    $restore = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'restore-4.0.ps1') -Raw
    if (([regex]::Matches($restore, '__MANIFEST_SHA256__')).Count -ne 1 -or
        ([regex]::Matches($restore, '\.Count -ne 39')).Count -ne 2) {
        throw 'Unexpected restore template'
    }
    $restore = $restore.Replace('4.0', '5.0').Replace('.Count -ne 39', '.Count -ne 41')
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseInput($restore, [ref]$tokens, [ref]$errors)
    if ($errors.Count) { throw 'Generated restore script has a syntax error' }

    foreach ($file in $files) {
        $source = Join-Path $app $file.relative
        $dest = Join-Path (Join-Path $stage 'payload') $file.relative
        $null = Assert-PortablePlainPath $dest
        [void][IO.Directory]::CreateDirectory((Split-Path $dest -Parent))
        Copy-Item -LiteralPath $source -Destination $dest
        if ((Hash $dest) -ne $file.sha256 -or (Get-Item -LiteralPath $dest).Length -ne $file.length) {
            throw ('Archive payload mismatch: ' + $file.relative)
        }
    }
    $manifest = [ordered]@{
        release = '5.0'
        foxmailVersion = '7.2.25.587'
        originalExecutableSHA256 = $originalHash
        createdUTC = [DateTime]::UtcNow.ToString('o')
        selection = 'Downloads dark copy accepted by the user on 2026-11-07'
        accepted = @(
            'Search alignment, hover and dropdown'
            'Dark address book, contact group title, A-Z button and mail-matched selection'
            'Compose text and caret, reveal behavior, settings borders and main-window DPI 120'
        )
        files = $files
    }
    $utf8 = [Text.UTF8Encoding]::new($false)
    $manifestPath = Join-Path $stage 'manifest.json'
    [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 6), $utf8)
    $manifestHash = Hash $manifestPath
    [IO.File]::WriteAllText((Join-Path $stage '恢复5.0.ps1'), $restore.Replace('__MANIFEST_SHA256__', $manifestHash), $utf8)
    $note = @'
Foxmail 深色修改包 5.0
对应原版 7.2.25.587。清单包含 41 项程序及静态界面文件。
用户于 2026-11-07 验收。搜索框对齐，联系人标题、A–Z 按钮及选中配色正常。
使用 .\恢复5.0.ps1 -TargetRoot '现有深色副本目录' -VerifyOnly 校验。
恢复时退出对应 Foxmail 副本，再去掉 -VerifyOnly。脚本通过共享 _env 定位工具，
将清单内现有软件文件备份到登记缓存，再恢复 5.0。
'@
    [IO.File]::WriteAllText((Join-Path $stage '说明.txt'), $note + [Environment]::NewLine, $utf8)

    if (!$stage.StartsWith($instance.instanceRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -or
        !$release.StartsWith($releases + '\', [StringComparison]::OrdinalIgnoreCase) -or
        (Test-Path -LiteralPath $release)) {
        throw 'Archive move paths changed'
    }
    Move-Item -LiteralPath $stage -Destination $release
    [pscustomobject]@{
        archived = $release
        payloadFiles = $files.Count
        payloadBytes = ($files | ForEach-Object {[long]$_.length} | Measure-Object -Sum).Sum
        manifestSHA256 = $manifestHash
        exeSHA256 = $exeHash
    } | ConvertTo-Json -Compress
}
