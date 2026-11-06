# Foxmail 深色修改：GPT-6-Astra / Ultra 完整交接

用户明确要求新建会话，交给 **GPT-6-Astra，reasoning=ultra**。原会话在交接后停止修改，避免两边同时操作同一安装目录。本文是工作索引和证据摘要；以现有文件、校验值、用户实际反馈为准，不把试验通过当成视觉成功。

## 1. 用户目标、授权与沟通

完整目标仍未完成：Foxmail **7.2.25.587** 深色副本中解决：

1. 写邮件、回复、转发窗口的白闪；黑闪、先正常再无字再正常、工具栏抖动也不能冒充解决。
2. 设置→账号页左右两条浅色竖线。
3. 首次启动后关闭到托盘再恢复的首次白闪（用户已确认这一项修好，必须保留）。

保持 120 DPI 字体清晰、已接受的蓝灰选中配色、设置分类切换/字号/退出正常、滚动流畅、打印白纸及正文原色。不允许把屏幕提亮色写入发出的邮件或签名。用户要求仿 Win11 深色；并非改系统主题，Windows 本来就是深色。

新增待办：深色正文纸面上输入黑字不易读；签名编辑器按钮较暗。用户曾选择“浅色编辑纸面、深色工具栏，保持发信原色”，随后暂缓编辑器工作；最新纸面候选严重回归，已禁用。另有右下角新邮件提醒浅底浅字，本轮单独改了底色，尚待实际提醒确认。用户在回退基线上滚动又遇到错误报告，关闭窗口，异常原因仍未知。

**授权**：用户说“以后你可以直接结束现有进程并替换”。可停止经过路径/hash 校验的 Downloads 深色副本进行必要更新，不必每轮要求手动退出；不能结束工厂原版或其他应用。可做只读数字诊断，无需再申请一般读取权限。正常可见 GUI 启动必须 `-WindowStyle Normal`！不要 Hidden。

用户要求先把上一轮实际测试的版本保存为 **2.0**，然后再研究。已完成，不能覆盖封存包。

**子代理成本**：用户特别要求按工作内容选模型，不能全部用高端模型。只有确有独立子任务时才委派；清单、路径核对、摘要等用较轻模型；普通代码/测试用工作模型；复杂 CEF/Win32/ABI 推理才用 Astra。不要为了使用多代理拆碎任务或让多个代理都读完整长历史。用户的本次交接指令明确要求提醒此事。遵守接手会话实际的委派权限。

中文简洁进展更新，说明已经知道什么和仍缺什么。此前消耗已非常大，避免重复全量研究、无差别扫描、重跑不受影响测试、反复录像和要求用户做同样试验。

## 2. 路径、数据边界、工具

- 项目：`D:\Workspace\Foxmail`。先读 `D:\Workspace\AGENTS.md`、本仓库 README、`version587/README.md` 及 `docs/goal-587-status-20261106.md`。
- 修改目标：`D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe`。
- 原版 EXE（同副本）：`...\Foxmail.exe`，7.2.25.587，SHA256 `f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399`。
- 工厂原版：`D:\Workspace\Foxmail`，不修改、不关闭其进程。
- 用户最初还提供过 Mac DMG：`D:\Users\Public\Downloads\Foxmail_for_Mac_1.5.8.95111.dmg`。后来任务已转为 Windows 深色补丁，不需重新研究 DMG。
- 所有生成产物：`D:\Workspace\_开发缓存\projects\foxmail\version587-20261105\temp\`。不放源码根；不要清理别的聊天的缓存/项目。
- 正式修改包：`D:\Workspace\_发布\foxmail\1.0`、`2.0`，不是完整上游安装包。
- **不得读取、输出、哈希、复制真实邮件、账号设置、签名内容、凭据或未知日志。** 程序二进制、静态模板/皮肤、窗口类名/样式/尺寸/DPI、固定字段的加载/透明标志可以读取。不要全进程内存扫描或整份 dump 读取；旧 `inspect-crash.py` 会读内存、异常消息，不要未经重新限制就运行。
- 不使用 UIA/MSAA/可访问性探测：历史上触发过崩溃。不默认录屏、PrintWindow、全窗截图；采集本身改变时序、可能涉及邮件。当前采用程序静态分析和一次性有边界的数值读取。

便携入口：

```powershell
.\Invoke-FoxmailPortable.ps1 -Action Resolve -InstanceId version587-20261105
.\Invoke-FoxmailPortable.ps1 -Action Tool -Tool git -InstanceId version587-20261105
.\Invoke-FoxmailPipeline.ps1 -Script 'D:\Workspace\Foxmail\version587\SCRIPT.cjs' -Tool node -InstanceId version587-20261105
.\Invoke-FoxmailPipeline.ps1 -Script 'D:\Workspace\Foxmail\version587\SCRIPT.py' -Tool python -InstanceId version587-20261105 ARG
```

固定 Node/Python/pwsh/Git/Zig 0.13 来自共享 `_开发环境`，不能退回全局编译器或另装工具。Pipeline 使用 canonical Prepare 锁/lease 并设置实例 TEMP/cache。**同实例 Pipeline 不要并行运行**，会明确报 preparation busy；不要删锁。无关只读 shell 可批量执行。

本环境 exec 默认沙箱启动曾有问题；成功命令一般用 `sandbox_permissions=require_escalated`，由自动审核判断。源码用 apply_patch。Windows 移动/删除要先核绝对路径，用原生 PowerShell LiteralPath，不跨 shell 拼接。

Git 只明确暂存本轮自有文件。使用便携 Git，作者 `Contributor <>`：`git -c user.name=Contributor -c 'user.email=' commit ...`。不 push/reset/clean/amend。

## 3. 交接时实际状态（已重新校验）

安装的深色 EXE：

`ce79d169ad6f908a4607ccc160efb17ce21b6afbcb9b8d1018c17331fff06c4a`

`FoxmailRevealGate.dll`：

`29efc7d9ec5b402f6a00a165a586f0762ec51aa2495cdcdc8e0a5fb31bc05515`

`7.2.25.587/Template/HtmlEditor/Common/Base.css`：

`8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8`

这是“已修首次托盘”的功能基线 + 提醒窗 27 字节改色，**没有**写信双缓冲、失败纸面 CSS 或 CreatePenIndirect 新挂钩。上次数值核对主窗和隐藏写信窗均 DPI120。PID4384 曾运行；交接最后查询未检测到该路径的进程，**不能据此认定又崩溃**，用户可能退出了。新会话必须重查 PID，不要信旧 PID。

用户明确确认过回退后“打开写邮件→关闭写邮件”正常。提醒窗改色后未取得新一轮视觉反馈。

最近源码提交：

- `8665a56`：587 原生移植。
- `b66135e`：后撤销的边框/编辑器首帧改动。
- `b431ae8`：清晰度回退、保留选色、正常显示启动。
- `81a375a`：首次托盘修复、缓冲/纸面/描边试验与数字探针。
- `03ededd`：封存用户指定 2.0，禁用严重回归版，提醒窗改色。
- 此交接文档及最后一批账号局部绘制研究另作本地提交，见 git log。

以下早已存在的未提交改动**不属于本轮交接整理，不要覆盖或提交**：

```
 M secondary-windows/compose-native-gate/foxmail_reveal_gate.c
?? secondary-windows/compose-surface-candidate/
?? secondary-windows/start-compose-window-trace.ps1
?? secondary-windows/trace-compose-windows.py
```

## 4. 版本谱系及结果

全部 hash 为 SHA256；以下名称对应缓存组，不把候选误作发布。

| 阶段 | EXE | 结果 |
|---|---|---|
| 587 同步 gate 初版 | `aba62e036d6ba41d46eaf63e3036488143a707458ff20cbefebb567816e3b78d` | 移植原生颜色/擦底/显示 gate，仍有闪烁 |
| 后撤销 next | `b44c42033478e7f3b3ee22bd168a8a0f18a96fcf9d35ffc111b142fa95277ce4` | 新 DrawEdge 启动创建画刷 + root LINK；DPI96、字体模糊，白闪/竖线仍有。不要重装 |
| 清晰选色基线 | `7fca5528dd9d54956d929dc733ba60b049c0db6ded16f226f0a3821376d4a65e` | 从 aba 仅改4个颜色立即数，实际12字节；用户确认清晰 |
| 首次托盘修复 | `9f98ef8b5753bf5ec7f694f06705fa5c20a7ac7493a5e691abe422eead4ab9e4` | 仅导出名字4字节 FxGateRun→FxColdRun，helper29ef；用户确认首次恢复不闪、字体清晰 |
| 用户指定 2.0 | `079cb41212c8f3546861526074e3c1f162f7f14683e41c48ca8a9d3ab63078cd` | helper `bf008ee50252930dc702c129f5e746b566d078c0ce0874bd0ce360746dd0fd48`；写信生命周期 WS_EX_COMPOSITED。用户：无可见白闪，但黑闪、按钮抖动；滚动流畅；黑字难读。按后来指令封存 |
| 严重失败纸面+pen | `b5632f19dd719d6420fdefcdad3f7e77f383815761666616e38656d1720fc492` | helper29ef；浅纸面/CEF初色+全局窄 pen 挂钩同时改。用户：编辑区全白、无法关闭写信或退出。已回退，安装脚本禁止正向安装。不可断言是哪一项导致 |
| 当前提醒窗 | `ce79d169ad6f908a4607ccc160efb17ce21b6afbcb9b8d1018c17331fff06c4a` | 在9f98上仅提醒颜色27字节，helper/CSS不变；待实际提醒确认 |
| **未安装**账号局部 Paint | `32871c95739b4bbfd05f6f09a875e4957a5cf00e7d79010e9b49064bb84140bb` | 在ce79上改TFMGroupBox一个虚拟入口4字节；只有字节/静态校验，视觉、运行响应均未验 |

前两个 587 基线 helper为 `c1821caffcdccc4f52e67f397208de70bb38728c16b447ad3bf159bcff936082`。

2.0：`D:\Workspace\_发布\foxmail\2.0`，39个文件、22,545,124字节，EXE079c/helperbf00 + 37静态资源，有 manifest、说明、恢复2.0.ps1。`-VerifyOnly` 校验通过。不含失败 b563，不含用户数据，不是完整Foxmail。保存2.0是用户要求，**不代表黑闪/抖动/黑字/竖线都解决**。当前运行版本与封存2.0不同，这一点已向用户明确说明。

## 5. 长期试验经验（563 到 587）

- 界面由原生 VCL/GDI/贴图与内嵌 Chromium/CEF HTML 混合组成，不能用一个全局颜色替换解决所有表面。主界面、原生窗口擦底、HTML首帧、打印纸面分别处理。
- 初期修改有0xc0000022启动失败、滚动崩溃、字体悬停变小、设置分类失效。原版对照能恢复；后来修复候选用户确认设置/字号/退出正常。不要回退到这些更旧实验。
- 在原版7.2.25.563上逐步处理侧栏/工具栏、邮件列表白条/分割线、右栏/滚动条、菜单外框、设置按钮。资源修改显著改善流畅度；反复全窗重绘/全局钩子会慢。
- 全局/整窗 WS_EX_COMPOSITED 让左栏持续闪；短暂设置再撤销造成“正常→无字→正常”。分层/显示缓存方案让字体像分辨率不匹配。最新写信局部生命周期 COMPOSITED 仍有黑闪/按钮抖动；2.0保留这个已知缺点，后续不要再把它当新解决方案。
- 曾使用 Hidden 启动GUI，首次点写信只黑线/不弹窗；同一 EXE 改 Normal 启动用户确认首次正常。启动要双击两次的现象后来并不稳定，观察器一次成功，没有证据建立独立故障。
- Windows默认窗口动画对照没有解决闪烁；不要改系统动画/刷新率来掩盖。
- 180Hz更易察觉，60Hz弱一些。0.1–0.2s是主观估计，勿当精确测量。曾做到约1.51ms中位数采样、P99约1.95ms，仍不能将加载完成当成已呈现。
- 录像/高频全窗采集改变速度；裁剪过窄漏掉主界面；有一次83帧保存队列停滞；202张里才抓到白闪，更多实际是黑闪。不要默认再次录屏或做重采样。
- CEF `background_color` 是文档前/默认背景，不保证第一帧已提交；`LoadEnd`、Chrome HWND存在也不是已呈现的证明。同步Show回调+RedrawWindow之后仍有异步CEF绘制。
- 当前C helper同步 RedrawWindow flags0x181（含UPDATENOW）。其源码明确说明原回调或同步重绘挂住时 finally 无法及时执行。将来若尝试异步首帧保护，须防止UI线程阻塞、无期限隐窗、生命周期/句柄重用和模块卸载；本次**尚未实现异步方案**。
- 不要反复加48/120/200ms阻塞Sleep。既往48ms试验在升级前未获验收，587初版明确未移植等待。
- 屏幕上对编辑文字直接提亮会进入实际保存的签名/发信HTML。外部CSS也要走实际导出函数测试，不能只看DOM。曾发现首个STYLE会导出；避免将UI样式插到可编辑内容/首STYLE。
- 打印预览曾0.5s全白再深色内容，默认带背景会打印深纸。已在563修打印屏幕/纸面分离，用户确认打印好了，587保留相关资源；打印颜色不能受通用GDI屏幕变色影响。
- 563 内部地址不能套587；所有native位置经固定软件输入指令/RTTI映射。563运行目录在升级后删除，不再启动563 EXE。

## 6. 当前局部研究：账号竖线

用户图中竖线像素读到精确 `#DCDCDC`，非泛称阴影。但来源未最终证明。

静态/数值证据：

- 账号DFM `TACCOUNTOPTIONFRAME` 119组件，`grpLine:TFMGroupBox` 左190宽416高421；其下 `TNotebook` 左0宽416高403，多个 `TPage` 全宽覆盖；没有独立TBevel/TShape。DFM报告 `version587-goal/account-resource-paint.json`。
- TFMGroupBox VMT `0xB6A5E8`，size536；普通 `WM_PAINT=0xB6ABC0` 调 PaintControls `0x11311D4` 后自定义 `0xB6A808`。**不能跳过PaintControls，否则子标签消失。** ERASE=`B6AB78`，NC=`B6AB9C`，自定义画笔在 `B6A890` 当前字节 `B1 3D B2 3D B0 3D`，已经暗色。
- 组控件无WS_EX_CLIENTEDGE/WS_BORDER。旧数值读 bevelKind=0, edges=15, inner=2, outer=1, width=1, clientColor=clNone, headerColor=FEFAF9。
- `SKIN_OTHER_BORDER_PNG` 和外部 `7.2.25.587/Skin/Controls/Border.png` 已暗色，SHA `dd16157d271700bd887e1eb70f59aaeff4b4678f96259a031b2fe7513c892597`，141×22，主色32/61，部分alpha204。固定程序PNG缓存 `0x12E6B60` 实测也是深色，不能再宣称漏改/缓存旧皮肤。此前重新染图假设已被否定。
- TFMGroupBox 另一个虚拟Paint入口（VMT+C8）仍指向 `TTntGroupBox.Paint=0x87AEBC`，可选系统主题画法；正常WMPAINT使用自定义路径。**“缓存/父背景画法绕过深色而留下系统边缘”只是当前假设，未做运行时调用证明。** 官方PaintTo/WM_PRINTCLIENT资料支持存在不同绘制路径，不能证明本例：
  https://docwiki.embarcadero.com/Libraries/Sydney/en/Vcl.Controls.TWinControl.PaintTo
  https://learn.microsoft.com/en-us/windows/desktop/gdi/wm-printclient
- `TNotebook` VMT66AB6C size556，transparent字段228；`TPage` VMT66A950 size532，transparent字段210。其父背景路径 `1127930` 请求父控件WM_ERASEBKGND。SetTransparent(66E648)唯一静态直调D9B0C2，目前未证明属于账号页，不要盲改。

**最后准备的候选，未安装：** `version587/account-local-paint.cjs`，缓存 `version587-account-paint/validation.json`。只将 `TFMGroupBox.VMT+C8` 从87AEBC改为现有空实现 `TCustomControl.Paint=11365B0`，4字节；所有其他字节、自定义WMPaint/Erase/NC、字体/DPI/初始化/helper均不变。意图抑制重复系统主题边框，不影响普通自定义深色/子控件绘制。只有静态证据；没有安装脚本，没有运行/视觉验收。可考虑更充分验证后一次单项安装对照，不要称已修好。

**用户待答的问题**：已请求“打开设置→账号并保持打开，只读透明标志，不改程序”。`account-paintflags.py` 已在ce79固定hash上运行成功，两次count=0（当时账号窗口没创建）；不应重复空跑。读取限≤128字节，固定VMT/类/size/atom/HWND匹配、进程stamp前后核对，只输出绘制标志、颜色、类和几何，不读文本。待用户在新会话回应打开后，重查PID再运行。承诺这次只读，先完成读取再谈安装。

## 7. 提醒窗与新报错

提醒窗：`TNEWMAILNOTIFIER` / TNewMailNotifier，FormPaint `EF63C0`。发现固定正常/高亮渐变：`EF6482/6487/64AE/64B3`，以及缓存底色混色`EF5BA1/5BA6/5BC1/5BC6`；另改DFM根Color。`notification-dark.cjs` 所有9处27字节白名单审计，其他字节/事件/尺寸/流程全不变；`install-notification.ps1` 可Preflight/Rollback，当前已装。无需发送测试邮件，等下次实际提醒或用纯合成通知fixture；不要读真实提醒文字。

滚动报错：在b563已撤回的9f98基线上发生，**早于**ce79提醒窗改色。用户关闭了错误报告。系统最近Application事件仅13:14 AppHangB1/1002 PID6988，属失败纸面候选；没有本次滚动的异常码、模块、dump。标准CrashDumps没有Foxmail文件（有别的项目文件，未读内容）；几个明确BugReport路径与本实例缓存未找到报告。不应继续漫无边界搜用户盘。下次用户再现请保留TxBugReport窗口以获取具体数值。待答问题还包括“再次报错窗口已保留/未复现/稍后测试”。

`crash-path-literals.py` 只读原版EXE、7.2.25.587/TxBugReport.exe和FoxBugReport.dll的静态诊断路径字串。发现MidDump.dmp/FullDump.dmp但未找到文件。FoxSetBugReportPath设置的是TxBugReport.exe路径，不是报告落盘目录，勿误解。未创建常驻调试器、未改注册表、未发送报告。

## 8. 构建/回退/验证索引

- `version587/dpi-readonly.py PID`：只读路径/窗口DPI/visible/iconic/cloaked/尺寸。GetWindowRect在此Python中是DPI虚拟化尺寸，**不能据此把120误判96**。
- `goal-controls.py`、`goal-canvas-readonly.py` 还固定旧7fca hash。若需用于当前版，明确校验允许的新hash；不要去掉守卫。新 `account-paintflags.py` 固定ce79且已适配587 VMT。
- `inspect-painters.py`：静态原版f208 only，支持dis/methods/dispatch/slot/calls-to/refs-string/colors/literal等；只打印必要范围。`dispatch`取动态表VMT-48，`methods`用VMT-52，不要用错-64。
- `goal-map-canvas.py`：固定563→587代码/RTTI映射，生成canvas-map。editor VMT B94A54 size976，base B83AC4 size880，Chromium B76E44 size1948，options B4F8C8 size64，CEFparent B6716C size548。atom RVAs EFA1B6/EFA1B4/EF6B80/EF6B7E。
- `goal-prepare-cold.cjs`：从现有C生成隔离cache副本，旧导出策略不变，新增FxColdRun。cache `version587-goal-cold-source`；build-native-v2支持SourceDirectory/OutputGroup，固定Zig x86原生SEH。原C未覆盖。
- `goal-firstrestore.cjs`：7fca→9f98，EXE只4字节导出名，cache `version587-goal`；helper在 `version587-goal-native`。原机制1122检查，生产171检查，桥接24用例通过，视觉用户接受。
- `goal-prepare-buffer.cjs` / `goal-buffer.cjs`：生成已封存2.0的buffer试验，cache `version587-goal-buffer-native`；生产224检查通过但用户仍黑闪/抖动，不能用测试绿灯冒充解决。
- `goal-install-firstrestore.ps1`：FirstRestore/Buffer事务安装与回退，有Preflight；注意当前ce79不是这些脚本直接预期hash，先走提醒窗Rollback或明确构建下一安装计划，别篡改守卫强装。
- `goal-install-paper.ps1` 正向已禁止，只有Rollback可用；当前不是b563，不能再盲回退一次。
- `restart-visible.ps1 -ExpectedSha HASH [-StopOnly]`：校验确切EXE，拒绝终止工厂原版，等待旧进程最多5s，Normal启动。即使返回新PID也要确认仍活着、有主窗，再报告成功。
- native测试器在 `...version587-native/verify-editor-canvas-587.exe`：15对执行/1040断言；`verify-initial-erase-587.exe`1509检查；reveal actual bridge在version587-reveal。`adapt-fixture.ps1`只改编译fixture明确CIL地址常量或等长字符串，不用系统csc。
- 旧通用verify-hooks在 `...cleanup-01a1aba4/temp/legacy-root/verify-hooks.exe`；core覆盖有62k+DeleteObject检查，窄pen只有单个正向例。**fixture隔离不跑Foxmail，不证明真实CEF、DPI、响应或滚动稳定**。
- 合成actual-export检查 `goal-verify-paper.cjs` 12用例，只证明给定HTML/text/resource导出一致；已失败纸面仍过它，说明严重不足。不要反复重跑这套而忽略真实响应。

## 9. 接手建议

先读实际状态/未提交改动和本文，不重启/改装当前副本来“开始工作”。核对是否有新用户反馈、进程、错误窗口，再做一次最小读数。保持2.0不可变。优先稳定性和未解决目标，不把浅纸面试验、黑闪换白闪或大量测试数字当完成。

下一步账号竖线可从已准备4字节候选入手，但先完成承诺的只读检查，审查其他设置分组框绘制影响；可回退到当前ce79。写信闪烁需重新审视CEF首帧与同步Show保护之间的时序，避免全局样式、模糊字体、长阻塞和僵死隐窗。输入黑字的配色问题和崩溃都必须明确记录为未解决。无法获得的新异常信息如实说明，不凭旧错误日志归因。

本次交接不等于目标完成。原会话goal工具最后返回null（与此前自动goal消息存在差异），新会话按用户原目标继续追踪，勿声称已完成全部目标。
