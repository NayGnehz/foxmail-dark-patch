$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'reveal-gate-v2\install-plan.json') -Raw | ConvertFrom-Json
$backup=Join-Path $target 'DarkModeBackup\BeforeRevealV2-4933A14B'
function Hash([string]$p) { (Get-FileHash -LiteralPath $p).Hash.ToLowerInvariant() }
$destinations=@{'Foxmail-dark-reveal.exe'=(Join-Path $target 'Foxmail深色.exe');'FoxmailRevealGate.dll'=(Join-Path $target 'FoxmailRevealGate.dll');'build-info.json'=(Join-Path $target 'DarkModeBackup\build-info.json')}
if(Get-CimInstance Win32_Process | Where-Object {$_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe'}){throw '请先完全退出 Foxmail 和错误报告窗口'}
foreach($name in $destinations.Keys){
 if((Hash $destinations[$name]) -ne $plan.files.$name){throw '当前文件与本轮候选不符'}
 if((Hash (Join-Path $backup $name)) -ne $plan.baselineFiles.$name){throw '备份校验失败'}
}
foreach($name in $destinations.Keys){Copy-Item -LiteralPath (Join-Path $backup $name) -Destination $destinations[$name] -Force}
foreach($name in $destinations.Keys){if((Hash $destinations[$name]) -ne $plan.baselineFiles.$name){throw '回退后校验失败'}}
$plan.baselineFiles.'Foxmail-dark-reveal.exe' | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
'Restored the v1 executable, helper and build metadata.'
