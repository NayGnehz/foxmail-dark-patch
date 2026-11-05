$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$stableHash='85E9468F6A77C62448B8D8344042102F505F1EF168E78E1E6C47C2390A321430'
$candidateHash='EDF4328F8F821FFBEA85A0783F5C30F7054BBDF4DCAA37D6A2911A2557820C48'
$destination=Join-Path $target 'Foxmail深色.exe'
$candidate=Join-Path $PSScriptRoot 'Foxmail-dark-fixed.exe'
$backup=Join-Path $target 'DarkModeBackup\BeforeSystemTransitions-85E9468F'
$metadata=Join-Path $target 'DarkModeBackup\build-info.json'
if(Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe' }){throw '请保存内容并完全退出 Foxmail 和错误报告窗口'}
if((Get-FileHash -LiteralPath (Join-Path $target 'Foxmail.exe')).Hash -ne '54DA7A968AD8A12BF80978269EDFC57F520AF9F19A18E5B78BF48742983DD4DF'){throw '原版文件校验失败'}
if((Get-FileHash -LiteralPath $destination).Hash -ne $stableHash){throw '当前深色版与已确认版本不符'}
if((Get-FileHash -LiteralPath $candidate).Hash -ne $candidateHash){throw '诊断候选校验失败'}
$lock=[IO.File]::Open($destination,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
$lock.Dispose()
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$saved=Join-Path $backup 'Foxmail深色.exe'
if(Test-Path -LiteralPath $saved){if((Get-FileHash -LiteralPath $saved).Hash -ne $stableHash){throw '专用回退备份校验失败'}}else{Copy-Item -LiteralPath $destination -Destination $saved}
$savedMeta=Join-Path $backup 'build-info.json'
if(!(Test-Path -LiteralPath $savedMeta)){Copy-Item -LiteralPath $metadata -Destination $savedMeta}
try{
 Copy-Item -LiteralPath $candidate -Destination $destination -Force
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Foxmail-dark.exe.json') -Destination $metadata -Force
 if((Get-FileHash -LiteralPath $destination).Hash -ne $candidateHash){throw '安装后校验失败'}
}catch{
 Copy-Item -LiteralPath $saved -Destination $destination -Force
 Copy-Item -LiteralPath $savedMeta -Destination $metadata -Force
 throw
}
$candidateHash | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
Write-Output 'Installed system-transition contrast executable; templates, skins and account data untouched. Dedicated stable executable and build metadata backed up.'



