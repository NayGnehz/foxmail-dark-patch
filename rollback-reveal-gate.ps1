$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'reveal-gate\install-plan.json') -Raw | ConvertFrom-Json
$destination=Join-Path $target 'Foxmail深色.exe'
$helper=Join-Path $target 'FoxmailRevealGate.dll'
$backup=Join-Path $target 'DarkModeBackup\BeforeRevealGate-75D86C85'
function Hash([string]$path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
if (Get-CimInstance Win32_Process | Where-Object {$_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe'}) { throw '请先完全退出 Foxmail 和错误报告窗口' }
if ((Hash $destination) -ne $plan.files.'Foxmail-dark-reveal.exe') { throw '当前程序与本轮候选不符，停止回退' }
if ((Hash (Join-Path $backup 'Foxmail深色.exe')) -ne $plan.baselineSHA256) { throw '备份校验失败' }
if ((Test-Path -LiteralPath $helper) -and (Hash $helper) -ne $plan.files.'FoxmailRevealGate.dll') { throw '辅助模块与本轮候选不符' }
Copy-Item -LiteralPath (Join-Path $backup 'Foxmail深色.exe') -Destination $destination -Force
Copy-Item -LiteralPath (Join-Path $backup 'build-info.json') -Destination (Join-Path $target 'DarkModeBackup\build-info.json') -Force
if (Test-Path -LiteralPath $helper) { Remove-Item -LiteralPath $helper }
if ((Hash $destination) -ne $plan.baselineSHA256) { throw '回退后校验失败' }
$plan.baselineSHA256 | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
'Restored the diagnostic-off baseline and removed only this candidate helper.'
