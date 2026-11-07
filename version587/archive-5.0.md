# Foxmail 深色修改包 5.0

2026-11-07，用户确认搜索、地址簿、写信及设置检查正常，并要求封存 5.0。
修改包位于 `D:\Dev\_releases\foxmail\5.0`，对应 Windows 原版 7.2.25.587。

- 41 项程序与静态界面文件，22,608,309 字节。沿用 4.0 的具名清单，替换深色 EXE，增加写信和地址簿模板。
- EXE SHA256 `24665d0450f6a7b5efc9cba26cfc05dc9d0c8a761d6a91a093853d2ea4688f9c`
- 辅助 DLL SHA256 `0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70`
- 清单 SHA256 `d03209a8d39d645b1451c1e014dffb050928db7d19ef5cb50281710c9126e25b`

封存入口是 `archive-5.0.ps1`。它依据已校验的 4.0 清单和 5.0 文件哈希生成包，
发布目录存在时拒绝覆盖。恢复脚本复用 4.0 模板，绑定 5.0 清单哈希与 41 项文件数。

```powershell
& 'D:\Dev\_releases\foxmail\5.0\恢复5.0.ps1' -TargetRoot 'D:\Users\Public\Downloads\Foxmail' -VerifyOnly
```

上述命令实际返回 `verified=true`、`changed=false`。恢复面向已有深色副本，须退出
该副本后去掉 `-VerifyOnly`，原有软件文件会备份至登记缓存。
仅需撤销最后一轮搜索和联系人细节时，使用 `install-ui-refinement.ps1 -Rollback` 回到 3a3f9c。
