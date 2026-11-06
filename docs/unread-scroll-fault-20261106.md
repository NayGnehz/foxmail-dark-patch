# 未读邮件滚动错误：固定报告诊断

用户最终明确复现顺序为：打开一封未读邮件，在正文中滚动时报错，上次也是。
不再用此前的“只打开未读列表”描述代替最新说明。底边修复因此暂停。

故障时安装540cf174 EXE /0e47 helper，主进程26176已退出；错误窗口属于其
crashpad_handler.exe子进程6084。报告ID为
`00000000-0000-0000-0000-000000000000`。没有发送报告或关闭用户程序。

从该handler的database参数定位专属Bugly报告库，仅按用户截图中的ID定位文件。
没有读取ext.json/ini/txt等报告文本。三个限界读取器分别读取：

- minidump头、异常流与模块表，共3846字节；不读取内存、线程栈或注释流。
- x86 context中的EAX/EBP/EIP/ESP四个DWORD，共194字节（含结构定位字段），
  不读取浮点/SIMD或邮件缓冲。
- 异常线程StackDescriptor内已验证EBP+4的单个保存返回地址，只读4字节栈数据，
  不扫描栈或读取局部变量。

数字结果保存于登记缓存`temp/version587-fault`，未复制原始dump。

## 已确认位置

异常C0000005读取访问，EIP00966374，EAX及失败地址均8AD0EBFF；
EBP0218E3BC、ESP0218E388。保存返回地址73D321CB位于oleacc.dll，
模块基址73D20000，RVA121CB。

00966374指令为`cmp DWORD PTR [EAX],1000000`。所在函数9662F0..966423
为TVirtualTreeItemAccessibility.get_accName（IAccessible slot10）；
其COM thunk965053先把Self减18再跳入。节点来自Self+14，或后续node+1A链。
原版587与540这308字节完全相同，SHA均
`fc9738c3dc4b5ef76aa55e597770a1551df3d5d9fb350a6814fd44c80a8ce`。
崩溃点未改不代表可以排除其他补丁引起上游状态变化，生命周期根因尚未查明。
程序LARGEADDRESSAWARE为true，不能用地址高位作为非法指针依据。

对象size28，构造9661D8把tree/node裸指针存入Self+0C/+14；类析构为默认4041B0。
没有取得节点释放前使外部仍持有的IAccessible对象失效的完整链证据。

## 待实现的局部防护边界

只保护966374的节点索引读取与9663B6的父链读取，成功时维持原cmp flags或
MOV结果；确切读访问异常才走原9663DA失败/清理出口。该出口原HRESULT为
S_FALSE，输出BSTR在966307..966310已置空，局部字符串由原finally清理。
正常MSAA行为和其他方法继续原路径，不整体禁用辅助功能。
[IAccessible.get_accName返回语义](https://learn.microsoft.com/en-us/windows/win32/api/oleacc/nf-oleacc-iaccessible-get_accname)

这属于已证崩溃点的止崩防护，不等同于修复节点生命周期。底边PNG的RGBA/索引色
差异已保留在账号页文档中；这是当时状态，底边后续已按该文档修复并通过验收。

## 后续：疑似关闭写信的不同故障

用户另提供错误报告`00000000-0000-0000-0000-000000000000`，称“应该是关闭写信窗口”。
当时为233e EXE/0e47 helper/19e7统一灰文字模板。限定读取3822字节异常/模块元数据，
得到C0000005、EIP0、read0；再读取194字节目录及指定x86寄存器，EAX0、EBP0218D9E0、
ESP0218D9CC。仅取保存ESP处一个4字节潜在返回地址653BEA，位于Foxmail主模块。
原版静态653BE8为`call dword ptr [ecx]`，属于VCL窗口方法thunk。
这与之前966374/MSAA get_accName故障不同，不能合并归因。

没有扫描栈/堆、读取邮件缓冲或上传报告。数字证据保存在登记缓存version587-fault，
入口`read-report-numeric.py`、`read-report-registers.py`仅白名单允许这两个用户报告UUID；
`read-report-close-return.py`固定EIP/ESP和UUID，只取单个DWORD。

已先撤回19e7文字试验到dd712。源码窄审0e47 helper的WM_NCDESTROY/timer/owner token
路径，未发现可直接解释此空调用的明确缺陷；合成own-window测试不证明VCL方法thunk
释放顺序。没有安装推测性的native或MSAA补丁。
随后用户要求的多色/光标候选c3a898安装，用户确认写信及回复/转发打开关闭正常；
这不等于已定位或修复偶发关闭故障。颜色细节见`compose-screen-ink-20261106.md`。
