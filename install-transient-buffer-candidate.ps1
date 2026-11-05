$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'transient-buffer-candidate.json') -Raw | ConvertFrom-Json
$destination=Join-Path $target 'Foxmail深色.exe'
$candidate=Join-Path $PSScriptRoot 'Foxmail-dark-fixed.exe'
$backup=Join-Path $target 'DarkModeBackup\BeforeTransientBuffer-EDF4328F'
$metadata=Join-Path $target 'DarkModeBackup\build-info.json'
if(!$manifest.checksPassed){throw '候选检查尚未通过'}
if($manifest.eligibleForInstall -eq $false){throw '此候选已因实际显示回归被撤回，禁止再次安装'}
if(Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe' }){throw '请保存内容并完全退出 Foxmail 和错误报告窗口'}
if((Get-FileHash -LiteralPath (Join-Path $target 'Foxmail.exe')).Hash -ne $manifest.originalSHA256){throw '原版文件校验失败'}
if((Get-FileHash -LiteralPath $destination).Hash -ne $manifest.baselineSHA256){throw '当前深色版与已确认基线不符'}
if((Get-FileHash -LiteralPath $candidate).Hash -ne $manifest.candidateSHA256){throw '候选校验失败'}
$lock=[IO.File]::Open($destination,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
$lock.Dispose()
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$saved=Join-Path $backup 'Foxmail深色.exe'
if(Test-Path -LiteralPath $saved){if((Get-FileHash -LiteralPath $saved).Hash -ne $manifest.baselineSHA256){throw '专用回退备份校验失败'}}else{Copy-Item -LiteralPath $destination -Destination $saved}
$savedMeta=Join-Path $backup 'build-info.json'
if(!(Test-Path -LiteralPath $savedMeta)){Copy-Item -LiteralPath $metadata -Destination $savedMeta}
try{
 Copy-Item -LiteralPath $candidate -Destination $destination -Force
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Foxmail-dark.exe.json') -Destination $metadata -Force
 if((Get-FileHash -LiteralPath $destination).Hash -ne $manifest.candidateSHA256){throw '安装后校验失败'}
}catch{
 Copy-Item -LiteralPath $saved -Destination $destination -Force
 Copy-Item -LiteralPath $savedMeta -Destination $metadata -Force
 throw
}
$manifest.candidateSHA256 | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
Write-Output 'Installed transient main-window buffer candidate; baseline executable and metadata backed up.'
