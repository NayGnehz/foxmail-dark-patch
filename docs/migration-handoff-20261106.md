# Foxmail 英文根目录迁移交接（只读现状）

## 2026-11-07：新根迁移收尾

当前物理目录为`D:\Dev\Foxmail`，共享目录为`_env/_releases/_cache/_data`。
统一根协调已完成实际迁移，收据为`D:\Dev\_env\handoff\ascii-root-migration.json`，
其状态为`directory-source-registry-binding-complete`。本次只核对已应用的项目差异并
做本地Git收尾，没有运行旧迁移器、重新绑定、Pipeline、构建、业务/UI/云端检查，
没有启动Foxmail或录制器，也没有读取邮件、联系人、用户配置或凭据。

21项已审阅准备清单位于`_cache/projects/foxmail/ascii-migration-20261106/manifest.json`：
13份项目源码、3份发布恢复脚本、5份已知软件操作计划。后者15个明确JSON路径字段
已按新根定位，非目标字段语义保持；发布payload和历史证明不是本次修改对象。
核对仅比较明确的已审阅文件及prepared后像，不把路径迁移冒称新的程序运行验证。
实际核对21/21当前文件及21/21准备文件均匹配postimageSHA256，15/15指定JSON字段
等于审阅新值，差异0。准备manifest保留原`prepared-not-applied`状态未重写；实际
应用状态以根协调迁移收据及本次逐文件后像核对为准。

Git提交边界为12份已跟踪的环境/路径源码，加README当前入口说明和本交接更新。
这些源码已逐份反向还原两项目录前缀，与审阅前像SHA256及HEAD完整内容核对一致
（只允许既有CRLF/LF差异），没有夹带业务改动。
`version587/inspect-address-followup.py`原本是暂停业务目标的未跟踪脚本，虽然已按
准备清单应用环境路径替换，仍完整留在工作树、不整份加入迁移提交；3份发布恢复脚本
和5份cache计划本来就在仓库外，亦不复制入Git。

原有4项WIP、冻结MSAA源及暂停的搜索/联系人后续源码继续保留；没有reset/clean、
覆盖WIP或额外移动/删除文件。界面目标仍为paused，最后三项修正候选没有合并安装。
本次使用的全部命令均显式在`D:\Dev\Foxmail`执行，不依赖App聊天中的旧CWD。

以下保留迁移前交接快照；其中旧路径、进程与active状态是当时记录，不代表当前状态。

## 迁移前快照

本文件回应总协调聊天`00000000-0000-0000-0000-000000000000`的盘点请求。
已核实该聊天中用户选择D:\Workspace
当前源码唯一writer为Foxmail聊天`00000000-0000-0000-0000-000000000000`。

## 当前安全节点与活跃状态

- 最近一次2文件安装于2026-11-06 23:33完成，全部构建/合成浏览器检查均已结束；当前没有长构建、录制、同步或后台调试器。
- 正常运行程序位于**D:\Users\Public\Downloads\Foxmail**，不在待迁移总根内。根进程PID32932；同EXE另有CEF子进程。不能仅因这些进程活跃就结束它们或迁邮件。
- EXE SHA256：`3a3f9c385c3be8734c89b8b104cb18f2d2574ed4a790cf51c8ef637abfd44d5d`。
- helper仍为0e471e40…；写信模板c3a898dc…；地址簿Frame405bf5f9…；主窗DPI120。
- 用户最新验收：地址簿详情/新建/组选人等其他部分正常，剩下搜索接缝轻微错位、联系人标题白条、联系人选中颜色需与邮件统一。目标仍active，不能称待办全完成。
- 两个子代理现在仅离线静态分析/准备小修正，已告知不启动长构建、不操作/重启应用。若需1秒纯静态Pipeline计算，会先串行确认lease；迁移窗口下达后不启动。
- 没有自行改变公共根/其他项目，没有停止或重启任何原运行session来配合整理。

## 迁移涉及的最小入口

项目目录Foxmail本身已是ASCII。所有正式/缓存/依赖遵守祖先AGENTS五类目录规则。

1. `Invoke-FoxmailPortable.ps1`从祖先定位共享`_开发环境`入口/合同；`foxmail-paths.cjs`以`_开发环境/contracts/portable-v1.json`作为哨兵并定位共享环境。应随确定的`_env`映射一起更新，保留canonical adapter/lease。
2. `Invoke-FoxmailPipeline.ps1`、原生build-native-v2入口复用adapter返回的环境/instance根；不要另造开发工具或忽略lease。项目/实例为`foxmail/version587-20261105`，另有历史实例`cleanup-01a1aba4`。
3. `_发布/foxmail/{1.0,2.0,3.0,4.0}`是正式保留修改包，不是完整Foxmail/邮件。迁成`_releases`时保持payload字节/版本/manifest不变；恢复脚本的共享根发现方式需同步。项目`archive-*.ps1`/`restore-*.ps1`/`restore-release-template.ps1`等也有共享目录名字面量。
4. 候选全部在`_开发缓存/projects/foxmail/<instance>/temp`。正在安装的软件不加载这些cache中的EXE/DLL；安装文件在Downloads。缓存可整体按确定映射移动，不能借本次迁移清理待验收候选、回退文件或取新版本替换。
5. 当前事务回退入口`version587/install-ui-followups.ps1 -Rollback`依赖三个固定stage：version587-ui-followups、version587-group-border-rgba、version587-address-html。其validation.json内input/dest/before/source等是旧绝对路径；迁移后必须对**这几份已知软件证据路径**做可审计映射，或由writer按新入口重新产生等价软件计划，再做Preflight。不可直接全目录批量改未知JSON/私人数据，也不要把路径过期误报为程序hash变化。
6. 原版/当前运行软件路径D:\Users\Public/账户/签名内容**不在本次项目总根迁移内**。不要移动、哈希、扫描或合并这些真实数据，不修改D:\Workspace\Foxmail原版。
7. 本聊天cwd仍为D:\Workspace\Foxmail。实际改名时需协调聊天/工具的工作目录切换；不要在路径已迁后让旧cwd继续创建目录。通知确定映射后，本writer再更新活动项目入口，避免双方同时写同一文件。

## 工作树保护

盘点开始时最近提交为179cd8c；第一轮搜索/地址簿冻结源码和记录随后在本地提交，
最新commit以git log为准。第二轮小修正正在准备，保留所有未提交内容，不reset/clean/stash覆盖。
此前已有的四项改动始终未纳入本轮提交：

- `secondary-windows/compose-native-gate/foxmail_reveal_gate.c`
- `secondary-windows/compose-surface-candidate/`
- `secondary-windows/start-compose-window-trace.ps1`
- `secondary-windows/trace-compose-windows.py`

另有未安装/冻结的MSAA防护源码，见`version587/*safe-read*`及`msaa-node-read*.cjs`；保留，不安装、不混入新helper。
新工作集中在version587的search-style/check-search-style、patch-address-native、address-book-html/screen/verifier、ui-followups/install及对应docs；最新git status以迁移前只读快照为准。

本交接仅软件路径与进程/版本元数据，无联系人、邮件、账户正文或密钥。
