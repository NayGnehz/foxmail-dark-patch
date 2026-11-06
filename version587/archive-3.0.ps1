[CmdletBinding()]
param([Parameter(Mandatory)][string]$AppRoot)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 $app=[IO.Path]::GetFullPath($AppRoot).TrimEnd('\')
 $release=Join-Path $context.workspaceRoot '_发布\foxmail\3.0'
 $stage=Join-Path $instance.instanceRoot 'temp\release-3.0-staging'
 $previousManifest=Join-Path $context.workspaceRoot '_发布\foxmail\2.0\manifest.json'
 foreach($path in @($app,$release,$stage,$previousManifest)){$null=Assert-PortablePlainPath $path}
 if((Test-Path -LiteralPath $release) -or (Test-Path -LiteralPath $stage)){throw 'Archive/staging already exists; do not overwrite 3.0'}
 $previousManifestHash='b4fdfc7e12df1cf1d96303b5d39bfcbcc20bc5f111dd4624ea6085cc85ac08a9'
 if((Hash $previousManifest) -ne $previousManifestHash){throw 'Existing 2.0 asset inventory changed'}
 $base=Get-Content -LiteralPath $previousManifest -Raw|ConvertFrom-Json
 $originalHash='f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'
 if($base.release -ne '2.0' -or $base.files.Count -ne 39 -or $base.originalExecutableSHA256 -ne $originalHash){throw 'Unexpected 2.0 inventory identity'}
 $original=Join-Path $app 'Foxmail.exe';$null=Assert-PortablePlainPath $original
 if((Hash $original) -ne $originalHash){throw 'Expected original Foxmail 7.2.25.587'}
 $files=@(
  @{relative='Foxmail深色.exe';sha256='f8f4732d8fd74411c6bed7306041d02cbdcb4bad604eb3dc265b4fa6f7d03f82'},
  @{relative='FoxmailRevealGate.dll';sha256='29efc7d9ec5b402f6a00a165a586f0762ec51aa2495cdcdc8e0a5fb31bc05515'}
 )
 $assets=@($base.files|Where-Object {$_.relative -like '7.2.25.587/*'})
 if($assets.Count -ne 37){throw 'Expected exactly 37 named static assets'}
 foreach($f in $assets){
  if($f.relative -notmatch '^7\.2\.25\.587/(PngImages|Skin|Template)/[^:]+$' -or $f.relative.Contains('..')){throw 'Unexpected static asset path'}
  $files+=@{relative=$f.relative;sha256=$f.sha256}
 }
 if(@($files.relative|Sort-Object -Unique).Count -ne 39){throw 'Duplicate asset paths'}
 foreach($f in $files){
  $f.source=[IO.Path]::GetFullPath((Join-Path $app $f.relative))
  if(!$f.source.StartsWith($app+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Input outside application root'}
  $null=Assert-PortablePlainPath $f.source
  if((Hash $f.source) -ne $f.sha256){throw ('Installed software differs from accepted snapshot: '+$f.relative)}
  $f.length=(Get-Item -LiteralPath $f.source).Length
 }
 foreach($f in $files){
  $dest=Join-Path (Join-Path $stage 'payload') $f.relative
  $null=Assert-PortablePlainPath $dest
  [void][IO.Directory]::CreateDirectory((Split-Path $dest -Parent))
  Copy-Item -LiteralPath $f.source -Destination $dest
  if((Hash $dest) -ne $f.sha256 -or (Get-Item -LiteralPath $dest).Length -ne $f.length){throw 'Archive byte verification failed'}
 }
 $manifest=[ordered]@{
  release='3.0';foxmailVersion='7.2.25.587';originalExecutableSHA256=$originalHash
  createdUTC=[DateTime]::UtcNow.ToString('o')
  selection='Current installed Downloads copy, explicitly saved at user request before further compose/reply/forward research'
  accepted=@('First tray restoration fix accepted by user','Main-window first-activation border fix: two restarts confirmed without white borders; one foreground, one background then switched back; DPI 120')
  knownIssues=@('Compose/reply/forward white flash remains unresolved; user screenshot shows upper editor area white and lower area black','WeChat screenshot shortcut Alt+A frequently triggers white outlines around the compose window; mouse repaint only clears part of them','Dark text readability on dark editor workspace remains unresolved','Account settings vertical light lines remain unresolved','Reminder-window recoloring still awaits visual confirmation','Main-window screenshot-triggered borders have not been independently retested; main-window startup acceptance does not cover other windows')
  files=@($files|ForEach-Object {[ordered]@{relative=$_.relative;sha256=$_.sha256;length=$_.length}})
 }
 $manifestPath=Join-Path $stage 'manifest.json'
 [IO.File]::WriteAllText($manifestPath,($manifest|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
 $manifestHash=Hash $manifestPath
 $restore=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'restore-3.0.ps1') -Raw
 if(([regex]::Matches($restore,'__MANIFEST_SHA256__')).Count -ne 1){throw 'Expected one restore manifest placeholder'}
 [IO.File]::WriteAllText((Join-Path $stage '恢复3.0.ps1'),$restore.Replace('__MANIFEST_SHA256__',$manifestHash),[Text.UTF8Encoding]::new($false))
 $note=@"
Foxmail 深色修改包 3.0
适用于原版 7.2.25.587，不是完整安装包，不含邮件、账号、配置或凭据。
按用户要求保存当前 Downloads 副本：深色 EXE、辅助 DLL 和既有37项具名皮肤/模板，共39个程序/静态资源文件。2.0 封存包保持不变。
主窗首次激活的局部修复已在两轮重启中由用户确认没有白边；一次前台、一次后台采样后直接切回，DPI均为120。首次托盘恢复修复此前已接受。
写信/回复/转发白闪仍未解决，用户截图显示编辑区上半白、下半黑。用户Alt+A启动微信截图时，写信弹窗外围白线高概率出现，鼠标重绘只能清一部分。
深色编辑区黑字可读性和账号页竖线仍未解决；提醒窗改色视觉待确认。主窗的微信截图触发尚未独立复测，两轮主窗启动无白边的验收不代表其他窗口白边已解决。3.0命名不表示这些问题已经修复。
校验：.\恢复3.0.ps1 -TargetRoot 'Foxmail安装目录' -VerifyOnly
恢复：完全退出对应 Foxmail 后运行同一命令并去掉 -VerifyOnly。需要同一共享总根中的 _开发环境；原文件先保存在登记开发缓存，只覆盖清单中的39项，不会自动启动。
VerifyOnly校验本包清单SHA256、39项payload的长度/hash和目标原版身份，不写入或重启目标程序，也不要求目标当前深色文件与本包相同。
"@
 [IO.File]::WriteAllText((Join-Path $stage '说明.txt'),$note+"`r`n",[Text.UTF8Encoding]::new($false))
 foreach($f in $files){if((Hash $f.source) -ne $f.sha256){throw ('Input changed during archive: '+$f.relative)}}
 if((Hash $previousManifest) -ne $previousManifestHash){throw '2.0 inventory changed during archive'}
 Move-Item -LiteralPath $stage -Destination $release
 $metadata=@('manifest.json','恢复3.0.ps1','说明.txt')
 $payloadBytes=($manifest.files|ForEach-Object {[long]$_['length']}|Measure-Object -Sum).Sum
 $metadataBytes=($metadata|ForEach-Object {(Get-Item -LiteralPath (Join-Path $release $_)).Length}|Measure-Object -Sum).Sum
 [pscustomobject]@{archived=$release;payloadFiles=$files.Count;payloadBytes=$payloadBytes;totalFiles=($files.Count+$metadata.Count);totalBytes=($payloadBytes+$metadataBytes);manifestSHA256=$manifestHash;exeSHA256=$files[0].sha256;helperSHA256=$files[1].sha256;previousArchiveUnchanged=$true}|ConvertTo-Json
}
