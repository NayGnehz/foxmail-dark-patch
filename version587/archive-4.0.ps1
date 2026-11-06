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
 $release=Join-Path $context.workspaceRoot '_发布\foxmail\4.0'
 $stage=Join-Path $instance.instanceRoot 'temp\release-4.0-staging'
 $previousManifest=Join-Path $context.workspaceRoot '_发布\foxmail\3.0\manifest.json'
 foreach($path in @($app,$release,$stage,$previousManifest)){$null=Assert-PortablePlainPath $path}
 if((Test-Path -LiteralPath $release) -or (Test-Path -LiteralPath $stage)){throw 'Archive/staging already exists; do not overwrite 4.0'}
 $previousManifestHash='15f1f7d5b23746772d37c3b6a46fe64be5c65dc84582eec333e3060b5fc7a880'
 if((Hash $previousManifest) -ne $previousManifestHash){throw 'Existing 3.0 asset inventory changed'}
 $base=Get-Content -LiteralPath $previousManifest -Raw|ConvertFrom-Json
 $originalHash='f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'
 if($base.release -ne '3.0' -or $base.files.Count -ne 39 -or $base.originalExecutableSHA256 -ne $originalHash){throw 'Unexpected 3.0 inventory identity'}
 $original=Join-Path $app 'Foxmail.exe';$null=Assert-PortablePlainPath $original
 if((Hash $original) -ne $originalHash){throw 'Expected original Foxmail 7.2.25.587'}
 $files=@(
  @{relative='Foxmail深色.exe';sha256='62faa3d801b1fcf8726a5b29f9636b8cc6e0fbec96e215ff7c856be6bbb5e52c'},
  @{relative='FoxmailRevealGate.dll';sha256='0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70'}
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
  release='4.0';foxmailVersion='7.2.25.587';originalExecutableSHA256=$originalHash
  createdUTC=[DateTime]::UtcNow.ToString('o')
  selection='Current installed and visually accepted Downloads copy, explicitly saved as 4.0 before account-page vertical-line work'
  accepted=@('First tray restoration and main-window startup border fixes retained','Compose/reply/forward and fresh-compose Alt+A passed user visual checks after manual restart: no white flash, black flash, button jitter or white outlines','Final numeric sample: 14 owner-bound readiness releases, zero timeout/failure counters, DPI 120')
  knownIssues=@('Account settings two vertical light lines remain unresolved','Dark text readability on dark editor workspace remains unresolved','Reminder-window recoloring still awaits visual confirmation','Readiness and render-window geometry are candidate presentation conditions, not a guarantee for every possible timing')
  files=@($files|ForEach-Object {[ordered]@{relative=$_.relative;sha256=$_.sha256;length=$_.length}})
 }
 $manifestPath=Join-Path $stage 'manifest.json'
 [IO.File]::WriteAllText($manifestPath,($manifest|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
 $manifestHash=Hash $manifestPath
 $restore=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'restore-4.0.ps1') -Raw
 if(([regex]::Matches($restore,'__MANIFEST_SHA256__')).Count -ne 1){throw 'Expected one restore manifest placeholder'}
 [IO.File]::WriteAllText((Join-Path $stage '恢复4.0.ps1'),$restore.Replace('__MANIFEST_SHA256__',$manifestHash),[Text.UTF8Encoding]::new($false))
 $note=@"
Foxmail 深色修改包 4.0
适用于原版 7.2.25.587，不是完整安装包，不含邮件、账号、配置或凭据。
按用户要求保存当前 Downloads 副本：深色 EXE、辅助 DLL 和既有37项具名皮肤/模板，共39个程序/静态资源文件。3.0 封存包保持不变。
保留首次托盘恢复及主窗口首次激活白边修复。用户连续开写信、手动重开程序后测试回复/转发及刚打开写信时Alt+A，确认均正常，没有白闪、黑闪、按钮抖动或白线。
最终数值为14次收到就绪通知并释放显示、0次超时/失败，DPI为120。显示门只对写信窗口异步等待其自身加载通知及完整渲染窗口，不改变邮件HTML或模板内容；不是所有可能时序的保证。
设置→账号页两条竖线、深色编辑区黑字可读性仍未解决，提醒窗改色视觉待确认。按用户要求先封存4.0，再继续研究账号竖线；2.0和3.0归档保留。
校验：.\恢复4.0.ps1 -TargetRoot 'Foxmail安装目录' -VerifyOnly
恢复：完全退出对应 Foxmail 后运行同一命令并去掉 -VerifyOnly。需要同一共享总根中的 _开发环境；原文件先保存在登记开发缓存，只覆盖清单中的39项，不会自动启动。
VerifyOnly校验本包清单SHA256、39项payload的长度/hash和目标原版身份，不写入或重启目标程序，也不要求目标当前深色文件与本包相同。
"@
 [IO.File]::WriteAllText((Join-Path $stage '说明.txt'),$note+"`r`n",[Text.UTF8Encoding]::new($false))
 foreach($f in $files){if((Hash $f.source) -ne $f.sha256){throw ('Input changed during archive: '+$f.relative)}}
 if((Hash $previousManifest) -ne $previousManifestHash){throw '3.0 inventory changed during archive'}
 Move-Item -LiteralPath $stage -Destination $release
 $metadata=@('manifest.json','恢复4.0.ps1','说明.txt')
 $payloadBytes=($manifest.files|ForEach-Object {[long]$_['length']}|Measure-Object -Sum).Sum
 $metadataBytes=($metadata|ForEach-Object {(Get-Item -LiteralPath (Join-Path $release $_)).Length}|Measure-Object -Sum).Sum
 [pscustomobject]@{archived=$release;payloadFiles=$files.Count;payloadBytes=$payloadBytes;totalFiles=($files.Count+$metadata.Count);totalBytes=($payloadBytes+$metadataBytes);manifestSHA256=$manifestHash;exeSHA256=$files[0].sha256;helperSHA256=$files[1].sha256;previousArchiveUnchanged=$true}|ConvertTo-Json
}
