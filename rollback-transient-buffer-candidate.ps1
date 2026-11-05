$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$backup=Join-Path $target 'DarkModeBackup\BeforeTransientBuffer-EDF4328F'
$expected='EDF4328F8F821FFBEA85A0783F5C30F7054BBDF4DCAA37D6A2911A2557820C48'
$saved=Join-Path $backup 'Foxmail深色.exe'
if(Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe' }){throw '请保存内容并完全退出 Foxmail'}
if((Get-FileHash -LiteralPath $saved).Hash -ne $expected){throw '专用回退备份校验失败'}
Copy-Item -LiteralPath $saved -Destination (Join-Path $target 'Foxmail深色.exe') -Force
Copy-Item -LiteralPath (Join-Path $backup 'build-info.json') -Destination (Join-Path $target 'DarkModeBackup\build-info.json') -Force
if((Get-FileHash -LiteralPath (Join-Path $target 'Foxmail深色.exe')).Hash -ne $expected){throw '回退后校验失败'}
$expected | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
Write-Output 'Restored previous EDF4328F executable.'
