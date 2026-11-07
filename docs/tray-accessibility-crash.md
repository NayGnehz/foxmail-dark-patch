# 托盘唤醒的邮件列表辅助功能崩溃

2026-11-07 23:42:37，深色 5.0 从托盘恢复时在 `0x00966374` 触发 `0xC0000005`。报告
`00000000-0000-0000-0000-000000000000` 记录的读取地址为 `0x8AD0EBFF`，与
[此前的未读邮件滚动崩溃](unread-scroll-fault-20261106.md) 相同。已核对调用链为
`UIAutomationCore.dll → oleacc.dll → TVirtualTreeItemAccessibility.get_accName`。

这段函数在官方 587 和封存 5.0 中逐字节相同。`get_accName` 取出辅助功能对象保存的节点指针，
循环读取节点索引或沿父链继续。崩溃报告保存了故障指令和调用地址，缺少出错对象的内存范围。
初始节点与父链来源尚无法区分，UI Automation 请求的发起进程也未知。之前的电脑操作只能作为复现线索。

## 候选

`version587/msaa-tray-guard` 在封存的 5.0 EXE 上生成两处跳转。索引和父链指针各按需使用
当前进程句柄执行一次四字节 `ReadProcessMemory`。低于阈值时直接使用已读索引，跳过原来的重复读取。
不可读或 API 不可用时走原有的 `S_FALSE` 和 Delphi 清理出口。正常路径保留所需寄存器、算术标志和
LastError。候选沿用封存的 helper DLL。现有失效节点的产生时机仍待定位。

成品 SHA256 为 `eee4f4bd6d0241aad5e86bfaf121fd2b4a4a1a32c45d04d9584f798f699f82be`。
对成品二进制静态核对，原文件有 23 字节差异，限于两处跳转和 PE 大小字段，末尾附加 512 字节。
入口、原导入表及其他文件保持原封存值。

## 验收

实际发出的指令在两个独立映射地址通过 6,656 个 x86 用例。包括正常索引、阈值、父链、
不可读和跨页、保留 PAGE_GUARD、地址回绕、API 解析失败及寄存器、栈、EFLAGS、LastError 检查。
测试跳到合成的续行和清理桩。真实 Delphi 清理和 Foxmail 托盘界面留待隔离运行验收。

Windows PowerShell 5.1 上，已测试旧 CMD 安装后由新 CMD 恢复，以及新 CMD 安装后由旧 CMD 恢复。
目录清单、原件内容、NTFS 文件 ID、创建时间和最后修改时间一致。新 CMD 的 `trial` 仍选择原有试用版。

从项目根使用登记构建入口。

```powershell
$instance = 'version587-20261105'
$zig = & .\Invoke-FoxmailPortable.ps1 -Action Tool -Tool zig -InstanceId $instance
.\Invoke-FoxmailPipeline.ps1 -Script version587\msaa-tray-guard\build.py -Tool python -InstanceId $instance -ScriptArguments @('--zig', $zig)
.\version587\msaa-tray-guard\verify.ps1 -InstanceId $instance
.\Invoke-FoxmailPipeline.ps1 -Script version587\port-kit\build.py -Tool python -InstanceId $instance -ScriptArguments @('--original', $originalExe, '--msaa-tray-guard')
```

`$originalExe` 指向官方 7.2.25.587 的 `Foxmail.exe`。构建读取通过的指令测试结果。
候选包位于登记缓存的 `temp/version587-dark-port-kit-msaa`。旧 CMD 和封存 5.0 独立保留。
