$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$backup=Join-Path $target 'DarkModeBackup'
$version=Join-Path $target '7.2.25.563'
if((Get-FileHash -LiteralPath (Join-Path $target 'Foxmail.exe') -Algorithm SHA256).Hash -ne '54DA7A968AD8A12BF80978269EDFC57F520AF9F19A18E5B78BF48742983DD4DF'){throw '原程序校验不一致'}
if(Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe' }){throw '请先关闭程序与错误报告窗口'}
$entries=Get-Content -LiteralPath (Join-Path $backup 'external-controls.json') -Raw | ConvertFrom-Json
foreach($entry in $entries){
 $source=Join-Path (Join-Path $backup 'OriginalSkin') $entry.relative
 if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $entry.originalSHA256){throw '原始控件备份校验不一致'}
}
$snapshot=Join-Path $backup ('BeforePristine-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $snapshot -Force | Out-Null
$frame=Join-Path $version 'Template\Conversation\mail_frame.html'
Copy-Item -LiteralPath $frame -Destination (Join-Path $snapshot 'mail_frame.html')
Copy-Item -LiteralPath (Join-Path $target 'Foxmail深色.exe') -Destination (Join-Path $snapshot 'Foxmail深色.exe')
foreach($entry in $entries){
 $source=Join-Path (Join-Path $backup 'OriginalSkin') $entry.relative
 $dest=Join-Path $version $entry.relative
 $saved=Join-Path (Join-Path $snapshot 'SkinBeforePristine') $entry.relative
 New-Item -ItemType Directory -Path (Split-Path $saved) -Force | Out-Null
 Copy-Item -LiteralPath $dest -Destination $saved
 Copy-Item -LiteralPath $source -Destination $dest -Force
}
Copy-Item -LiteralPath (Join-Path $backup 'mail_frame.html') -Destination $frame -Force
if((Get-FileHash -LiteralPath $frame).Hash -ne (Get-FileHash -LiteralPath (Join-Path $backup 'mail_frame.html')).Hash){throw '原始模板还原失败'}
Write-Output 'Restored original reading template and 23 original skins; original executable verified.'
