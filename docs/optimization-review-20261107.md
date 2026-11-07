# Foxmail 5.0 采用链与优化验证

发布基线为源码提交 `85e4db9` 和 `D:\Dev\_releases\foxmail\5.0`。封存和 Downloads 深色副本各核对了清单中的 41 项软件文件，共 22,608,309 字节，全部匹配长度和 SHA256。清单为 `d03209a8…`，配套原版 EXE 为 `f208b5c2…`。下文的 EXE 哈希用前缀表示。

## 发布清单反查

| 发布内容 | 生成和证据入口 | 安装、回退及守卫 |
| --- | --- | --- |
| 深色 EXE `24665d04` | `merge-ui-refinement.cjs` 从 `3a3f9c38` 合并 `search-alignment.cjs` 的单字节 Top 3→4 与 `check-address-followup.cjs` 验证的六个颜色操作数、两张 A–Z 图集。各分支为 `9be98b95` 和 `df263ea1`。 | `install-ui-refinement.ps1` 校验原版、配套 DLL/模板、输入输出和差异证明。正向安装还绑定源码。局部回退恢复 `3a3f9c38`。 |
| EXE 中的搜索、联系人、设置 | `233e7bdf` 经 `search-style.cjs` 及像素检查、`patch-address-native.cjs` 和 `ui-followups.cjs` 合并为 `3a3f9c38`。此前 `account-edge-calls.cjs`、`account-right-inset.cjs`、`group-border-rgba.cjs` 依次由 `62faa3d8` 生成 `1c386396 → 540cf174 → 233e7bdf`。 | 各 `install-*.ps1` 对应其前像和后像，支持预检和阶段回退。保留调用点及栈清理、DFM 控件路径及旧值、PE 资源容量及 PNG 状态/像素守卫。 |
| EXE 中的基础移植、选中、托盘、提醒与首次边框 | `prepare-native.cjs` 复用 `build.cjs` 与 `native-colors.cjs`，后接 `borders.cjs`、`reveal.cjs`、`selection-only.cjs`。缓存中的采用祖先为 `7cc9b4dd → 77f1e6b1 → aba62e03 → 7fca5528`。`goal-firstrestore.cjs` 切到 `FxColdRun` 后为 `9f98ef8b`，随后 `notification-dark.cjs`、`main-ncactivate.cjs`、`compose-ncactivate.cjs` 得 `ce79d169 → f8f4732d → 4ca3440e`。 | 对应 `install-native`、`install-reveal`、`install-selection-only`、`goal-install-firstrestore`、`install-notification` 和两个 `install-*-ncactivate` 入口。原版哈希、587 版地址/旧指令、窗口类型、ABI 和阶段哈希分别核验。首次托盘恢复、主窗边框及 DPI 有既有验收，提醒窗来信效果缺独立验收。 |
| 辅助 DLL `0e471e40` 与 EXE 的 LoadEnd 桥 | `compose-ready-source.cjs` 对已采用同步 cold helper 做五个可反向恢复的替换并引入 `compose-ready-async.h`。`compose-ready-bridge.cjs` 从 `4ca3440e` 生成 `62faa3d8`，主 frame 原处理完成后按 owner 通知；`compose-ready-package.cjs` 绑定源、实际桥接机器码和 DLL 测试。 | `install-compose-ready.ps1` 按 EXE/DLL 成对切换，可回到 `4ca3440e / 29efc7d9`。5.0 使用已封存的 `0e471e40`。现有历史 compose-ready 报告仍含迁移前路径，重新制包需在当前登记根重新生成报告。 |
| 34 张外置 PNG、`Base.css`、`mail_frame.html`、`compose_body.html` | 28 张 Skin、6 张 PngImages。37 项均可在 `version587` 或 `version587-native` 的 `assets` 按清单哈希匹配。`build.cjs` 用具名清单核上游软件前像，复用外置皮肤、嵌入图集、编辑器滚动条 CSS、固定阅读/打印隔离模板和深色写信初始 body。 | 初次移植安装用静态资产前像守卫。2.0 封存 37 项，3.0、4.0、5.0 继承。外置 `Skin/Controls/Border.png` 与 EXE 内设置底边 `SKIN_OTHER_BORDER_PNG` 走不同加载路径。 |
| 写信 `HtmlEditor.html` 和联系人 `Frame.html` | `compose-screen-colors.cjs` 输出 `c3a898dc`，内联 screen CSS、前景映射和多色 Custom Highlight/caret JS。 `address-book-html.cjs` 输出 `405bf5f9`，内联一份 screen CSS。两项都核对原模板哈希、唯一注入点、原样式与脚本边界。 | `install-compose-screen-colors.ps1` 回退到 `dd712386`，并核对 CEF 版本；`install-ui-followups.ps1` 将 Frame 和对应 EXE 成对更新，阶段回退恢复 Frame `ebcef379`。正式恢复以 5.0 清单为准。 |

2.0 的整窗缓冲、浅色纸面和全局画笔钩子、`edges-next/finish-next` 的 DrawEdge 和 shell 组合、`compose-presize`、账号计数和底边探针、统一浅灰 `compose-screen-ink` 都属于历史实验或已撤回路线。选中配色从 `selection-only` 独立保留。 `compose-surface-candidate`、trace 入口及 MSAA safe-read 属于既有 WIP。5.0 的 EXE 与 DLL 链不依赖这些 WIP。

## 本轮改动与验证

- 设置底边、搜索图集和 A–Z 图集共用 RGBA6 编码。前两者保留 filter 0，A–Z 保留自适应过滤。基础移植仍由原入口选择较短的 indexed 或 RGBA 文件。白名单核验先用 Buffer 比较不可写区段，再逐字节统计白名单内的改动。覆盖相交及乱序范围、边界、越界写入和长度变化。用搜索阶段的 22,476,800 字节 EXE 和 10,650 个差异，固定 Node 预热后交替测 15 次，核验中位数由 151.67 ms 降至 1.73 ms。
- 隔离重放从旧报告中发现联系人候选还指向迁移前路径。`ui-followups.cjs` 现在从 lease 解析的具名缓存组读候选，并核对固定哈希、独立差异和重放结果。两个模板生成器使用已验证的缓存前像，避免当前已安装的后像阻止重建。修改过生成器的阶段回退依旧校验固定前像、后像及配套软件，正向继续校验源码。
- 写信准备期间若已加载的 CEF 宿主被原始 Show 替换，原代码在接管时更新 HWND，却保留旧宿主的就绪标志。新增合成用例在原实现上得到 1 处断言失败。接管检测到宿主变化时清除就绪，由对应宿主 LoadEnd 或原有超时退出路径处理。桥接、导出 ABI、owner 检查和原恢复引擎沿用现有实现。修复后 seam fixture 435 项和实际 x86 DLL 352 项通过，固定桥接产物的 ABI fixture 4,352 项通过。测试 DLL SHA256 为 `1a42c70987f206fb09bd69cfbe88cf836ca318bf614dd0dfeea12a86dd3c4041`，位于登记缓存的 `version587-compose-ready-check-host-ownership`。
- 5.0 恢复脚本 `-VerifyOnly` 通过。使用带 `3a3f9c38` 深色 EXE 的隔离软件副本实际恢复，41 项恢复后哈希与清单匹配，备份中的 EXE 仍为 `3a3f9c38`。已装 5.0 最后一轮的 `-Rollback -Preflight` 通过。
- 六个 EXE 阶段和两个 HTML 模板逐字节匹配原产物，搜索 410 项像素检查通过。当前 Edge 对相同写信合成页面退出码为 0，但未返回 DOM 结果，换短 profile 亦如此。静态重放仍校验联系人既有浏览器证据的候选哈希与 verifier 源码哈希。写信导出、打印和联系人交互沿用与封存模板相同字节的历史测试证据。

```powershell
.\Invoke-FoxmailPipeline.ps1 -Script version587\verify-resource-replay.cjs -InstanceId version587-20261105
.\version587\check-compose-ready.ps1 -OutputGroup version587-compose-ready-check-host-ownership
.\version587\install-ui-refinement.ps1 -Rollback -Preflight
& 'D:\Dev\_releases\foxmail\5.0\恢复5.0.ps1' -TargetRoot 'D:\Users\Public\Downloads\Foxmail' -VerifyOnly
```

## 部署前的验收边界

本轮验证限于静态软件文件和自建 Win32 窗口。新的 DLL 仅有隔离测试证据，真实 Foxmail 的启动、首次托盘恢复、120 DPI、写信/回复/转发、Alt+A 和关闭仍以 5.0 既有验收为基线。滚动故障、偶发关闭崩溃、来信提醒以及原生剪贴板/拖放仍缺本轮实测。编辑器每批 DOM 变化会重扫文本和重算高亮，暂时缺少长信场景的目标 CEF 测量。各 x86 桥仍独立校验地址、指令及调用约定。

## Downloads 部署复核

再次核对两个 DLL 的 PE32/x86、19 个导出名与序号、导入依赖、统计结构 `(72, 1)` 和候选的源码及夹具绑定。部署入口 `install-compose-host-ownership.ps1` 在登记 lease 内校验 5.0 清单、原版 EXE、当前 41 个具名文件和候选证据。只替换已校验 Downloads 深色副本的 `FoxmailRevealGate.dll`，以排它句柄核对前像和写入后的哈希，随后用 Normal 重开。候选仍单独标识，封存 5.0 可恢复。

实装进程首次采样为 PID 30072。映射的模块路径与候选目标一致，深色 EXE 仍为 `24665d04`，辅助 DLL 为 `1a42c709`。主窗可见，DPI 120，DWM cloak 为 0。启动时异步写信计数均为 0。候选状态下的单 DLL 回退预检与封存包 `-VerifyOnly` 均通过。

用户手动完成托盘和空白写信验收并反馈“都正常”。同一 PID 复核得到 6 次接管、6 次 LoadEnd 通知、6 次就绪解幕，活动、超时及失败均为 0。用户同时指出两项原有问题，收件人和抄送文字偏黑，以及写信主窗出现前的短黑线。只读计数样本位于登记缓存 `version587-compose-ready-check-host-ownership/ready-state-*.json`。

```powershell
.\version587\install-compose-host-ownership.ps1 -Preflight
.\version587\install-compose-host-ownership.ps1 -Rollback -Preflight
.\version587\install-compose-host-ownership.ps1 -Rollback
```

## 写信收件人字色与短黑线

- 写信 DFM 中 To、Cc 和 Bcc 走 `TFMZRichEdit`，主题走 `TFMEdit`。三个 RichEdit 的序列化字色会被原生字体应用方法覆盖。五个写信专属调用点保留原字体设置，然后在 `DefAttributes` 上设置 `#E6E6E6`。setter 只用 `CFM_COLOR / SCF_DEFAULT`，已解析收件人的标签可能有独立的绘制路径，须在真实窗口分开验收。
- 用户两张对照图在按钮栏下沿都出现同一组 `#191919/#1B1B1B/#1E1E1E` 像素。真实数值跟踪中，独立无 owner 的 `FMCtrlShadowWnd` 矩形为 `[189,633,1177,637]`，宽度与图中横线一致，紧贴顶部 dock 底沿。它可见约 208 ms 后，主写信窗才首次采到解除 cloak。修复仅去掉 `TFoxComposeForm.FormCreate` 对本窗顶部 dock 的装饰阴影注册。Resize 和 Destroy 已有未注册跳过分支。两处修改在封存 EXE 上分别生成，再验证合成输出为两处差异的并集。
- 五处字色调用实际发射的 x86 指令在两个基址通过 1,280 项 ABI 检查，覆盖默认属性缺失、寄存器、标志、栈与 LastError。字色及阴影补丁各自反向恢复与输入完全一致。
- 合成 EXE `1cc82aae` 已装到 Downloads 并用 Normal 启动，初次 PID 22996，主窗 DPI 120、可见、cloak=0，实际加载 `1a42c709` helper。40 个配套软件文件在安装前及回退预检中均通过哈希核对。交互视觉结果单独记录。
- 部署后同一进程已累计 5 次写信就绪解幕，活动、超时、设置失败和回调异常均为 0。之后的 60 秒数值跟踪未覆盖新的写信开启，因此这 5 次支持显示门健康复核，字色与黑线仍待视觉确认。

```powershell
.\Invoke-FoxmailPipeline.ps1 -Script version587\compose-recipient-contrast.cjs -InstanceId version587-20261105
.\version587\check-compose-recipient-contrast.ps1
.\Invoke-FoxmailPipeline.ps1 -Script version587\compose-polish.cjs -InstanceId version587-20261105
.\version587\install-compose-polish.ps1 -Rollback -Preflight
.\version587\install-compose-polish.ps1 -Rollback
```

上面的回退只恢复已验收 EXE `24665d04`，保留已验收 helper `1a42c709`。完整封存 5.0 的恢复入口见 [5.0 封存记录](../version587/archive-5.0.md)。
