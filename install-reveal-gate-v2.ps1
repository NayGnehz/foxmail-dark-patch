param([switch]$Preflight)
$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
$work=Join-Path $PSScriptRoot 'reveal-gate-v2'
$plan=Get-Content -LiteralPath (Join-Path $work 'install-plan.json') -Raw | ConvertFrom-Json
if (!$plan.eligibleForInstall -or !$plan.nativeFixturePassed -or !$plan.emittedBridgePassed -or !$plan.productionExceptionPassed -or !$plan.deltaPassed) { throw '候选尚未完成验证' }
function Hash([string]$p) { (Get-FileHash -LiteralPath $p).Hash.ToLowerInvariant() }
$destinations=@{'Foxmail-dark-reveal.exe'=(Join-Path $target 'Foxmail深色.exe');'FoxmailRevealGate.dll'=(Join-Path $target 'FoxmailRevealGate.dll');'build-info.json'=(Join-Path $target 'DarkModeBackup\build-info.json')}
if((Hash (Join-Path $target 'Foxmail.exe')) -ne '54da7a968ad8a12bf80978269edfc57f520af9f19a18e5b78bf48742983dd4df'){throw '原版文件校验失败'}
foreach($name in $destinations.Keys){
 if((Hash $destinations[$name]) -ne $plan.baselineFiles.$name){throw ('当前文件不符：'+$name)}
 if((Hash (Join-Path $work $name)) -ne $plan.files.$name){throw ('候选文件不符：'+$name)}
}
if($Preflight){'Preflight PASS: exact installed v1 and complete v2 candidate verified.';return}
if(Get-CimInstance Win32_Process | Where-Object {$_.Name -like 'Foxmail*' -or $_.Name -eq 'TxBugReport.exe'}){throw '请先保存内容并完全退出 Foxmail 和错误报告窗口'}
foreach($name in @('Foxmail-dark-reveal.exe','FoxmailRevealGate.dll')){$lock=[IO.File]::Open($destinations[$name],[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$lock.Dispose()}
$backup=Join-Path $target 'DarkModeBackup\BeforeRevealV2-4933A14B'
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach($name in $destinations.Keys){
 $saved=Join-Path $backup $name
 if(Test-Path -LiteralPath $saved){if((Hash $saved) -ne $plan.baselineFiles.$name){throw '已有备份不符'}}else{Copy-Item -LiteralPath $destinations[$name] -Destination $saved}
}
try{
 foreach($name in @('FoxmailRevealGate.dll','Foxmail-dark-reveal.exe','build-info.json')){Copy-Item -LiteralPath (Join-Path $work $name) -Destination $destinations[$name] -Force}
 foreach($name in $destinations.Keys){if((Hash $destinations[$name]) -ne $plan.files.$name){throw '安装后校验失败'}}
}catch{
 foreach($name in $destinations.Keys){Copy-Item -LiteralPath (Join-Path $backup $name) -Destination $destinations[$name] -Force}
 throw
}
$plan.files.'Foxmail-dark-reveal.exe' | Set-Content -LiteralPath (Join-Path $target 'DarkModeBackup\installed-sha256.txt')
'Installed v2 reveal candidate; complete v1 executable/helper/metadata retained for rollback.'
