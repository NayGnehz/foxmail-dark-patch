[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 $temp=Join-Path $instance.instanceRoot 'temp';$release=Join-Path $context.workspaceRoot '_发布\foxmail\2.0';$stage=Join-Path $temp 'release-2.0-staging'
 $null=Assert-PortablePlainPath $release;$null=Assert-PortablePlainPath $stage
 if((Test-Path -LiteralPath $release) -or (Test-Path -LiteralPath $stage)){throw 'Archive/staging already exists; do not overwrite 2.0'}
 $buffer=Get-Content -LiteralPath (Join-Path $temp 'version587-goal\buffer-validation.json') -Raw|ConvertFrom-Json
 $base=Get-Content -LiteralPath (Join-Path $temp 'version587\validation.json') -Raw|ConvertFrom-Json
 if($buffer.candidateSHA256 -ne '079cb41212c8f3546861526074e3c1f162f7f14683e41c48ca8a9d3ab63078cd' -or $buffer.helperSHA256 -ne 'bf008ee50252930dc702c129f5e746b566d078c0ce0874bd0ce360746dd0fd48'){throw 'Previous user-tested version identity changed'}
 $files=@(@{relative='Foxmail深色.exe';source=$buffer.dest;sha256=$buffer.candidateSHA256},@{relative='FoxmailRevealGate.dll';source=$buffer.helper;sha256=$buffer.helperSHA256})
 foreach($f in $base.assets){$files+=@{relative=$f.relative;source=$f.source;sha256=$f.candidateSHA256}}
 foreach($f in $files){if((Hash $f.source) -ne $f.sha256){throw ('Archive input mismatch '+$f.relative)}}
 foreach($f in $files){$dest=Join-Path (Join-Path $stage 'payload') $f.relative;[void][IO.Directory]::CreateDirectory((Split-Path $dest -Parent));Copy-Item -LiteralPath $f.source -Destination $dest;if((Hash $dest) -ne $f.sha256){throw 'Archive byte verification failed'}}
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'restore-2.0.ps1') -Destination (Join-Path $stage '恢复2.0.ps1')
 $manifest=@{release='2.0';foxmailVersion='7.2.25.587';originalExecutableSHA256=$base.sourceSHA256;createdUTC=[DateTime]::UtcNow.ToString('o');selection='Previous user-tested compose-buffer version, explicitly retained at user request';knownIssues=@('Short black flash and initial toolbar jitter','Dark text on dark editor workspace','Account settings vertical light lines');files=@($files|ForEach-Object {@{relative=$_.relative;sha256=$_.sha256;length=(Get-Item -LiteralPath $_.source).Length}})}
 [IO.File]::WriteAllText((Join-Path $stage 'manifest.json'),($manifest|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
 $note="Foxmail 深色修改包 2.0`r`n适用于原版 7.2.25.587，不是完整安装包，不含邮件、账号、配置或凭据。`r`n按用户要求保留上一轮实际测试版本：可见无白闪，存在短暂黑闪、顶部按钮抖动、深色编辑纸面黑字及账号页竖线。此命名不表示遗留问题已经修复。`r`n不包含后续已失败的浅色纸面/CreatePenIndirect 全局挂钩试验。`r`n校验：.\恢复2.0.ps1 -TargetRoot 'Foxmail安装目录' -VerifyOnly`r`n恢复：完全退出对应 Foxmail 后运行同一命令并去掉 -VerifyOnly。恢复只覆盖清单所列39个程序/皮肤/模板文件，原文件保存在登记开发缓存。不会自动启动。`r`n"
 [IO.File]::WriteAllText((Join-Path $stage '说明.txt'),$note,[Text.UTF8Encoding]::new($false))
 Move-Item -LiteralPath $stage -Destination $release
 [pscustomobject]@{archived=$release;files=$files.Count;exeSHA256=$buffer.candidateSHA256;helperSHA256=$buffer.helperSHA256;bytes=($manifest.files|Measure-Object length -Sum).Sum}|ConvertTo-Json
}
