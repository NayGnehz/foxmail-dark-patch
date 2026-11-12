# 收取进度弹窗首次擦底

用户在选人窗口白闪验收通过后，报告“收取邮件”弹窗出现浅色底。
本轮以已验收的 `daa70432` 为基线，候选 EXE 为
`845dd43375c99a24b4f9e4273f50aa2c4a041a2b734d9f3144a04880881d1920`。

## 定位和修改

静态窗体 `TDLGNETTASKPROGRESS` 的尺寸、进度条和取消按钮布局与截图对应。
其类型为 `TDlgNetTaskProgress`，继承 `TTabForm` 的 `WM_ERASEBKGND`：
原始处理地址 `0xA16594`，内部列表非空时直接确认擦底完成。
现有该入口的深色预填充仅匹配 `TOptionForm`，没有覆盖收取进度窗。
同时，该进度窗资源的根 `Color` 仍为 `clWindow`。

`version587/receive-first-erase.cjs` 做两处局部修改：

- 根窗体 `Color` 改为 `#202020`，使继承擦底分支也使用深色。
- 将现有预填充的未匹配分支接入 16 字节精确类型判断。
  `TDlgNetTaskProgress` 的 VMT RVA 为 `0x99AB9C`；匹配时复用已有绘制路径，
  不匹配时回到原处理。原 `TOptionForm` 快速路径保持原样。

新增判断使用上一轮节区内已经存在的对齐空白，不追加文件长度。
沿用原有 DC 类型、位深、裁剪、映射模式、ROP、布局和画刷有效性检查。
没有新增 DLL、API、延时或窗口显示门。实际原 VCL 续接代码未修改。
该类是网络任务进度窗，使用相同类的发送进度窗也会获得相同的背景处理。

资源重新编码后缩短 5 字节，但只改变一个属性；原资源范围内的后续字节因此移动。
生成器验证全部其他节点、属性和资源保持一致，全部字节差异均在白名单内，
撤销白名单范围能精确恢复基线。

## 验证

`verify-receive-first-erase.c` 执行实际补丁入口、原预填充和新增判断，
使用合成窗体对象和真实 GDI 内存 DC/DIB。原 VCL 续接涉及完整窗体运行状态，
因此夹具用明确的合成续接替代；该检查不代表真实窗口显示验收。

两个映射基址共 1,244 项通过：旧候选在相同场景保留白色，新候选填入深色；
覆盖目标类型、原选项窗、其他类型、复杂/空裁剪、单色位图、非默认 DC 模式、
画刷/动态解析槽缺失、空 HDC、不同输入标志、寄存器/栈、LastError 和 DC 状态。

```powershell
.\Invoke-FoxmailPipeline.ps1 -Script version587\receive-first-erase.cjs -Tool node -InstanceId version587-20261105
.\version587\check-receive-first-erase.ps1
.\Invoke-FoxmailPipeline.ps1 -Script version587\port-kit\build.py -Tool python -InstanceId version587-20261105 -ScriptArguments @('--original','D:\Path\Foxmail.exe','--msaa-tray-guard','--contrast-followup','--search-chooser-followup','--chooser-first-erase','--receive-first-erase')
.\version587\check-contrast-cmd.ps1 -KitGroup version587-dark-port-kit-receive-first-erase
```

实际 CMD / Windows PowerShell 5.1 的安装还原、双击切换、旧 v2/v3 备份还原、
旧清单读取和试用配置隔离检查通过，包括上一轮已验收候选的备份。
记录为 `temp/version587-contrast-cmd-check-97c0c964/validation.json`。

单文件 CMD 为 603,839 字节，比上一轮增加 1,782 字节（约 0.30%）。
SHA256 为 `021a73246daef8d68f6d232a7e02ac87c0ecf9bec38a1ccd613451742e941e85`。
安装器与备份格式均未改变。

## 实际目录状态

部署前发现 Downloads 验收目录已还原为原版 `f208b5c2`，且没有补丁备份目录。
`install-receive-first-erase.ps1` 对该状态执行新版安装、还原核对、再次安装。
41 个原软件文件的字节、创建时间和修改时间核对通过，恢复后补丁备份目录消失。
检查仅涉及已知软件清单，没有读取邮件、联系人或设置。

记录为 `temp/version587-receive-first-erase-downloads-b90c10df/validation.json`。
最终 `D:\Users\Public\Downloads\Foxmail` 保留本轮候选及配套 CMD。
已请用户重复触发收取弹窗进行真实显示验收，结果待反馈；正式封存版仍为 5.0。
