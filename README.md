# Foxmail Dark Patch

Foxmail Windows 深色界面补丁与可回退安装工具。

**当前正式版：v5.1.0。仅支持 Windows Foxmail 7.2.25.587 的指定原版文件。**

## 安装与恢复

1. 在本仓库 **Releases** 下载 `Foxmail-Dark-Patch.cmd`。
2. 从托盘完全退出 Foxmail。
3. 把 CMD 放在原版 `Foxmail.exe` 同级目录，双击运行。
4. 安装完成后，仍运行同目录的 `Foxmail.exe`。

恢复原版：完全退出 Foxmail，再双击同一个 CMD。原文件会从 `原版备份` 移回原位；
文件创建时间和修改时间会还原，工具备份随之清理。

如果目录里已经装过旧补丁，先用新版 CMD 恢复原版，再运行一次安装新版。
请保留 `原版备份`，安装器不会自动关闭 Foxmail。

使用系统自带的 **Windows PowerShell 5.1**，不需要另装 PowerShell 7。
校验不匹配时会停止，不能直接套用到其他版本。

## 本版内容

- 主窗口、菜单、设置、邮件阅读、写信和地址簿的深色界面。
- 写信收件人及抄送人、搜索文字和条件标签的对比度修复。
- 选择地址列表及收取进度窗的首次擦底修复，减少白闪。
- 托盘恢复时的失效辅助功能节点读取防护。
- 单文件 CMD 安装、还原及旧备份兼容；当前备份清单为 41 个软件文件。

补丁只修改清单中的软件文件，不读取或上传邮件、账户、联系人和个人设置。
不包含完整 Foxmail 程序或上游运行库，请自行安装相符的官方版本。

## 下载文件

| 文件 | 用途 |
| --- | --- |
| `Foxmail-Dark-Patch.cmd` | 推荐；放到程序根目录后双击安装或恢复 |
| `Foxmail-Dark-Port-Kit.zip` | 高级用法；PowerShell 预检和独立覆盖文件生成 |
| `README.txt` | 离线使用说明 |
| `SHA256SUMS.txt` | 下载文件的 SHA-256 校验值 |

CMD 可选参数：`check` 只读预检，`apply` 安装，`restore` 恢复。
`trial` 是历史试用配置，日常使用直接双击 CMD 安装正式默认配置。

## 源码与历史

主分支只保留当前维护的源码和必要测试：

```text
src/installer/    CMD 安装与恢复
src/native/       正式辅助 DLL 的 C 源码
src/version587/   当前维护的增量修复及指令测试
tools/build.py    从已校验 ZIP 重建正式 CMD
tests/           打包回归检查
docs/            构建与维护说明
```

历次诊断、撤回实验和早期基础主题生成链保留在 **research-history** 分支及 Git 历史。
完整修改历史仍在，发布前的个人信息脱敏保持不变。详见 [开发说明](docs/DEVELOPMENT.md)。

重建 CMD 需要 Python 3 和本版 Release 的 ZIP：

```text
python tools/build.py --kit Foxmail-Dark-Port-Kit.zip --output dist/Foxmail-Dark-Patch.cmd
```

这一步复用 ZIP 内经过验收的差分、资源和 DLL，不会从零重编所有原生补丁。
修改基础主题或适配新版 Foxmail 时，需要研究分支中的对应生成链、官方原件及工具环境。

## 验证范围

本版已通过补丁字节范围、资源语义、合成 GDI/ABI 检查、Windows PowerShell 5.1 CMD 安装还原、
旧备份兼容，以及用户的真实界面验收。恢复检查包含原文件创建时间和修改时间。
检查范围及历史限制见各修复记录；其他 Foxmail 版本、不同 DPI 或系统组合需要另行验证。

本项目与 Foxmail 官方无隶属关系。
