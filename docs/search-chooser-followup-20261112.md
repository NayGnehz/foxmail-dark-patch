# 邮件搜索与选人窗口后续修复

2026-11-12 用户确认上一轮四处修复均正常，继续报告邮件搜索框黑字、建议窗白框、搜索条件白色括号，以及选人窗口右侧白闪和白框。
视觉依据为用户主动提供的四张截图。没有录制或读取真实邮件与联系人。

## 原因与修改

基线为已验收的 `77fcfb3a`。`search-chooser-followup.cjs` 输出
`ff1e6f70c7bb551242ce441b8008a1ff211dbbcfe812d3866e713d31d6d865a6`。

- 邮件与归档邮件搜索分别位于 `TMAILAPPFRAME` 和 `TMAILARCHIVEAPPFRAME`。
  两个 `TFMZRichEdit` 的 `Font.Color` 改为显式 `#E6E6E6`，沿用上一轮地址簿搜索修法。
- 建议窗是 `TPopListForm`。原窗体无边框，里面的 `TVirtualDrawTree` 未序列化 `BorderStyle`，因此保留系统默认边框。
  树改为 `bsNone`，根窗体用 `BorderWidth=1` 与 `#3D3D3D` 底色形成外沿，树显式设 `#202020`。
  已从真实类 RTTI 核对 `TForm.BorderWidth`、树的 `Color` 与 `BorderStyle` 均为可流式加载的属性。
- 白色括号实际是 `TSearchOleItem` 的圆角框。
  `D01B64` 中未选中画笔与画刷都使用 `F2DDC7`，已有通用映射让它呈浅色。
  两者分别改为 `#606060` 边线、`#202020` 背景。选中两处使用现有蓝色系。
- 选人窗口 `BE9DF4` 在创建中把 DFM 已修的背景和两侧边框重新赋成浅色。
  五个颜色参数改为深色背景、分隔线和标题底色。
  `VSTBeforeItemErase` 与 `vtToBeforeItemErase` 两个回调仍显式用白画刷填充，现改为 `#202020`。
  右侧四个 `TVirtualStringTree` 增加显式 `Color`，使空列表与初始化时也使用深色。

共四份 DFM、11 个 imm32 颜色参数。没有增加调用、窗口钩子、显示延时或 DLL。
四份 DFM 分别缩小 9、9、16、8 字节，保留原 RVA、分配空间和 EXE 长度。
个别 `DEFAULT_CHARSET` 改为等价的数值 1，为新增属性腾出空间。
生成器重新解析 DFM，逐项核对节点结构、所有未修改属性以及其他资源，并验证反向恢复精确匹配基线。
32,286 个文件字节差异主要来自 DFM 内序列化长度变化后的位置移动。
上一轮收件人、附件、地址簿搜索、工具栏阴影及 MSAA 防护的代码与资源均保留。

## 构建与测试

```powershell
.\Invoke-FoxmailPipeline.ps1 -Script version587\search-chooser-followup.cjs -Tool node -InstanceId version587-20261105
.\Invoke-FoxmailPipeline.ps1 -Script version587\port-kit\build.py -Tool python -InstanceId version587-20261105 -ScriptArguments @('--original','D:\Path\Foxmail.exe','--msaa-tray-guard','--contrast-followup','--search-chooser-followup')
.\version587\check-contrast-cmd.ps1 -KitGroup version587-dark-port-kit-search-chooser
```

新 CMD 仍使用 `5.0-msaa-contrast` 配置及原来 41 文件的 v3 备份。
不再增加配置副本或备份文件。helper 仍为 `0e471e40`。
CMD 为 601,815 字节，SHA256 为 `a123c05d6d32f8bfb0e10c39dca41f236687d9540612dc38dbbd1aa473ced4a9`。

缓存内真实 Windows PowerShell 5.1 / CMD 验证通过，记录在
`temp/version587-contrast-cmd-check-123a95d5/validation.json`。
覆盖新装/还原、双击两次、v2 旧备份、新 CMD 恢复上一轮 v3 备份、试用配置隔离、旧 ZIP 清单兼容，
以及 41 个原文件的创建时间、修改时间与字节还原。
实际 Downloads 目录已完成上一轮 v3 恢复、新候选安装/恢复及再次安装。
41 文件的字节、创建时间和修改时间核对通过，备份目录在恢复时清理完整。
记录在 `temp/version587-search-chooser-downloads-ea0519c3/validation.json`。
最终保留新版候选，视觉验收等待用户反馈。
