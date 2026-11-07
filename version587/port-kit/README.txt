Foxmail 深色版离线移植包

单文件 CMD 用法
将 Foxmail-Dark-Patch.cmd 放到官方 Foxmail.exe 同级目录后双击。
通过守卫时，在 Foxmail 软件目录旁生成 <目录名>-dark-overlay-5.0。
CMD 使用 Windows 自带的 Windows PowerShell 5.1，内嵌资源自动解包。
命令行可用 Foxmail-Dark-Patch.cmd check 只读预检，或用 trial 生成当前部署的试用配置。
apply 相当于双击时的 5.0 模式，供命令行调用。

ZIP 用法
先解压整个 ZIP。在 PowerShell 7 中进入解压目录。
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

预检核对官方 EXE 的 SHA256 与结构，并按 39 个具名路径分别标出原文件匹配、已是深色版本、已变化或缺失。
当前两份配置都要求上游 Windows Foxmail 7.2.25.587 的精确 EXE 指纹。
新版只要指纹或静态资源前像不同，脚本便会列出阻塞项并停止生成。版本号相同也要核对哈希。
应按报告取得新版的官方程序文件，重新映射原生代码和资源，再建立带哈希与测试证据的配置。

输出是一套补丁覆盖文件，依赖相应版本已有的官方运行库。
手动试用时，应将输出用于隔离的软件副本，另保留该副本的原始文件。试用出错时从原副本继续运行。
脚本不复制整套软件，不覆盖 AppRoot，不启动 Foxmail，也不检查邮件、账户和个人设置。
