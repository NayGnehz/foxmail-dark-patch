# Foxmail 深色界面研究源码

当前物理目录为 `D:\Dev\Foxmail`。英文根目录迁移及源码提交边界见
[迁移交接](docs/migration-handoff-20261106.md)。已验收版本为 5.0，后续任务是回顾
和优化整个修改链。参见 [5.0 封存记录](version587/archive-5.0.md)及
[新会话交接](docs/HANDOFF-SOL-HIGH-20261107.md)。

本仓库保存本地 Foxmail 深色修改研究的源码、补丁、诊断/测试源码、构建入口、项目皮肤资源及必要文档。提交源码不代表发布新程序；当前运行成果、正式修改包和回滚基线均另行保留。

共享工具由项目祖先目录中的 `_env` 提供。`Invoke-FoxmailPortable.ps1` 复用共享入口解析固定 Node、Zig、Python 环境和 Capstone；原生编译入口将输出放入已登记的 `_cache/projects/foxmail/<instance>/temp`，并沿用共享锁与 lease。清理期间没有新增编译或业务测试。

`build-and-check.ps1` 和标记 `FOXMAIL_RETIRED_BASELINE_CLI` 的入口属于已退役历史实验，直接运行会明确失败；源码保留供理解历史，不应重新生成已删除的旧候选。

当前原生步骤见 `secondary-windows/print-native-gate/build-native-v2.ps1` 和 `secondary-windows/compose-native-gate/build-native-v2.ps1`。桥接/候选暂存已接入固定输入和登记缓存；录制器重建和旧验证记录仍有固定依赖闭包/证据有效性待维护，不能把当前仓库称作端到端便携发行构建。详见 [整理结果及未完成项](docs/cleanup-report-20261105.md)。

仓库不包含邮件、账户、用户配置、密钥、录制帧、实际部署目录、候选 EXE/DLL、固定第三方工具、原始反汇编/参考提取物或未知 JSON。仅 `ExternalSkinUpdate/manifest.json` 经确认属于皮肤 PNG 路径/hash 清单后单独纳入。忽略文件仍保留在本地，不因 Git 提交被删除。

历史源选择说明见 [source history](docs/source-history.md)。
正式1.0 **修改包**（不是完整Foxmail安装包）现位于同一总根的 `_releases/foxmail/1.0`；项目 `restore-release-template.ps1` 从共享总根相对定位它，恢复目标须显式指定。运行中的外部Foxmail和邮件数据保持原位。候选/阶段产物归 `_cache/projects/foxmail/cleanup-01a1aba4/temp`；参见 `Invoke-FoxmailPipeline.ps1`（沿用canonical锁/lease）和 `foxmail-paths.cjs`。

原生/桥接/暂存入口的路径调整没有重跑业务验证；缓存内既有JSON是原测试结果，部分记录包含路径调整前源码hash。`print-candidate/review.cjs` 仍保留源hash校验，因此旧报告与新入口hash不同时会失败，须在未来正常研究验证时生成新证据，不能把迁移视为新验证通过。`compose-initial/verify-startup-background.cjs` 还需要旧Playwright/完整编辑器测试资源，固定B只提供本轮已明确的compose模板，不补建浏览器测试闭包。

整套深色版的离线移植包由 [port-kit](version587/port-kit/README.txt) 维护。退出目标 Foxmail 后，将构建生成的 `Foxmail-Dark-Patch.cmd` 放在 `Foxmail.exe` 同级即可执行，使用系统自带的 Windows PowerShell 5.1。首次双击校验原版文件、写入 `原版备份` 再安装，下一次双击从备份恢复。`check` 只读预检，`trial` 安装试用配置，`restore` 显式恢复。ZIP 的 PowerShell 入口可另生成独立覆盖目录。

```powershell
.\Invoke-FoxmailPipeline.ps1 -Script version587\port-kit\build.py -Tool python -InstanceId version587-20261105 -ScriptArguments @('--original','D:\Path\To\Foxmail.exe')
```
