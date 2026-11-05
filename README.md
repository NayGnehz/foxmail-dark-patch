# Foxmail 深色界面研究源码

本仓库保存本地 Foxmail 深色修改研究的源码、补丁、诊断/测试源码、构建入口、项目皮肤资源及必要文档。提交源码不代表发布新程序；当前运行成果、正式修改包和回滚基线均另行保留。

共享工具由项目祖先目录中的 `_开发环境` 提供。`Invoke-FoxmailPortable.ps1` 复用共享入口解析固定 Node、Zig、Python 环境和 Capstone；原生编译入口将输出放入已登记的 `_开发缓存/projects/foxmail/<instance>/temp`，并沿用共享锁与 lease。清理期间没有新增编译或业务测试。

`build-and-check.ps1` 和标记 `FOXMAIL_RETIRED_BASELINE_CLI` 的入口属于已退役历史实验，直接运行会明确失败；源码保留供理解历史，不应重新生成已删除的旧候选。

当前原生步骤见 `secondary-windows/print-native-gate/build-native-v2.ps1` 和 `secondary-windows/compose-native-gate/build-native-v2.ps1`。桥接、候选暂存及录制器重建仍有路径/固定依赖闭包待维护，不能把当前仓库称作端到端便携发行构建。详见 [整理结果及未完成项](docs/cleanup-report-20261105.md)。

仓库不包含邮件、账户、用户配置、密钥、录制帧、实际部署目录、候选 EXE/DLL、固定第三方工具、原始反汇编/参考提取物或未知 JSON。仅 `ExternalSkinUpdate/manifest.json` 经确认属于皮肤 PNG 路径/hash 清单后单独纳入。忽略文件仍保留在本地，不因 Git 提交被删除。

历史源选择说明见 [source history](docs/source-history.md)。