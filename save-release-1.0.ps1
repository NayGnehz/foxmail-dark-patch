$ErrorActionPreference='Stop'
$appRoot='D:\Users\Public\Downloads\Foxmail'
$releaseRoot=Join-Path $PSScriptRoot 'releases\1.0'
if(Test-Path -LiteralPath $releaseRoot){throw '1.0 archive already exists; do not overwrite the baseline'}
$expectedExe='31DEE04ABB894B72DE7CF56292CD2121E9D5CE56816A623F1EE797787CF6F624'
$expectedDll='9DEB8E3881AD7C8736E37BB39AAF8CFA73C92EB9BA873E9189F5C27CD99E18A0'
if((Get-FileHash -LiteralPath (Join-Path $appRoot 'Foxmail深色.exe')).Hash -ne $expectedExe){throw 'Installed executable differs from validated v2'}
if((Get-FileHash -LiteralPath (Join-Path $appRoot 'FoxmailRevealGate.dll')).Hash -ne $expectedDll){throw 'Installed helper differs from validated v2'}
$originalSkin=Join-Path $appRoot 'DarkModeBackup\OriginalSkin'
$relativeFiles=@('Foxmail深色.exe','FoxmailRevealGate.dll','DarkModeBackup\build-info.json','7.2.25.563\Template\Conversation\mail_frame.html')
foreach($file in Get-ChildItem -LiteralPath $originalSkin -File -Recurse){
 $relativeFiles+=('7.2.25.563\'+$file.FullName.Substring($originalSkin.Length+1))
}
$relativeFiles=@($relativeFiles | Sort-Object -Unique)
$payload=Join-Path $releaseRoot 'payload'
New-Item -ItemType Directory -Path $payload -Force | Out-Null
$manifestFiles=@()
foreach($relative in $relativeFiles){
 $source=[IO.Path]::GetFullPath((Join-Path $appRoot $relative))
 $destination=[IO.Path]::GetFullPath((Join-Path $payload $relative))
 if(!$source.StartsWith($appRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or !$destination.StartsWith($payload+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid archive path'}
 if(!(Test-Path -LiteralPath $source -PathType Leaf)){throw ('Missing source '+$relative)}
 $before=(Get-FileHash -LiteralPath $source).Hash
 New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
 Copy-Item -LiteralPath $source -Destination $destination
 if((Get-FileHash -LiteralPath $source).Hash -ne $before -or (Get-FileHash -LiteralPath $destination).Hash -ne $before){throw ('Source changed during archive '+$relative)}
 $manifestFiles+=([ordered]@{relative=$relative;sha256=$before;bytes=(Get-Item -LiteralPath $destination).Length})
}
$manifest=[ordered]@{
 version='1.0';created=(Get-Date).ToString('o');targetRoot=$appRoot
 originalExecutableSHA256='54DA7A968AD8A12BF80978269EDFC57F520AF9F19A18E5B78BF48742983DD4DF'
 status='User accepted as basically usable; settings flash corrected to absent'
 files=$manifestFiles
 knownLimitations=@('Initial automatic launch may show white edges','First tray restore after restart may flash; later taskbar/tray restores reported normal','Search field focus/background and edit borders remain light','Receive-mail separator and some settings controls remain light')
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $releaseRoot 'manifest.json') -Encoding UTF8
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'restore-release-template.ps1') -Destination (Join-Path $releaseRoot '恢复1.0.ps1')
$notes=@'
Foxmail 仿 Win11 深色版 1.0 — 当前可用基线

适配副本：D:\Users\Public\Downloads\Foxmail
原版版本：7.2.25.563。启动文件：Foxmail深色.exe。

用户确认：设置页不再白闪；首次托盘恢复以外，后续任务栏和托盘恢复不再白闪。
保留当前字号、分类切换和邮件阅读逻辑。未启用整窗分层/双缓冲、定时延迟或像素采样。

已知剩余问题：首次自动启动可能有白边；重启后的第一次托盘恢复可能白闪。
搜索框激活底色、展开搜索边框、收取邮件分隔线，以及部分设置输入框/子标签仍有浅色。
这些已明确列为1.0遗留问题，后续候选与本基线分开保存。

本归档只含深色程序、辅助模块、构建记录、阅读模板及已改过的控件皮肤。
没有邮件、账号配置、密码或 Storage 数据。不是完整 Foxmail 安装包。

恢复此深色基线：保存内容并完全退出 Foxmail（含托盘）后运行“恢复1.0.ps1”。
脚本核对原版版本和全部文件哈希，先备份当前对应文件，再恢复，不自动启动程序。
只核对而不写入：powershell -NoProfile -ExecutionPolicy Bypass -File .\恢复1.0.ps1 -VerifyOnly
'@
[IO.File]::WriteAllText((Join-Path $releaseRoot '说明.txt'),$notes,[Text.UTF8Encoding]::new($true))
[pscustomobject]@{version=$manifest.version;created=$manifest.created;fileCount=$manifestFiles.Count;bytes=($manifestFiles | ForEach-Object {$_.bytes} | Measure-Object -Sum).Sum} | ConvertTo-Json
