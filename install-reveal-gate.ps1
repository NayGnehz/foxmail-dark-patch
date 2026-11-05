param([switch]$Preflight)
$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$work=Join-Path $PSScriptRoot 'reveal-gate'
$plan=Get-Content -LiteralPath (Join-Path $work 'install-plan.json') -Raw | ConvertFrom-Json
if (!$plan.eligibleForInstall -or !$plan.nativeFixturePassed -or !$plan.emittedBridgePassed -or !$plan.dllLoadPassed -or !$plan.deltaPassed -or !$plan.productionExceptionPassed) { throw '候选尚未完成验证，禁止安装' }
$destination=Join-Path $target 'Foxmail深色.exe'
$helper=Join-Path $target 'FoxmailRevealGate.dll'
$metadata=Join-Path $target 'DarkModeBackup\build-info.json'
$backup=Join-Path $target 'DarkModeBackup\BeforeRevealGate-75D86C85'
function Hash([string]$path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
if ((Hash (Join-Path $target 'Foxmail.exe')) -ne '54da7a968ad8a12bf80978269edfc57f520af9f19a18e5b78bf48742983dd4df') { throw '原版文件校验失败' }
if ((Hash $destination) -ne $plan.baselineSHA256) { throw '当前深色版不是预期基线' }
if (Test-Path -LiteralPath $helper) { throw '目标目录已有同名辅助模块，请先核对来源' }
foreach($name in @('Foxmail-dark-reveal.exe','FoxmailRevealGate.dll','build-info.json')) {
    if ((Hash (Join-Path $work $name)) -ne $plan.files.$name) { throw ('候选文件校验失败：'+$name) }
}
if (!(Test-Path -LiteralPath $metadata)) { throw '当前构建记录缺失' }
if ($Preflight) { 'Preflight PASS: executable, helper, metadata and validation results verified.'; return }
if (Get-CimInstance Win32_Process | Where-Object {$_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe'}) { throw '请保存内容并完全退出 Foxmail 和错误报告窗口' }
$lock=[IO.File]::Open($destination,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None); $lock.Dispose()
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$saved=Join-Path $backup 'Foxmail深色.exe'
$savedMeta=Join-Path $backup 'build-info.json'
if (Test-Path -LiteralPath $saved) { if ((Hash $saved) -ne $plan.baselineSHA256) { throw '回退备份校验失败' } } else { Copy-Item -LiteralPath $destination -Destination $saved }
if (!(Test-Path -LiteralPath $savedMeta)) { Copy-Item -LiteralPath $metadata -Destination $savedMeta }
try {
    Copy-Item -LiteralPath (Join-Path $work 'FoxmailRevealGate.dll') -Destination $helper
    Copy-Item -LiteralPath (Join-Path $work 'Foxmail-dark-reveal.exe') -Destination $destination -Force
    Copy-Item -LiteralPath (Join-Path $work 'build-info.json') -Destination $metadata -Force
    if ((Hash $destination) -ne $plan.files.'Foxmail-dark-reveal.exe' -or (Hash $helper) -ne $plan.files.'FoxmailRevealGate.dll') { throw '安装后校验失败' }
} catch {
    Copy-Item -LiteralPath $saved -Destination $destination -Force
    Copy-Item -LiteralPath $savedMeta -Destination $metadata -Force
    if ((Test-Path -LiteralPath $helper) -and (Hash $helper) -eq $plan.files.'FoxmailRevealGate.dll') { Remove-Item -LiteralPath $helper }
    throw
}
$plan.files.'Foxmail-dark-reveal.exe' | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
'Installed experimental main-window reveal gate. Previous executable/metadata backed up; mail, templates and skins unchanged.'
