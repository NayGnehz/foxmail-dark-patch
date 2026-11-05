$ErrorActionPreference='Stop'
$target='D:\Users\Public\Downloads\Foxmail'
if(Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'Foxmail*' }){throw '请先保存内容并退出 Foxmail（包括托盘），再运行安装。'}
$expectedOriginal='54DA7A968AD8A12BF80978269EDFC57F520AF9F19A18E5B78BF48742983DD4DF'
if((Get-FileHash -LiteralPath (Join-Path $target 'Foxmail.exe') -Algorithm SHA256).Hash -ne $expectedOriginal){throw '原版版本或内容已变化，停止安装。'}
$version=Join-Path $target '7.2.25.563'
$backup=Join-Path $target 'DarkModeBackup'
$skinStage='D:\Workspace\Foxmail\ExternalSkinUpdate'
$skinEntries=Get-Content -LiteralPath (Join-Path $skinStage 'manifest.json') -Raw | ConvertFrom-Json
foreach($entry in $skinEntries){
 $skinPath=[IO.Path]::GetFullPath((Join-Path $version $entry.relative))
 if(!$skinPath.StartsWith($version+'\',[StringComparison]::OrdinalIgnoreCase)){throw '皮肤文件路径超出副本'}
 $hash=(Get-FileHash -LiteralPath $skinPath -Algorithm SHA256).Hash
 if($hash -ne $entry.originalSHA256 -and $hash -ne $entry.newSHA256){throw ('皮肤文件已变化，停止覆盖：'+$entry.relative)}
}
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$frame=Join-Path $version 'Template\Conversation\mail_frame.html'
$saved=Join-Path $backup 'mail_frame.html'
if(!(Test-Path -LiteralPath $saved)){Copy-Item -LiteralPath $frame -Destination $saved}
Copy-Item -LiteralPath $frame -Destination (Join-Path $backup 'mail_frame-上次版本.html') -Force
if(Test-Path -LiteralPath (Join-Path $target 'Foxmail深色.exe')){
 Copy-Item -LiteralPath (Join-Path $target 'Foxmail深色.exe') -Destination (Join-Path $backup 'Foxmail深色-上次版本.exe') -Force
}
$html=[IO.File]::ReadAllText($saved)
$css=[IO.File]::ReadAllText('D:\Workspace\Foxmail\dark-mode-v2.css').Replace('../Common/','{{common_path}}/')
$css+="`r`n"+[IO.File]::ReadAllText('D:\Workspace\Foxmail\dark-scrollbars.css')
$readingScript=[IO.File]::ReadAllText('D:\Workspace\Foxmail\dark-reading-text.js')
if($readingScript -match '(?i)</script'){throw '阅读配色脚本含不可内联的关闭标签'}
$html=$html.Replace('</head>',"<style id='foxmail-local-dark'>`r`n"+$css+"`r`n</style>`r`n<script id='foxmail-reading-dark' nonce='{{random_nonce}}'>`r`n"+$readingScript+"`r`n</script>`r`n</head>")
[IO.File]::WriteAllText($frame,$html,[Text.Encoding]::Unicode)
Copy-Item -LiteralPath 'D:\Workspace\Foxmail\Foxmail-dark-fixed.exe' -Destination (Join-Path $target 'Foxmail深色.exe') -Force
foreach($entry in $skinEntries){
 $skinPath=Join-Path $version $entry.relative
 $originalSkin=Join-Path (Join-Path $backup 'OriginalSkin') $entry.relative
 $previousSkin=Join-Path (Join-Path $backup 'PreviousSkin') $entry.relative
 New-Item -ItemType Directory -Path (Split-Path $originalSkin),(Split-Path $previousSkin) -Force | Out-Null
 if(!(Test-Path -LiteralPath $originalSkin)){Copy-Item -LiteralPath $skinPath -Destination $originalSkin}
 Copy-Item -LiteralPath $skinPath -Destination $previousSkin -Force
 Copy-Item -LiteralPath (Join-Path $skinStage $entry.relative) -Destination $skinPath -Force
}
Copy-Item -LiteralPath (Join-Path $skinStage 'manifest.json') -Destination (Join-Path $backup 'external-controls.json') -Force
Copy-Item -LiteralPath 'D:\Workspace\Foxmail\Foxmail-dark.exe.json' -Destination (Join-Path $backup 'build-info.json') -Force
Copy-Item -LiteralPath 'D:\Workspace\Foxmail\Foxmail-dark-final.exe.bitmap-report.json' -Destination (Join-Path $backup 'bitmap-report.json') -Force
Copy-Item -LiteralPath 'D:\Workspace\Foxmail\Foxmail-dark-backgrounds.exe.bitmap-report.json' -Destination (Join-Path $backup 'background-report.json') -Force
Copy-Item -LiteralPath 'D:\Workspace\Foxmail\Foxmail-dark-static.exe.bitmap-report.json' -Destination (Join-Path $backup 'numeric-background-report.json') -Force
Copy-Item -LiteralPath 'D:\Workspace\Foxmail\Foxmail-dark-controls.exe.bitmap-report.json' -Destination (Join-Path $backup 'dialog-controls-report.json') -Force
Copy-Item -LiteralPath 'D:\Workspace\Foxmail\Foxmail-dark-shadow.exe.menu-shadow.json' -Destination (Join-Path $backup 'menu-shadow-report.json') -Force
Copy-Item -LiteralPath 'D:\Workspace\Foxmail\Foxmail-dark-borders.exe.groupbox-borders.json' -Destination (Join-Path $backup 'control-borders-report.json') -Force
Copy-Item -LiteralPath 'D:\Workspace\Foxmail\Foxmail-dark-fixed.exe.accessibility-fix.json' -Destination (Join-Path $backup 'accessibility-fix.json') -Force
Copy-Item -LiteralPath 'D:\Workspace\Foxmail\patch-native-header-colors.cjs' -Destination (Join-Path $backup 'native-header-colors.cjs') -Force
(Get-FileHash -LiteralPath (Join-Path $target 'Foxmail深色.exe') -Algorithm SHA256).Hash | Set-Content -LiteralPath (Join-Path $backup 'installed-sha256.txt')
$notes=@'
Foxmail 仿 Win11 深色实验版
启动：双击当前目录 Foxmail深色.exe。先完全退出其他 Foxmail（含托盘），避免单实例锁打开原版。
原 Foxmail.exe 保持原样。深色版新增当前进程内的原生配色适配，未更改 Windows 全局颜色。
配色：中性深灰背景 #202020，面板 #282828，分隔线 #3d3d3d，正文 #e6e6e6，蓝色选中状态。
设置按钮、复选框、单选框、下拉框及搜索展开按钮采用深色贴图。
本轮保留系统画刷生命周期和越界颜色参数修复。原生矩形边框采用暗色描边，窗口类采用独立深色背景画刷以减少恢复窗口时的白色擦底。
设置分组框修正实际贴图与颜色常量；没有启用改变控件绘制分支的实验补丁。
本轮根据实际窗口诊断，去除 FMShadowWnd 阴影窗口的系统边框，并将 menu_bg.png 浅色环线改为深灰。
仅对已确认的 TVirtualDrawTree、TFMCheckBox、TFMRadioButton 在首次擦底时补深色；随后仍执行原有处理流程。
后续修正：TXPanel 和设置窗体也补首次擦底；托盘恢复只在主窗体确实最小化时直接还原，保留最大化状态。
HTML 编辑器的浏览器初始画布设为深色，仅修改初始化选项；签名内容、发信 HTML、字体颜色及编辑模板均不作改写。
窗口显示前请求 Windows 关闭本窗口的 DWM 过渡动画、启用深色框架并隐藏系统边框；不会改变 Windows 全局主题或动画设置。
已撤销无效的菜单事后覆盖和位图纯白清空改色，保留原生缓冲与遮罩语义。
本版精简绘图颜色适配，并加入针对此版本辅助功能节点遍历的单字节候选修正。
邮件分隔线、日期分组、排序栏及右侧标题条已改为固定深色配色，减少绘制时的重复转换。
常规屏幕绘制采用单次原生渐变填充，特殊绘图状态保留原路径；整体流畅度仍取决于实际邮件与窗口操作。
阅读模板也加入深色覆盖。部分图片、第三方 HTML 邮件、原生控件仍可能保留浅色。
正文低对比度文字仅在内容载入时调整屏幕显示，不改邮件 HTML、回复引用或打印颜色；图片内的文字保持图片原样。
没有改写 Storage、账号或邮件内容。写信模板、打印模板没有修改。
深色版的打印与写信配色未完成端到端验证；需要正式打印时请退出深色版并使用原 Foxmail.exe。
还原：退出 Foxmail，将 DarkModeBackup\mail_frame.html 复制回
7.2.25.563\Template\Conversation\mail_frame.html，然后运行原 Foxmail.exe。
外部控件皮肤也有同步更新；完整还原时将 DarkModeBackup\OriginalSkin 内的目录对应复制回 7.2.25.563。
上一次深色程序保存在 DarkModeBackup\Foxmail深色-上次版本.exe，配套模板保存在 mail_frame-上次版本.html；如需回退，退出程序后将两者分别复制回程序与模板原位置。
深色程序是修改后的实验版，原数字签名不再适用。软件升级可能覆盖模板。
'@
[IO.File]::WriteAllText((Join-Path $target '深色模式说明.txt'),$notes,[Text.UTF8Encoding]::new($true))
Get-Item -LiteralPath (Join-Path $target 'Foxmail深色.exe'),$frame,$saved | Select-Object FullName,Length
