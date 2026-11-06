# 3.0 后的写信首帧研究

封存3.0为f8f4732d EXE、29efc7d9 helper，完整hash见
`../version587/archive-3.0.md`。3.0归档已完成，39项payload校验通过。
当前安装已进入下述4ca3440e弹窗白边候选；归档、模板及辅助DLL未改动。
用户要求优先解决写信、转发、回复白闪。

## 新证据

用户三张截图显示两类问题：正文先出现约296像素高的白区，下方约141像素黑区，
之后才形成完整正文；在刚打开写信时用Alt+A启动微信截图，高概率出现外围白线，
鼠标经过只能清掉一部分。用户明确主要在刚打开时触发，尚未证明稳定窗口可反复触发。
不能把这两类问题都归到主窗首次激活，也不能宣称3.0解决了写信窗口白边。

`version587/compose-state-trace.py` 对固定f8软件、587 RTTI和对象尺寸做守卫，
只收集目标写信窗口及其子窗口的原生create/show/hide/location事件、尺寸、
DWM cloak数值、gate属性，以及编辑器已知加载标志/背景数字。最长等待120秒，
首次写信show后4秒停止；最多3000条事件、256KiB数值读取。没有UIA、文本API、
HTML/URL读取、录屏、消息注入或目标写入。诊断线程使用物理坐标，不改目标DPI。

18:52首次记录 `compose-state-20261106-185247.json`：33条窗口事件，
TCEFWindowParent先296像素高，约44ms后变437像素，渲染窗口变438像素。
这与截图白区及下方黑区尺寸对应。该轮新增命名GetPropW绑定错误地改了共享
ctypes函数签名，使整数atom读取失败；因此**该轮没有有效load/color数据**。
窗口事件不受此错误影响。已修正为复用void*签名，增加参数类型自检与回调错误捕获。

18:57一次静态状态读取通过，无错误，共490字节：可见编辑器loadEnd=1，
Options背景为FF202020，真实CEF browser_settings背景也是FF202020；
原生宿主Color=202020、ParentColor=0、DoubleBuffered=0、ControlStyle=AA。
这排除稳定状态下的持续白色配置，不倒推首帧。

19:03第二轮用户明确仍有白闪，记录 `compose-state-20261106-190303.json`：
34条变化记录，约17.8KiB数值读取；相对根写信窗口show事件送达时刻：

| 采样时刻 | 已验证状态 |
|---|---|
| -9.69ms | loadEnd=0；Options及真实CEF settings背景均FF202020；原生宿主已437高，内部CefBrowserWindow/Chrome_WidgetWin_0仍296高 |
| +4.90ms | 内部浏览器/渲染窗口已扩为437/438高；loadEnd仍0；背景数值不变 |
| +527.18ms | loadEnd首次被采到1；背景数值及最终尺寸不变 |

host颜色与双缓冲字段在上述三次均为202020/0。窗口创建/尺寸事件送达时gate仍持有
cloak。一个窗口身份守卫拒绝对应窗口销毁竞态，没有读取被拒对象。回调总开销约
14.8ms、单次最大2.1ms。事件在外部进程异步送达；20Hz数值采样会错过短暂状态，
以上不是屏幕呈现时间，也不能将527ms当成白闪持续时间。

## 静态交叉核对

587 TCEFWindowParent继承 `TWinControl.WM_ERASEBKGND=1131A00`。
ParentBackground未设置且DoubleBuffered为0时会通过自身画刷FillRect，不能称为空擦底。
宿主原生颜色补丁在B895CC，编辑器外壳颜色补丁在B89D43，均已在当前基线中。

Options+34到实际CEF创建参数的复制在 `B5EA12..B5EA1E`，目标是
`Chromium+D4`的settings结构（size=A8），背景在`Chromium+170`（D4+9C）。
两条创建路径先于创建调用初始化该结构。读数只取size与背景两个DWORD，
不读取整块CEF状态或任何内容指针。CEF文档将background_color定义为文档前或
未指定文档底色时的背景；它不等同于首帧已经呈现。
[CEF背景字段说明](https://magpcss.org/ceforum/apidocs3/projects/%28default%29/_cef_browser_settings_t.html)

当前证据把重点收窄到“浏览器先按296高建立，父级扩到437后内部异步跟进”及
文档初始化期间的画面，而非继续把原生Color或Options重复染深。仍需核对最终
窗口尺寸恢复为何晚于浏览器创建。
未据此安装任意延时、重复重绘或整窗双缓冲候选，白闪目前仍未解决。

外部模板的优先级也取得静态证据：`B85A00` 创建 editor+2E8 模板管理器，
`B85A3D..50` 登记 `TemplateRoot+\\HtmlEditor\\Common\\HtmlEditor.html`，
键为csHtmlEditorTemplate。展开经 `B84A96→B792E4→B79558`，先查manager+8
的内容缓存；未命中才从manager+4取登记路径，经 `B79604→AF874C→7075F8`
读取、按BOM解码并缓存。所查分支没有内嵌模板优先逻辑；最底层字节读取函数
707574尚未展开。不能再把“外部模板根本未采用”作为无证据的默认解释，
但热改已缓存实例也不能保证立即生效。前一次root LINK与DrawEdge混合候选
已经反馈仍白闪，尚无新证据支持重复安装同一方案。

## 尺寸恢复的精确边界

`inspect-compose-layout.py` 对四个旧版函数做48条归一化指令唯一匹配，随后
检查587代码。FormShow为D1346C–D13807；几何恢复在D1371D–D137D6，
D13795设Left、D137AC设Top、D137B7设Width、D137C2调用112AAB8设Height，
D137D2恢复最大化，随后才启用工具栏定时器。

但CreateParams（D15650–D15716）已向Win32参数写保存宽高；普通分支没有
FormShow里的6B3A54缩放调用。因此“创建前完全没有恢复尺寸”不成立，需要区分
Win32参数、VCL缓存尺寸及子控件重排。FormCreate（D12318–D127D6）已持有
frame+6E4并绑定回调，当前检查没有得到可直接插入几何恢复的单一浏览器创建点。
A2CF68只排列工具栏面板内控件，不是根窗尺寸来源。

下一局部实验应限定D1371D–D137C6的几何恢复，先核实提前重排是否会触发
Resize中的配置保存或重复DPI换算；最大化单独评估。现阶段没有把整段硬搬到
FormCreate的依据。此结论保留了可复查的代码边界，并不冒称白闪原因已最终查明。

## 弹窗白边候选的实际结果

`compose-ncactivate.cjs` 从3.0生成
`4ca3440e7da018de28d3b920f93ba38af3f8500d1a767a7c091430577b6853c3`。
静态动态消息表核对确认TFoxComposeForm经TTabFormShortCut继承TTabForm的
WM_NCACTIVATE处理。只在既有首次默认激活调用点，精确compose VMT、
非最小化、消息86且wParam非零时，临时使用lParam=-1并恢复原值；
其他路径尾跳原主窗桩，原`.fxnca`整节字节相同。
没有改变DPI、窗口样式、启动API、延时、模板或正文。

实际机器码2048项ABI用例通过，覆盖两基址、分支条件、64种flags、嵌套调用
参数恢复及旧主窗桩回退。安装入口同时核对固定软件hash及测试源码/产物hash。
2026-11-06 19:37安装并正常显示启动，主窗DPI120、主窗计数1。
随后用户按要求刚开写信即Alt+A截图并取消，回复没有白线；又补充截图明确
“仍有白闪，但没有白线了”。截图中正文仍约296高白区加141高黑区。
只读采样compose命中计数47、main计数1，窗口DPI均120；该数值仅表示调用
命中次数，不能解读成47个不同窗口，也不证明其他场景全部通过。

保留4ca作为下一正文候选的基线；3.0封存不覆盖。该轮实际接受了弹窗白边的
改善，**正文白闪尚未解决**；回复/转发及更多启动场景仍待回归。
`compose-state-trace.py --ncactivate` 显式选择4ca精确hash，同时补记根控件
宽高、Visible57和WindowState22B，用于后续显示前布局对照，不读取内容。

## 显示前布局候选

`inspect-compose-presize.py` 核对587实际代码：隐藏时FormResize经D1E548在
Visible57=0分支跳过窗口配置保存；虚表+84的SetBounds位于1133690，采用
EAX=Self、EDX=Left、ECX=Top、依次压Width/Height且callee ret8的调用约定。
普通尺寸getter首先经过10EE960，可能初始化配置；因此候选只在应用自身已有
配置对象init10=1、state24=0且原始宽高100..12000时采用同等纯读取路径，
不提前调用可能写配置的getter。缩放使用原6B3A54，并检查缩放后范围。

`compose-presize.cjs` 仅修改既有显示门内回调的trampoline指针4字节，将包装
附在最后`.fxcnca`段末。限定精确compose对象、隐藏且普通状态、58A!=1、
已有HWND、门所有者属性存在且DWM cloak=1；当前宽高不同才调用一次原
SetBounds，保留Left/Top及原Show。既有主窗/弹窗白边桩、其他原代码及
模板均保留。计数只在SetBounds正常返回后增加，不代表浏览器已提交画面。
全局busy防同步重入；异常时保持busy使后续预布局跳过，既有门的finally
负责cloak释放。隔离测试不覆盖真实异常展开，不能据此宣称异常路径已验证。

候选hash为`252f62e085fdbaf161286c81ea459c110021b1eef6db4b2e5ab9398c2792f930`，
以4ca为回退。只读计数与事件工具的`--presize`均绑定该精确hash；不接受任意
安装文件。候选的实际白闪效果仍须对照，不能从静态推理认定已经解决。

19:47安装前6656项实际机器码隔离用例通过，安装预检通过。用户实测反馈
“第一次无白闪，第二次有”，数值确认两个窗口的预布局均执行（计数2）、busy=0，
主窗和写信窗DPI均120。因此不能把首次改善视为修好。19:50已回退至4ca，
保留已接受的白边修复；252候选不进入正式归档。

`compose-state-20261106-194912.json` 同时记录这两次显示，共128条变化、
80860字节数值读取。10次窗口身份守卫拒绝对应创建/销毁竞态；被拒对象不读。
回调总开销78.2ms、最大5.9ms，仍不能视为像素呈现时间：

| 事件送达ms | 第一窗口 | 第二窗口 |
|---|---|---|
| 根窗建立 | 3855，隐藏1000×562 | 54266，隐藏1000×562 |
| 根窗show | 52997，1000×703，cloaked=1 | 54540，1000×703，cloaked=1 |
| 浏览器/渲染子窗 | 52986–52988已最终437/438高，仍cloaked=1 | Chrome_WidgetWin_0于54599建立，renderer于54601建立、54619显示，此时cloaked=0 |
| 首次采到解除cloak | 53075 | 54593 |

这证明单靠提前尺寸恢复不足：第二窗口的内部浏览器仍在同步显示门解除后建立。
下一方向转为编辑器就绪信号与显示释放的异步衔接，不能再通过任意延时、窗口
生命周期双缓冲或单次不闪判定成功。用户提出浅色原皮肤可能也有相同初始化
过渡、只是白底上不明显；这是合理推测，尚未做原皮肤对照，不写成事实。

## 就绪后显示候选

20:21已安装候选EXE
`62faa3d801b1fcf8726a5b29f9636b8cc6e0fbec96e215ff7c856be6bbb5e52c`，
辅助DLL为`0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70`。
回退是4ca EXE及29ef helper；未叠加已撤回的预布局试验。

`compose-ready-source.cjs` 从保留FxColdRun的精确基线源码生成新helper，五处
变换可逆还原原始源码hash。只有compose成功取得显示门时启用独立异步槽；
原调用及同步重绘成功返回后接管cloak，最多八个窗口互不借用通知。
原主窗口、设置、打印及托盘恢复路径仍同步处理。异常未接管时由原finally释放。

`compose-ready-bridge.cjs` 包装主frame、非about:blank的原LoadEnd调用点
B842FC。调用前固定host/root/owner/message，原回调返回后复核四元组再发
异步通知；回调可能销毁对象，返回后不再解引用对象。接收方验证当前owner、
加载字段及四层渲染窗口的可见性/几何，再发一条UI消息，于下一消息边界重绘
并释放cloak。LoadEnd及窗口齐全仍不等于像素呈现确认，效果必须实际验收。

fresh入口必须等本owner通知；入口已为1的加载字段只是曾加载过的生命周期
latch，不能证明复用窗口新导航完成。关闭、隐藏、最小化或销毁会取消等待。
40ms UI计时器重查已就绪窗口，1500ms阈值负责失败时放行；Windows计时器
依赖正常消息循环，不能宣称为墙钟时间的硬上限。DWM释放失败保留owner待重试。
[WM_TIMER说明](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-timer)

必要隔离验证已通过：bridge实际机器码4352例、原生故障注入385项、实际DLL
310项，包括真实合成对象/VMT/atom读取、renderer链、关闭/销毁、重入、线程与
token、八槽上限、异常及DWM失败重试。bridge异常展开未单独测试；原生helper
异常跨模块测试通过。构建中纠正过atom RVA误减基址，并补了相同HWND复用时
拒绝新owner的用例。安装汇总绑定26个源码、报告和产物hash，预检及数字工具
自检通过。安装后首次读数DPI120、各就绪计数为0；两次开窗实际结果待确认。

第一轮实际反馈为“两次都正常，没有闪烁或抖动”，按提示关闭空白写信窗。
记录`compose-state-20261106-202255.json`中可见三次show，首次两次cloak均延续
到显示后约194/246ms才首次采到解除；这些仍是异步事件/20Hz观测边界。
随后原PID5876已结束，新PID24924在20:23由Explorer启动。新进程精确软件hash
一致，计数armed/notified/readyReleased均5，timeoutReleased=0、active=0，
setup/release/redraw/callback失败均0，DPI120。不能把进程变化直接归因于崩溃；
已向用户确认是否主动重开，同时请求回复、转发及Alt+A白边回归。

最终用户确认进程变化是手动重开，并完成回复、转发及刚开写信Alt+A回归，
回复“都正常，也没有白线”。最终只读计数armed/notified/readyReleased均14，
active=0、timeoutReleased=0、所有失败/异常计数0，两个窗口DPI120。
因此本轮写信/回复/转发白闪及弹窗白线目标按实际场景验收完成，保留62fa/0e47。
这不是所有可能时序的保证；账号页竖线、提醒窗及编辑纸面可读性仍属其他遗留项。
2.0与3.0归档未覆盖，也未给当前成果擅自新增发布版本号。
