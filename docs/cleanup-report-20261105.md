# Foxmail 整理实际结果（2026-11-05）

累计实际释放 **590,616,856 B（563.26 MiB）**；未编译、自测或新增皮肤功能。没有关闭/杀死Foxmail或录制器，未删除录像/帧，未读取、哈希、复制或迁移邮件、账户、运行配置、密钥。

## 已执行

1. 删除39个已与完整wheel逐段比对相同的下载分片：D:\Workspace\Foxmail\native-toolchain\wheel-parts\0..38，80,418,705 B。
2. 共享writer入库并验收后，删除本地原包 D:\Workspace\Foxmail\native-toolchain\ziglang-parallel.whl，80,418,705 B。共享原包仍为 _开发环境/feeds/wheels/ziglang-0.13.0-py3-none-win_amd64.whl，SHA256 b64b2aa936ebbfeecfbb2611df331a5474edebe1246b98c2f56d6ae4d58b71fc。
3. 人类在root聊天消息01a1abc5-fab1-71d3-9756-10818e9306ac明确批准，旧读取入口退役后，仅删除以下5个EXE，共112,520,704 B：
   - D:\Workspace\Foxmail\cosmetic-1.1\payload\Foxmail深色.exe：22,471,680 B。
   - D:\Workspace\Foxmail\cosmetic-1.2\payload\Foxmail深色.exe：22,471,680 B。
   - D:\Workspace\Foxmail\SourceBackupBeforeEarlyWindowDiagnostic-7D33\Foxmail-dark-fixed.exe：22,523,392 B。
   - D:\Workspace\Foxmail\SourceBackupBeforeSystemTransitions-85E9468F\Foxmail-dark-fixed.exe：22,526,976 B。
   - D:\Workspace\Foxmail\SourceBackupBeforeTransientBuffer-EDF4328F\Foxmail-dark-fixed.exe：22,526,976 B。
   没有为这些旧EXE新建ZIP。31个历史CLI/installer/下载入口已明确失败退役，保留源码；CJS patchBuffer导入API与原有strict语义保留。其中旧1.1候选生成器及本地工具下载器也已退役，避免重新生成已删除旧物；具体脚本名单及5文件原hash在docs/cleanup-result-20261105.json。两份旧实验audit入口指向既有JSON结论，不伪称重算成功。SourceBackup内独立源码未改。
4. 研究writer在 secondary-windows/research-write-boundary.json 明确交接5脚本后，切换 native-whitebars.py 到共享Capstone；native-toolchain/build-native.ps1、reveal-gate-v2/build-native-v2.ps1、secondary-windows/compose-native-gate/build-native-v2.ps1、secondary-windows/print-native-gate/build-native-v2.ps1 到共享Zig，输出/导入库/obj/fixture/日志和Zig缓存归登记实例temp，读取原位置C源。保留SEH修正、编译参数和patch业务语义。原生入口持canonical Prepare/lease，显式设置并恢复进程环境。
5. 持同一canonical锁/lease，按共享manifest再逐文件核源/共享hash、owner、规范路径、无重解析点与占用后，仅释放：
   - D:\Workspace\Foxmail\native-toolchain\zig-wheel：15,377个已覆盖固定软件文件，308,842,777 B，随后仅移除空目录。
   - D:\Workspace\Foxmail\analysis-libs：65个清单软件文件，8,415,965 B；非清单内容不删，留下605,258 B生成字节码。
   两类合计317,258,742 B。删除后按manifest确认15,442个源文件全部不存在，共享文件保留。汇总记录曾在第二组件删除后遇到数组类型错误，已用manifest逐项缺失核对修复日志，未重复删除或重复计数。

所有删除均以精确LiteralPath执行，核对owner=Contributor\Contributor；不跟随联接、不递归通配删除、不绕过原锁。源码外canonical锁的沙箱写入曾被拒，随后通过审批通道取得访问执行；没有直接绕锁删除。

## 共享环境和入口

登记项目/实例：foxmail/cleanup-01a1aba4；临时根 D:\Workspace\_开发缓存\projects\foxmail\cleanup-01a1aba4\temp。新增 Invoke-FoxmailPortable.ps1 从祖先定位共享总根、复用共享模板和Invoke-Portable；Resolve/Tool/Environment已只读核对。四个原生输出子目录分别为native-reveal-gate、native-reveal-gate-v2、native-compose-native-gate、native-print-native-gate。仅做PowerShell语法解析，没有运行编译或自测。

Zig固定工具：_开发环境/tools/ziglang/0.13.0/win-x64/ziglang/zig.exe，0.13.0，MIT/Expat及完整lib第三方许可证保留。原来源记录 https://files.pythonhosted.org/packages/e0/0c/66f4710aedf5544e15779ff9c6e770322986e15daf9299b1a4df0be19e09/ziglang-0.13.0-py3-none-win_amd64.whl；exe SHA256 2e44af5bbf7a72ef8cbdae370284687c95d65a19affa469d2ad0364d905b8e84。共享manifest=manifests/ziglang-0.13.0-foxmail.json。

Capstone固定依赖：_开发环境/tools/python-libs/capstone/5.0.9/win-x64，5.0.9，三条款BSD LICENSE.TXT。来源只能确证本地METADATA/RECORD/upstream https://Workspace/重编。DLL SHA256 76958e18380023a68fd1714fa2e01c594cc6db1955a07ad6937b66e66dc5d6c3；LICENSE SHA256 404bd0cb0137ffb797258f844f53e5273f9b6d5781a1a359a2880411f49a4f30。共享manifest=manifests/capstone-5.0.9-foxmail.json；本地逐文件清单docs/capstone-5.0.9-migration-files.json，SHA256 43e0648475bdbdea209bbce14a5fad906bb5289372c4ad82e13d17aed652ea32。

build-and-check.ps1静态检索仅有自引用，属于旧全链（Framework csc/7-Zip/旧UI实验）入口，已真正退役并指向当前print/compose原生入口；原历史构建源码从本聊天最初读取记录恢复，保留在同一文件不可达的退役错误之后，不要求调用者手填工具路径，不为旧链再引入闭包。

不能把以上称作“当前端到端发布链全部便携”：研究writer所有的 build-print-bridge.cjs、build-compose-bridge.cjs、compose-candidate/stage.cjs、print-candidate/stage.cjs、print-candidate/review.cjs、compose-native-gate/write-candidate-audit.py 等仍围绕源目录已冻结的软件/报告读取。当前已冻结成果未动；未来重建时，研究writer必须显式消费上述缓存新输出并将自己的桥接/候选输出归缓存，避免误用旧源目录DLL。本聊天按五文件交接边界未抢写这些活动pipeline脚本。

另一个明确缺口：secondary-windows/compose-recording/build.ps1（研究writer保护文件）仍调用系统 C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe，版本14.8.10001.0，SHA256 9e1257ca87282caebce4a04894a51c594a0453b287cd199c0c8e8bb3b0d6a19f；同目录csc.rsp SHA256 e2021640c1f8ad500549fc89cd53bc4c2f0fa13fee9034714142d93c5d554042。显式引用System.Drawing.dll、System.Windows.Forms.dll、System.Web.Extensions.dll，另外隐式依赖csc.rsp默认38个Framework引用及CLR/mscorlib，并仍向录制源码目录输出/自测。没有修改、执行它，当前已编译录制器继续保留运行。若未来要求重建录制器纳入便携闭包，最小备选是已有共享SDK Roslyn csc.dll加经共享owner批准的Framework4.x固定reference程序集，输出实例temp；不能将.NET10 BCL视为Framework目标，也不能只搬csc.exe声称完整。无当前重建要求，本轮不下载或复制Windows框架，不新增工具栈，已把缺口交root。

## 成品身份、独立源码与仍保留项

本产品线是Foxmail深色修改版。releases/1.0/manifest.json 明确version=1.0且User accepted，audit-reveal-v2-user-result.json明确接受并冻结1.0；是本轮找到明确正式身份的最新1.x。cosmetic-1.1/1.2/1.3 install-plan仅写candidate/eligibleForInstall，没有正式接受字段；1.4明确deploymentApproved=false。compose 1.3.2仍是当前研究候选，安装不等同正式接受。不冒用上游Foxmail、Zig或依赖版本作为项目版本。

正式1.0修改包、cosmetic-1.3当前打印构建基线、compose当前payload与rollback baseline的EXE分别仍为31dee04a...、a3d3700d...、086e0c1d...、09d9f83f...；删除后再次核对这些本地软件hash未变。没有读取或哈希实际部署目录的邮件/配置或实际安装文件。

- D:\Workspace\Foxmail\releases：原盘点32,540,276 B，保留正式修改包；拟归 D:\Workspace\_发布\foxmail\1.0，尚未迁移。若研究writer有更高1.x正式接受证据，应保留该最新版本，不因1.0为首版永久保留它。
- D:\Workspace\Foxmail\cosmetic-1.3\payload\Foxmail深色.exe：22,471,680 B，当前print链固定输入，拟由共享owner登记到_env相应feeds/native/foxmail-build-inputs/<完整hash>/，身份是build-input而非额外正式版本。print-native-gate/build-print-bridge.cjs、print-candidate/review.cjs需由研究writer替换到同字节固定输入；pristine恢复计划/恢复脚本仍留源码。尚未登记/移动此基线。
- D:\Workspace\Foxmail\secondary-windows\compose-candidate：45,027,722 B盘点；payload4文件22,496,231 B，baseline4文件22,494,897 B，保留当前候选/必要单套回滚输入。后者拟由共享owner以compose-rollback-09d9f83f固定输入登记或归现用缓存，不列多个正式版本。实际部署rollback还读取运行根DarkModeBackup，未读取或迁移那个目录，不声称源码baseline归位即完成部署回滚迁移。
- cosmetic-1.1、1.2其余源资源/报告保留；cosmetic-1.4的拒绝方案源/拒绝结论保留，不泛删PNG/CSS/fixture。不得把当前有用皮肤资源随旧EXE删除。
- SourceBackupBeforeEarlyWindowDiagnostic-7D33：不同版本build-and-check.ps1及必要源/元数据保留；SourceBackupBeforeSystemTransitions-85E9468F：不同的add-window-display-theme.cjs、build-and-check.ps1、verify-hooks.cs保留；SourceBackupBeforeTransientBuffer-EDF4328F：不同的build-and-check.ps1、build-dark.cjs、verify-hooks.cs保留，110个同当前根软件/源文件未借本批准删除；SourceBackupBeforeWin11的13个源文件均与当前根不同，全部保留。已删3个EXE不因hash不同继续归档。
- native-toolchain内seh-probe.c、构建/下载源脚本、import-libs和未确证完整性的zig.zip/zig-mirror.zip/ziglang.whl仍留原位；后三者共15,786,536 B，不在共享同份manifest或五EXE批准内，本轮未扩大删除。
- 用户帧、selftest帧、预览和录制源码/只读诊断脚本均未动。原始目录盘点见docs/cleanup-inventory-20261105.json（删除前快照，不能当作当前剩余量）。

## 真实资料边界

运行总根 D:\Users\Public\Downloads\Foxmail 仅取得目录metadata：owner=Contributor\Contributor，reparse=false，ACL继承未保护、8条访问规则。未递归枚举资料树；邮件/账户/个人设置/密钥具体子目录及长度未知。拟数据目标仅D:\Workspace\_数据\foxmail，没有执行任何映射/迁移。

此前自动审批拒绝泛化旧物删除与真实邮件资料迁移；人类仅解除本次精确5EXE的阻塞，其余拒绝仍有效。运行根在本次D:\Workspace/加密保留和针对项授权；不关闭活程序、不打印/哈希正文/配置/密钥、不合并覆盖目标。

实际证据：docs/cleanup-result-20261105.json、docs/cleanup-deleted-parts-20261105.json、共享handoff/foxmail-fixed-components-20261105.json、研究写入边界secondary-windows/research-write-boundary.json。全部实际释放均已向root回报。