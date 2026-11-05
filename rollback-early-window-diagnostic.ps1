$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$backup=Join-Path $target 'DarkModeBackup\BeforeEarlyWindowDiagnostic-7D33BB31'
$expected='7D33BB317DE636C6774E16D9F1BF7EA3414AC1372EC9780AD80683B530E3EC1F'
$saved=Join-Path $backup 'Foxmail深色.exe'
if(Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe' }){throw '请保存内容并完全退出 Foxmail'}
if((Get-FileHash -LiteralPath $saved).Hash -ne $expected){throw '专用回退备份校验失败'}
Copy-Item -LiteralPath $saved -Destination (Join-Path $target 'Foxmail深色.exe') -Force
Copy-Item -LiteralPath (Join-Path $backup 'build-info.json') -Destination (Join-Path $target 'DarkModeBackup\build-info.json') -Force
if((Get-FileHash -LiteralPath (Join-Path $target 'Foxmail深色.exe')).Hash -ne $expected){throw '回退后校验失败'}
$expected | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
Write-Output 'Restored previous 7D33BB31 native-print diagnostic executable.'

