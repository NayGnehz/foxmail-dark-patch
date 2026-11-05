param([switch]$Preflight)
$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$baseline='EDF4328F8F821FFBEA85A0783F5C30F7054BBDF4DCAA37D6A2911A2557820C48'
$candidateHash='75D86C85B9D5BC568248626170B776EEF58F29E26B2F21C28F48025ADE7D7F85'
$destination=Join-Path $target 'Foxmail深色.exe'
$candidate=Join-Path $PSScriptRoot 'Foxmail-dark-no-diagnostics.exe'
$candidateMeta=Join-Path $PSScriptRoot 'Foxmail-dark-no-diagnostics.exe.json'
$metadata=Join-Path $target 'DarkModeBackup\build-info.json'
$backup=Join-Path $target 'DarkModeBackup\BeforeNoDiagnostics-EDF4328F'
if((Get-FileHash -LiteralPath (Join-Path $target 'Foxmail.exe')).Hash -ne '54DA7A968AD8A12BF80978269EDFC57F520AF9F19A18E5B78BF48742983DD4DF'){throw '原版文件校验失败'}
if((Get-FileHash -LiteralPath $destination).Hash -ne $baseline){throw '当前深色版与预期版本不符'}
if((Get-FileHash -LiteralPath $candidate).Hash -ne $candidateHash){throw '候选校验失败'}
$meta=Get-Content -LiteralPath $candidateMeta -Raw | ConvertFrom-Json
if($meta.nativePaintPhase -or $meta.nativeInitialErase.diagnostics -or $meta.nativeTransientBuffer){throw '候选仍带实验或诊断代码'}
if(!(Test-Path -LiteralPath $metadata)){throw '当前构建记录缺失'}
if($Preflight){'Preflight PASS: exact baseline, candidate and diagnostic-off metadata verified; process availability will be checked at install.'; return}
if(Get-CimInstance Win32_Process | Where-Object {$_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe'}){throw '请保存内容并完全退出 Foxmail 和错误报告窗口'}
$lock=[IO.File]::Open($destination,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None); $lock.Dispose()
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$saved=Join-Path $backup 'Foxmail深色.exe'; $savedMeta=Join-Path $backup 'build-info.json'
if(Test-Path -LiteralPath $saved){if((Get-FileHash -LiteralPath $saved).Hash -ne $baseline){throw '回退备份校验失败'}}else{Copy-Item -LiteralPath $destination -Destination $saved}
if(!(Test-Path -LiteralPath $savedMeta)){Copy-Item -LiteralPath $metadata -Destination $savedMeta}
try {
 Copy-Item -LiteralPath $candidate -Destination $destination -Force
 Copy-Item -LiteralPath $candidateMeta -Destination $metadata -Force
 if((Get-FileHash -LiteralPath $destination).Hash -ne $candidateHash){throw '安装后校验失败'}
}catch{
 Copy-Item -LiteralPath $saved -Destination $destination -Force
 Copy-Item -LiteralPath $savedMeta -Destination $metadata -Force
 throw
}
$candidateHash | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
'Installed diagnostic-off executable. Prior executable backed up; no templates, skins or account files changed.'
