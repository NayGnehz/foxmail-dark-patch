# 选人窗口列表首次擦底

用户确认搜索、标签边线和选人边框均正常，白闪仍在，随后要求修复已定位的首次填充遗漏。
基线为 `ff1e6f70`，本轮候选为
`daa704320ecb6acbba31df79be7e3b297284c103ee2877e23be51e7d6cd24305`。

## 实现

现有 `TBaseVirtualTree.WM_ERASEBKGND` 前置填充仅匹配 `TVirtualDrawTree`。
保留原匹配成功路径，只把未匹配分支的跳转改向新增的 96 字节判断。
判断要求同时满足以下条件：

- 精确的 `TVirtualStringTree` 类型。
- 组件 Owner 非空，且为精确的 `TDlg_SelAddr`。
- 对象地址等于该窗口 `vtMembers`、`vtTo`、`vtCc`、`vtBcc` 四个字段之一。

匹配后进入已有深色填充代码，随后执行完整原擦底处理。
不匹配时仍回到原处理。窗口字段由实际 RTTI 绑定，Owner 的 `+4` 偏移由原 `TComponent.Insert` 写入代码核对。
新增判断没有 API 调用，沿用现有 HDC 类型、位深、ROP、布局、映射模式及裁剪限制。
不增加 DLL、导入、延时、全窗缓冲或显示门。

原文件实际改变 6 个字节，其中包括跳转操作数及必要 PE 大小字段。
追加 512 字节，内含 96 字节判断和对齐空白。所有资源均保持原字节。
反向撤销这些范围并截去追加区，可精确恢复基线。

## 验证与部署

`verify-chooser-first-erase.c` 执行候选中的实际入口、既有填充代码及新增判断，
使用合成控件对象和真实 GDI 内存 DC/DIB，不打开真实窗口或邮件。
旧代码在同一合成场景中保留白色，新代码填入 `#202020`。

两个映射基址共 2,732 项通过，覆盖四个目标字段、未登记列表、其他 Owner、Owner 为空、
原绘制树及其他控件、裁剪与复杂区域、单色位图、ROP/映射/布局模式、空 HDC、
解析槽或画刷不可用、寄存器与栈、原消息结果、LastError 和 GDI 状态。
其中原处理的 ECX 返回 Self，测试保持其真实行为。

```powershell
.\Invoke-FoxmailPipeline.ps1 -Script version587\chooser-first-erase.cjs -Tool node -InstanceId version587-20261105
.\version587\check-chooser-first-erase.ps1
.\Invoke-FoxmailPipeline.ps1 -Script version587\port-kit\build.py -Tool python -InstanceId version587-20261105 -ScriptArguments @('--original','D:\Path\Foxmail.exe','--msaa-tray-guard','--contrast-followup','--search-chooser-followup','--chooser-first-erase')
.\version587\check-contrast-cmd.ps1 -KitGroup version587-dark-port-kit-chooser-first-erase
```

实际 CMD / Windows PowerShell 5.1 的安装还原、双击两次、v2 与两轮 v3 备份兼容、旧 ZIP 清单及试用配置隔离测试通过。
缓存记录为 `temp/version587-contrast-cmd-check-41ce8107/validation.json`。

Downloads 目录已完成旧版恢复、新版安装/恢复及再次安装，41 个原文件的字节、创建时间及修改时间核对通过。
实际记录为 `temp/version587-chooser-first-erase-downloads-7fd56a9e/validation.json`。
最终保留新版，真实白闪效果等待用户反馈。

单文件 CMD 为 602,057 字节，比上一版增加 242 字节。
SHA256 为 `240b8c1e4b22dbf0d480111ef7842932b84e728c86133a737c7f207cea8571f5`。
默认配置与 41 文件 v3 备份格式保持兼容，仍使用同目录 `Foxmail.exe`。
