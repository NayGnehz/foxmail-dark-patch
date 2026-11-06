# Foxmail 7.2.25.587 适配记录

最新采用状态（2026-11-06晚）：EXE233e7bdf/helper0e47；账号浅色竖线、右沿及
各设置页底边已由用户确认恢复。写信模板c3a898dc使用独立Custom Highlight绘制
保留多色色相，黑字与caret在深色纸面清楚；用户确认颜色、光标及窗口关闭正常。
详见`../docs/account-lines-20261106.md`、`../docs/compose-screen-ink-20261106.md`。
4.0归档保持不变；搜索栏/按钮及地址簿白底/白线已另记待办，尚未改动。
下文按历史保留，不以旧“当前”段落覆盖本段最新状态。

此目录是实验候选的源码，不是完整发行构建。只适用于 SHA256 为
`f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399`
的 Windows 原版。原始程序、固定工具和阶段产物分别保留在共享环境及登记缓存中。

`build.cjs` 复用导入 API 颜色封装和具名资源转换，禁用旧版内部地址。
`map-native.py` 用指令窗口和 RTTI 校验新版地址；不读取运行进程或邮件。
`prepare-native.cjs`、`native-ports.cjs`、`native-colors.cjs` 接入四处擦底、
原生颜色及浏览器初始背景；`borders.cjs` 处理搜索白底、分隔线和编辑框贴图。
`reveal.cjs` 接回同步首次显示补丁，允许精确匹配的设置、打印和写信窗口。
它复用原同步 DLL，不启用 48ms 等待实验、整窗分层、整窗双缓冲或录屏采样。

2026-11-06 首个完整移植候选已安装到用户 Downloads 的 Foxmail 副本。原版 EXE、
已安装的 37 项皮肤/模板以及账户资料未改动。EXE 为
`aba62e036d6ba41d46eaf63e3036488143a707458ff20cbefebb567816e3b78d`，
同步辅助 DLL 为
`c1821caffcdccc4f52e67f397208de70bb38728c16b447ad3bf159bcff936082`。
此 EXE 现保留供下一轮回退。同名原版程序可能通过单实例机制抢占启动，验证时应退出原版再运行副本中的
`Foxmail深色.exe`。本次检查时，用户当前运行的进程来自工厂设计目录的原版。

验证与事务入口：

- `check-reveal.ps1`：在隔离内存执行实际输出的显示补丁，24 项用例通过；
  API 绘制回归 62100 项、初始擦底回归 1509 项通过。既有测试程序的新版
  地址只通过解码 CIL 常量重定位，不调用系统编译器。
- `audit-reveal.cjs`：逐字节检查原文件仅修改 3 个入口、PE 头及追加段。
- `install-reveal.ps1 -Preflight`：校验源、当前文件和进程占用。
- `install-reveal.ps1`：只更新深色 EXE 和辅助 DLL，保存原候选回退文件。
- `install-reveal.ps1 -Rollback -Preflight` / `-Rollback`：校验/恢复本轮前状态。

所有入口使用 `version587-20261105` 登记缓存。Node 步骤通过项目根的
`Invoke-FoxmailPipeline.ps1` 调用。当前映射请求、共享画线函数的九调用点审计、
测试日志和事务回退均在该缓存；尚未整理成从空缓存自动构建的发行入口。
`build.cjs` 的静态资源首次安装计划要求原始字节；资源已安装后会拒绝再次
套用，不能把后续 EXE 候选的空资源计划当作完整安装包。

以上是静态和隔离测试结果，尚待实际窗口验证。同步补丁不保证 Chromium
异步正文的首帧已经提交；不能据此宣称写信白闪完全消失。新版原生渐变优化
尚未移植，编辑器正文配色和发信内容转换仍暂缓。

## 第二轮：选中背景、系统边框和编辑器外壳

用户确认首轮其他白框有改善，但账号页仍有两条竖线，写信/回复/转发仍会白闪。
截图竖线像素为 `#DCDCDC`，不是透明阴影。`edges-next.cjs` 单独移植既有
`add-native-edge.cjs` 系统 DrawEdge 适配，不需要旧版内部地址或渐变优化；
只覆盖兼容屏幕 DC、完整矩形边框，打印 DC、特殊 flags 等仍走原始路径。
实际 x86 回归通过 5184 项绘制区域、裁剪、返回值及 BF_ADJUST 用例。
原来的 API/显示补丁代码段保持不变；仅加段、PE 头和本轮四个颜色常量变化。

`finish-next.cjs` 校验整个共享选中项绘制函数后，仅修改四个渐变端点，分别用于
焦点和非焦点状态；白字对比度在 8.28:1 至 11.85:1 之间。
它还在 HtmlEditor 外壳的阻塞脚本前添加一个 data CSS LINK，只为屏幕中的 html
根元素提供深色底。没有添加 STYLE：实际 GetTextAndHtml 会导出第一个 STYLE，
会将 UI 样式混进邮件。LINK 也不放在可编辑正文中。

`verify-shell.cjs` 用系统已安装 Edge 的独立 headless 缓存检查实际程序模板、
CSP 和导出脚本，使用合成邮件，不连接 Foxmail。12 种富文本/纯文本、
普通邮件/模板导出结果完全一致，首个脚本执行前根底色为 `rgb(32,32,32)`，
非屏幕媒体不生效。这不是完整便携构建依赖，也不证明实际 CEF 首帧一定不闪。
CEF 对文档加载前背景色的定义见
[官方结构说明](https://magpcss.org/ceforum/apidocs3/projects/%28default%29/_cef_browser_settings_t.html)。

第二轮曾安装，现因用户反馈回归而撤回；`install-next.ps1` 仅替换深色 EXE 和
HtmlEditor 外壳，原版、同步 DLL、邮件内容及打印模板保持不变，并支持
`-Preflight`、`-Rollback -Preflight` 与 `-Rollback`。
EXE 为 `b44c42033478e7f3b3ee22bd168a8a0f18a96fcf9d35ffc111b142fa95277ce4`，
外壳为 `c0962c31703b835e45f6eaacb8a011e8ca1259ef5c545017b0c9a83ba4c1cff8`。

## 已采用的回退基线与启动方式

用户反馈第二轮字体模糊、编辑器仍有大块白闪、账号页两条竖线仍在；只接受
新的选中配色。第二轮的 5184 项边框与 12 项导出测试没有覆盖实际显示缩放，
不能当作视觉验收。不要重新安装第二轮候选。

`selection-only.cjs` 从第一轮完整移植基线重新构建，只保留四个渐变颜色常量，
实际改变 12 字节。PE 头、全部非 CODE 段（包括 manifest/资源）、启动代码、
API 与显示补丁完全等于第一轮基线。撤掉新 DrawEdge 启动模块并恢复原编辑器
外壳；原版 EXE、同步辅助 DLL 和已接受的打印模板没有变化。
`install-selection-only.ps1` 复用第二轮的已校验回退事务，再安装仅改选色的 EXE；
失败则保留完整移植基线。支持 `-Preflight` 和回到该基线的 `-Rollback`。

当前 EXE：`7fca5528dd9d54956d929dc733ba60b049c0db6ded16f226f0a3821376d4a65e`。
只读 DPI 对照：回归候选进程窗口报告 96 DPI，回退后报告 120 DPI；两者进程
DPI awareness 均为 1。用户已确认回退后文字清晰。未改注册表、系统缩放或 DPI
清单；触发数值变化的具体新增调用尚未证明，不能归因于某一个 API。

之后用户报告首次点击写信只出现黑线，后续点击正常。发现此前自动启动用了
`-WindowStyle Hidden`；[Windows 首次 ShowWindow 可能采用启动参数](https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-showwindow)。
`restart-visible.ps1` 按正常 GUI 显示方式重启同一 EXE 后，DPI 保持 120；用户
确认第一次写信正常弹出。此对照没有修改任何程序文件。

后续更新约定：

- 用户于 2026-11-06 明确授权直接结束现有 Foxmail 进程后替换，不再要求反复
  手动退出。只对已校验路径的深色副本执行；不结束其他应用或借机进行清理。
- Foxmail 是用户需要操作的可见 GUI，启动使用 Normal；不能套用后台采集器的
  Hidden 参数。`restart-visible.ps1` 校验目标 SHA 和路径后只结束对应进程，
  若其他路径的原版正在运行则停下，避免单实例启动串入原版。
- 当前用户已接受清晰度和选中配色；写信白闪及账号竖线尚未解决。新的修复应
  从该基线作小范围对照，并重新读取窗口 DPI，避免混入字体/缩放回归。

## 主窗口首次启动白边（2026-11-06）

`main-ncactivate.cjs` 从提醒窗改色基线 ce79 生成 f8f4732d 候选，限定主窗首次
默认激活调用，临时使用 WM_NCACTIVATE 的 lParam=-1 避免系统默认边框绘制，
随后恢复参数并继续原有深色自绘。没有新增启动API、DPI设置或延迟重绘。
`check-main-ncactivate.ps1` 的实际机器码1024项ABI用例通过；
`install-main-ncactivate.ps1` 提供安装/回退及 Preflight。

候选已安装到Downloads副本，两轮重启各实际命中1次且主窗DPI120，用户均确认
没有白线。第二轮采样为后台，用户直接切回后确认；微信截图触发尚未独立复测。
详细hash、回退基线及其他未解决问题见 `../docs/diagnosis-astra-20261106.md`。

## 写信、回复、转发首帧（2026-11-06 20:26）

当前已安装并按用户场景验收：EXE `62faa3d8…bbb5e52c`、helper `0e471e40…a135c70`。
连续写信无白闪、黑闪或按钮抖动；用户手动重开后回复、转发及Alt+A均正常，
没有白线。最终14次就绪释放、0次超时及失败，DPI120。2.0、3.0封存保留。

`compose-ready-source.cjs` 生成compose专用异步显示门；
`compose-ready-bridge.cjs` 在主frame原LoadEnd完成后发送固定owner通知；
`compose-ready-package.cjs` 汇总源码/隔离测试/产物校验。
`install-compose-ready.ps1` 安装或`-Rollback`恢复4ca/29ef；`-Preflight`只核对。
`compose-ready-state.py` 一次性读取固定数字计数，`compose-state-trace.py --ready`
采集有界原生事件。完整证据及就绪条件的限制见
`../docs/compose-first-frame-20261106.md`。账号页竖线等其他遗留项尚未处理。
