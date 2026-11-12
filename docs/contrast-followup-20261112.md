# 截图中的四处对比度问题

2026-11-12 用户将新问题截图放在 Desktop/Foxmail，并补充地址簿搜索框黑字。
仅查看用户指定的图片，没有复制图片或记录联系人、邮件及附件内容。
实际验收目录仍为 `D:\Users\Public\Downloads\Foxmail`，用户说明已恢复原版。

## 修改范围

- 原默认 `5.0-msaa` 从封存 5.0 构建，因此没有合入此前试用配置中的收件人字色与顶部阴影修复。
  新配置 `5.0-msaa-contrast` 在原 MSAA 防护 EXE 上复用这两处已有补丁。
  五个收件人调用点的新位置经过实际指令夹具验证，两个基址共 1,280 项通过。
- `TDlg_SelAddr.Panel_SearchCustomPaint` 和 `pnlToTopCustomPaint` 保留原绘制函数，只替换五个颜色操作数。
  右侧四个标题控件共享后一回调，改为既有深色标题渐变。
- 地址簿 `TAddressAppFrame` 的 `edtSearch` 实际为 `TFMZRichEdit`。
  精确 DFM 路径的 `Font.Color` 从 `clWindowText` 改为显式 `#E6E6E6`。
  DFM 原类型长度改变，资源内重排后缩小 9 字节并更新资源大小，资源 RVA、其他属性及代码路径不变。
- 附件选中背景的 1x/2x 内置 PNG 及外置 `PngImages/attach_select.png` 改为现有邮件的深蓝色系。
  保留尺寸与逐像素 alpha。RGBA 编码往返一致，浅灰文字在所有不透明背景像素的最低对比度约 4.99:1。
  原图只含背景渐变，没有附件图标及文字。

生成入口 `version587/contrast-followup.cjs` 绑定原 MSAA EXE、收件人夹具与源码。
逐层核对 MSAA 的两个跳转点、原追加防护代码及新收件人包装代码未被后续修改覆盖。
候选 EXE 为 `77fcfb3a2f4552463ac89534040fce36408643a536a706e2e3cad9a47d33ba19`，
helper 沿用 `0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70`。

## CMD 与恢复

新配置共享基础 EXE 差分和相同 helper，仅附加本配置的增量。
附件外置背景是新增的第 40 项资源，连同 EXE 共移动备份 41 个原文件。
其他配置继续使用原 39 项资源。ZIP/PS 入口可显式使用 `-Profile 5.0-msaa-contrast`。

这套 41 文件备份使用 `FoxmailDarkBackup/3` 标识，时间记录和同卷移动仍沿用原机制。
新 CMD 识别旧 v1/v2 备份。旧 CMD 不认识 v3，因此在改动前拒绝，避免遗漏新增文件后误报恢复。
文件的创建时间、最后修改时间仍恢复，目录时间不写入。

`check-contrast-cmd.ps1` 在登记缓存的纯软件副本中调用真实 CMD 与系统 Windows PowerShell 5.1，
覆盖新配置安装/恢复、旧 v2 安装由新 CMD 恢复、原试用配置不继承新增 PNG、无参数双击两次，
以及旧 CMD 在新备份前拒绝且不改变候选 EXE。新版 ZIP 入口使用旧无附加资源清单的生成也通过系统 PowerShell 5.1。恢复核对全部 41 个原软件文件的字节和文件时间。

实际 Downloads 目录的安装、恢复及再次安装已完成。41 文件还原及备份清理核对通过，
记录在登记缓存 `temp/version587-contrast-downloads-551df505/validation.json`。
最终保留修复候选，交互视觉验收等待用户反馈。

用户随后确认本轮四处效果均正常。下一轮邮件搜索与选人窗口问题见
[搜索与选人后续修复](search-chooser-followup-20261112.md)。

## 构建

```powershell
.\Invoke-FoxmailPipeline.ps1 -Script version587\compose-recipient-contrast.cjs -Tool node -InstanceId version587-20261105 -ScriptArguments @('--msaa-tray-guard')
.\version587\check-compose-recipient-contrast.ps1 -OutputGroup version587-compose-recipient-msaa
.\Invoke-FoxmailPipeline.ps1 -Script version587\contrast-followup.cjs -Tool node -InstanceId version587-20261105
.\Invoke-FoxmailPipeline.ps1 -Script version587\port-kit\build.py -Tool python -InstanceId version587-20261105 -ScriptArguments @('--original','D:\Path\Foxmail.exe','--msaa-tray-guard','--contrast-followup')
.\version587\check-contrast-cmd.ps1
```

生成物在 `temp/version587-dark-port-kit-contrast`，没有改写封存 5.0。
最终 CMD 测试记录在 `temp/version587-contrast-cmd-check-acf44661/validation.json`，
CMD SHA256 为 dcc5746c7d9dd40f3de1c00c165d3f75a00e1825e11b1b5b0e3b0d265ef88873。
已将同一文件放入 Downloads 验收目录，最终入口记录在实际验收目录对应缓存的 final-cmd.json。
