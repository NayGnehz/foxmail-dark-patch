Foxmail 深色版离线移植包

单文件 CMD 用法
从托盘完全退出目标 Foxmail。将 Foxmail-Dark-Patch.cmd 放到官方 Foxmail.exe 同级后双击。
首次运行校验原版软件文件，将 Foxmail.exe 和对应资源原文件移到原版备份，再就地安装深色版。
安装和恢复后都运行同目录的 Foxmail.exe。
需要恢复时完全退出 Foxmail，再双击同一个 CMD。它会移回原文件并恢复文件的创建时间和最后修改时间。
原件归位后清理原版备份。本工具会保留你另行放入备份目录的文件。
若操作中断且原版备份仍在，再运行同一 CMD 继续恢复。
新版也可恢复上一版 CMD 的备份并清理目录。旧备份未保存的原始时间戳需从更早的备份找回。
CMD 使用 Windows 自带的 Windows PowerShell 5.1。
check 只读预检，apply 安装本包默认配置，trial 安装原试用配置，restore 显式恢复。
带托盘崩溃防护的 CMD 默认安装 5.0-msaa。上一版 CMD 的原版备份可直接恢复。
从上一版切换时，先用同一 CMD 恢复原版，再双击一次安装。trial 仍选择原有写信试用版。
颜色修复候选包默认安装 5.0-msaa-contrast，将收件人字色和工具栏阴影修复与托盘防护合并。
同时修复选人窗口标题、地址簿搜索字色和附件选中背景，额外备份 attach_select.png，共 41 个原文件。
搜索与选人后续包还包含邮件搜索字色、条件标签边线、建议窗边框和选人列表首帧背景修复，备份文件仍为 41 个。
首次擦底候选在此基础上补齐选人窗口四个收件人列表的初始深色填充，仍复用现有 DLL 和 41 文件备份。
新增文件的备份使用格式 3，同一新版 CMD 可完整恢复。旧 CMD 会直接拒绝该备份，以免漏恢复新增文件。
没有本工具备份时，已手工修改的资源或已有的深色 EXE/DLL 会阻止首次安装。

ZIP 用法
先解压整个 ZIP。在 Windows PowerShell 5.1 或更新版本中进入解压目录。
下面的 AppRoot 指向软件目录，其中应有官方 Foxmail.exe 和版本目录。

只读预检任何新版
  .\Apply-FoxmailDark.ps1 -AppRoot 'C:\Test\FoxmailNew'

若未能自动识别版本目录，显式传入版本目录的名称
  .\Apply-FoxmailDark.ps1 -AppRoot 'C:\Test\FoxmailNew' -VersionFolder '7.2.25.999'

canGenerate=true 时，可输出整套候选到尚不存在的独立目录
  .\Apply-FoxmailDark.ps1 -AppRoot 'C:\Test\Foxmail587' -OutputDirectory 'C:\Test\FoxmailDarkOverlay'

默认配置 5.0 对应已验收封存，包含深色 EXE 差分、helper DLL、34 张外部皮肤 PNG 和 5 份模板。
-Profile deployed-trial 使用已部署试用的 EXE/DLL，额外包含写信宿主就绪、收件人字色和工具栏阴影修复。
试用配置的两个最后修改还需视觉确认。
-Profile 5.0-msaa 可在带托盘崩溃防护的包中使用。所有衍生配置共享 5.0 的基础 EXE 差分。
-Profile 5.0-msaa-contrast 用于颜色修复候选包，额外安装附件选中背景；其他配置仍使用原有 39 项资源。

预检核对官方 EXE 的 SHA256 与结构，并按 39 个具名路径分别标出原文件匹配、已是深色版本、已变化或缺失。
所有配置都要求上游 Windows Foxmail 7.2.25.587 的精确 EXE 指纹。
新版只要指纹或静态资源前像不同，脚本便会列出阻塞项并停止生成。版本号相同也要核对哈希。
应按报告取得新版的官方程序文件，重新映射原生代码和资源，再建立带哈希与测试证据的配置。

ZIP 脚本输出一套补丁覆盖文件，依赖相应版本已有的官方运行库。
手动试用时，应将输出用于隔离的软件副本，另保留该副本的原始文件。试用出错时从原副本继续运行。
ZIP 脚本只生成独立覆盖目录。CMD 按清单安装或回退软件文件。
两种入口都不启动 Foxmail，也不检查邮件、账户和个人设置。
