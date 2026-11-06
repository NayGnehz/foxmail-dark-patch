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
