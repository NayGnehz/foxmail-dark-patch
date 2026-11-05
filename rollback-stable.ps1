$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$backup=Join-Path $target 'DarkModeBackup'
$stableExe=Join-Path $backup 'Foxmail深色-上次版本.exe'
$stableFrame=Join-Path $backup 'mail_frame-上次版本.html'
if((Get-FileHash -LiteralPath $stableExe -Algorithm SHA256).Hash -ne '9394671A3BD9C9174AB61BF98C8A81D5D362375F399A44E738A20496A6DC037F'){throw '稳定版备份校验不一致'}
if(Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe' }){throw '请先关闭 Foxmail 和错误报告窗口'}
$failed=Join-Path $backup ('FailedWin11-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $failed -Force | Out-Null
$frame=Join-Path $target '7.2.25.563\Template\Conversation\mail_frame.html'
Copy-Item -LiteralPath (Join-Path $target 'Foxmail深色.exe') -Destination (Join-Path $failed 'Foxmail深色.exe')
Copy-Item -LiteralPath $frame -Destination (Join-Path $failed 'mail_frame.html')
$entries=Get-Content -LiteralPath (Join-Path $backup 'external-controls.json') -Raw | ConvertFrom-Json
foreach($entry in $entries){
 $previous=Join-Path (Join-Path $backup 'PreviousSkin') $entry.relative
 $dest=Join-Path (Join-Path $target '7.2.25.563') $entry.relative
 $saved=Join-Path (Join-Path $failed 'SkinBeforeRollback') $entry.relative
 if(!(Test-Path -LiteralPath $previous)){throw '缺少上次控件皮肤备份'}
 New-Item -ItemType Directory -Path (Split-Path $saved) -Force | Out-Null
 Copy-Item -LiteralPath $dest -Destination $saved
}
Copy-Item -LiteralPath $stableExe -Destination (Join-Path $target 'Foxmail深色.exe') -Force
Copy-Item -LiteralPath $stableFrame -Destination $frame -Force
foreach($entry in $entries){Copy-Item -LiteralPath (Join-Path (Join-Path $backup 'PreviousSkin') $entry.relative) -Destination (Join-Path (Join-Path $target '7.2.25.563') $entry.relative) -Force}
if((Get-FileHash -LiteralPath (Join-Path $target 'Foxmail深色.exe') -Algorithm SHA256).Hash -ne '9394671A3BD9C9174AB61BF98C8A81D5D362375F399A44E738A20496A6DC037F'){throw '回退后程序校验失败'}
Write-Output 'Restored previous functional executable, reading template and 25 control skins.'
