# 4.0之后：账号页两条竖线

用户先要求封存4.0再处理竖线。4.0已封存并逐项校验，见
`../version587/archive-4.0.md`。基线62fa EXE /0e47 helper；不覆盖归档。

## 固定字段与实例归属

只读工具`account-lines-state.py`限定精确4.0软件hash、TOptionForm子树、已验证
VMT/size/atom/HWND，读取原生边界及已知绘制字段；不使用UIA、文字或账号内容。
20:40/20:45当前账号页采样无错误：

- 设置窗DPI120。可见TFMGroupBox边界[556,521,1076,1047]，client边界相同，
  style56000000、exstyle10000，没有系统客户区边框。
- Notebook和当前Page边界[556,539,1076,1042]，同宽且Transparent=0。
- 分组框ComponentState+1C=100（bit10=0，非设计态）、Ctl3D+1A5=1、
  Color+70=FEFAF9、clientColor+210=clNone、headerColor+214=FEFAF9。
- VMT+C8仍为87AEBC。唯一可见分组框Parent+30精确匹配TAccountOptionFrame
  VMT DAA69C、size904，且Parent HWND匹配原生父窗；另外三个隐藏同类不匹配。

静态Parent字段证据：1127977从Self+30取父对象，随后Perform WM_ERASEBKGND；
1127A02检查+30，1127A13继续沿父链。不能沿用历史Panel的Bevel偏移。

## 正常绘制与旧证据的限制

TFMGroupBox VMT B6A5E8、size536。正常WM_PAINT B6ABC0在ComponentState
bit10=0时，通过87BBC8调用11311D4绘制子控件，再调B6A808；设计态才走继承
路径。11311D4遍历子控件并转发WM_PAINT，不能跳过。

旧类级Paint计数3无法归到账号实例，旧空Paint试验也没有安装。新的诊断保留
全部原绘制，分别计全部调用和“精确分组框、精确账号父框”的调用：

| 入口 | 指针槽VA | 原目标VA |
|---|---|---|
| Paint虚方法 | B6A6B0 | 87AEBC |
| WM_PAINT | B6A6BC | B6ABC0 |
| WM_ERASEBKGND | B6A6C0 | B6AB78 |
| WM_NCPAINT | B6A6C4 | B6AB9C |

仅改四个已有重定位的分派指针，桩追加在最后.fxcnca段；保存寄存器/flags，
计数后尾跳原函数。没有API调用或绘制移除。实际桩8192用例通过，包括两个
基址、四入口、八归属守卫场景、64算术flags和零/溢出计数。

诊断EXE为`38a4634a2ca439e33ee3578a4b4df6a3fc685f651285b7066fdc72774483030e`，
20:49安装，helper保持0e47。20:50设置尚未创建时四入口计数全部0；等待用户
打开账号页，再读取归属。该候选不是修复，核对后恢复4.0再做因果试验。

20:52用户打开账号页、明确竖线仍在，四入口all/account分别为：Paint 3/3、
WM_PAINT 4/1、ERASE 10/4、NC 7/1。前后采样计数一致，全部守卫通过。
因此旧三次继承Paint现在取得精确账号实例归属证据，仍不是像素因果证明。
诊断后恢复4.0；下一试验限定这个实例的继承框线绘制，不使用类级空Paint。

## 局部边框调用候选

直接以4.0为输入，EXE候选为
`1c38639672b9ca1e5de77db307d604d7ac89ad1246c8ed8e44a88bb785ce6913`。
仅把三个E8边框调用改到局部守卫桩；Self通过既有嵌套绘制帧
`[[EBP+8]-4]`取得，精确匹配TFMGroupBox及直接账号父框才跳过：

| 调用点VA | 原目标VA | 原栈清理 |
|---|---|---|
| 87ABC4，主题分组框背景/边框 | 69D80C | RET8 |
| 87ACFE，legacy高亮边框 | 6576D4 | RET0 |
| 87AD38，legacy边框 | 6576D4 | RET0 |

原调用后的返回值均未使用。其余实例尾跳原函数；保留继承Paint的字体、标题、
画布及清理，VMT/DMT保持4.0原值，不删除整个Paint。实际调用点和桩的6144用例
通过，涵盖两基址、嵌套帧、实例/size守卫、RET8/RET0、flags/GPR/ESP及溢出。

20:59安装候选，helper保持0e47。21:00数字样本：themeFrame all14/skipped6，
两条legacy路径均0；主窗/设置窗DPI120，VMT+C8仍87AEBC，无守卫错误。
说明当前实际走主题路线，尚需用户确认竖线和设置/服务器/高级切换及关闭表现。
入口`install-account-edge-calls.ps1 -Rollback`可恢复4.0 EXE，不改变helper或归档。

用户已确认“竖线消失，其他正常”，因此接受1c局部调用修复作为下一步基线。
同时补充多个设置页的低对比框线有缺口，账号右边尤其显眼；原版浅色截图则
显示完整分组框。其他页调用仍原样转交，不能把这些既有边线问题归为本次
精确账号分支修改。用户进一步要求不好修时仅处理账号右侧，范围收窄至此。

下一最小试验是账号独有DFM的Notebook宽度416→414。其窗口与父框同宽且
同右边界，可能覆盖父客户区边线；缩窄后留出右侧细带，验证是否恢复原有
低对比边线。保留左边和其余布局，不新增全局绘制或图像重染。

## 账号右沿单属性候选

候选`540cf174a53e319529605b0cb3e171550783a6fe6455d29d16e5bc410f6d1f33`
基于已接受1c，只改资源TACCOUNTOPTIONFRAME中
`AccountOptionFrame.grpLine.Notebook.Width`。DFM type3/int16的416→414，
文件offset21542856仅一字节A0→9E；整个DFM树深比较只允许此属性变化，
其他PE字节、头、边框调用修复及helper保持相同。没有额外ABI测试，因为没有
执行代码变更。仍需验证程序后续布局没有把宽度写回。

21:10安装，入口`install-account-right-inset.ps1`，回退到1c用`-Rollback`。
`account-lines-state.py --inset`固定绑定候选hash，并读取原边框计数及
Notebook/父框原生边界，等待实际页面与右沿视觉确认。4.0归档保持不变。

21:11实际边界：父分组框right1076、Notebook right1074，宽度由520变518，
留出2物理像素；两窗DPI120、无守卫错误、主题边框抑制计数6。用户明确确认
“右侧已连续”，内容正常，因此保留540作为新基线。
用户随后继续要求处理各设置页缺失的下框线，正在检查共用皮肤资源与绘制矩形。

## 下框线的进一步排除

共用Border.png原/深色版本均141×22，alpha逐像素相同。底行y21的中央
x2..138原RGBA(196,196,196,204)、当前(61,61,61,204)，底行没有丢失。
用户提供的深色常用页截图y357..365、x50..740全部为背景(32,32,32,255)，
原版截图底边y429为连续(198,198,198,255)，因此不是仅因对比不足。

87BADD是九宫格底中央绘制调用，原目标8C668C。87BB84把group对象经EDX
传给87B6EC并存于EBP-8，原生HDC位于EBP-4；调用时EDX=HDC、ECX=destRect，
栈上传sourceRect。共享margin两DWORD为2/2。

`group-bottom-probe.cjs`以540为基线，仅包这一call并继续原绘制，精确账号归属
后记录首个非空裁剪样本：源/目标矩形、GetClipBox包围框和RectVisible底中央点。
5632实际site/stub用例通过，保留flags/GPR/ESP/LastError，空裁剪不发布。
探针EXE为`3a8c69a4db654d9a783535e505cdccb3e66ab8c5b67496efb0fa5309617b4933`。

用户保持账号页前台后，21:28记录稳定state2：dest[2,524,518,526]，
source[2,20,139,22]，clip[0,0,520,526]，COMPLEXREGION，
bottomCenter[259,525,260,526]可见；有效HDC，边距2/2，父高526，DPI120。
因此没有底条越界或该中心点被裁剪的证据；复杂区域的包围框并非完整区域，
这里额外使用RectVisible避免误判。参见[GetClipBox官方说明](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getclipbox)。
21:40已撤诊断恢复540，待核PNG部分绘制末行或后续填充覆盖，不把采样当修复。

随后静态找到色型差异：原Border.png为8bit RGBA(type6)，深色嵌入及外部PNG为
8bit indexed(type3)，像素/alpha相同。8C668C的24bit分支在8C6C66/8C6C6C把
Source.Top加到行索引；palette分支8C6E27/8C6E97没有该偏移。底条第一行y20
后第二行因此取y1背景而非y21边线。下一最小候选应只将Border PNG无损转成RGBA，
逐像素校验一致，不修改全局绘制代码；尚未生成或安装，视觉效果未确认。

用户随后报告打开一封未读邮件、正文滚动时错误。优先转查该故障，底边修复暂停；
当前磁盘及故障时软件仍为540/0e47，保留账号浅线和右沿已验收成果。

## 底边修复已验收

用户随后暂停崩溃调查，指定优先修复写信黑字和设置底边。
`group-border-rgba.cjs`只把嵌入资源`SKIN_OTHER_BORDER_PNG`由indexed转为RGBA，
141×22的全部12408个RGBA字节逐字节相同，像素SHA256均为
`280bfeafd34f9a88f2fbc2bcb94e6b2ed638960e1308f31e1eede22eb3572b08`。
旧PNG195字节、新PNG191字节，复用原资源容量；仅资源数据及长度字段共139字节变化。
所有可执行段、其他资源、PE头、文件大小、外部Controls皮肤、helper完全不变。

22:40安装EXE
`233e7bdfb5f0d3e688a46b7e9eccbed3572795b5312e7d5c810ad4a8b1b387c6`，
入口`install-group-border-rgba.ps1`支持预检及回退540。用户检查常用、账号、高级后
明确确认“底边已恢复，其他正常”。因此保留233e/0e47作为新基线，4.0归档不变。
