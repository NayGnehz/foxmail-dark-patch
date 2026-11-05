import json
r={
'scope':'只读源码/微软主文档；未调用任何运行窗口API，未改生产文件或构建。',
'confirmed':[
'add-window-display-theme.cjs对ShowWindow nCmdShow!=0及SetWindowPos(flags&0x40)先判断!WS_CHILD，然后调用DwmSetWindowAttribute(3,TRUE)、(20,TRUE)、(34,FFFFFFFE)。包括minimize6/restore9；不局限首次显示。忽略各HRESULT，故源码证明请求，不能证明每次成功。',
'add-tray-restore.cjs自身不设DWM。仅指定返回RVA BDFEEB、原命令5且IsIconic时改9；后续仍经过display模块。该改动不能解释纯taskbar路径较高发。',
'微软将attr3定义为TRUE禁用/FALSE启用DWM transitions；不承诺禁用后改变WM_PAINT顺序、自动清白或等待paint。DWM合成离屏surface，因此过渡暴露已有/未完成内容是可对照的推断，尚非白闪来源证据。',
'WM_PAINT可能等消息队列空闲才分发，显示和完成自绘并非一个原子操作。但文档不保证首次surface初始白色。BUTTON classbrush=NULL时系统不自动刷白；仅置fErase，不能据NULL归因。main/settings真实brush句柄未解色也不能归因为白。'],
'liveComparison':[
'仅选已有main HWND，先校验PID/窗口仍存在。保持同一最大化/正常状态、同一taskbar恢复方式，做TRUE/FALSE/TRUE三组各数次；仅attr3变化，20/34不动。',
'每轮在窗口已最小化之后，对这一HWND调用DwmSetWindowAttribute(hwnd,3,&BOOL,4)，记录HRESULT=S_OK；随后由用户恢复。FALSE组允许transition，TRUE组禁用。完成后恢复TRUE以匹配当前补丁。无需改EXE，无全局设置。',
'重要有效性限制：当前EXE在匹配ShowWindow/SetWindowPos时会立刻再写TRUE。单次FALSE无法保证到恢复时仍生效；尤其tray必经过这条hook，不宜用于此live对照。attr3无可用getter（实测Get返回E_INVALIDARG）不能当作setter失败，也不能确认FALSE保持。只有看见明显不同过渡或另有已有的setter调用证据，才可把此轮视为有效。',
'不建议周期抢写FALSE、强制Redraw/UpdateWindow、改WS_EX_LAYERED/COMPOSITED或classbrush：引入竞态/绘制新变量，无法隔离transition。若live没有可见动画差异，不做无效重复采样；下一次用户正常退出后可做仅display attr3不写入的离线A/B构建，保留20/34及tray所有其他逻辑。这个对照才能可靠消除重写混杂。'],
'interpretation':'FALSE有效组显著减少白闪，只能支持过渡时机放大既有表面问题；仍不证明DWM产生白色。FALSE与TRUE无差异且已证对照生效，则下调attr3优先级。NULL刷/未知real刷不值得继续猜改。',
'risk':'单窗口attr3是可逆外观属性，无邮件或账号数据变动；窗口重建需重新选HWND；恢复TRUE匹配当前补丁，无法凭Get还原未知原应用状态。未执行方案。',
'sources':{
'attr3_BOOL_semantics':'https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwmwindowattribute',
'per_HWND_HRESULT':'https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmsetwindowattribute',
'DWM_offscreen_surface':'https://learn.microsoft.com/en-us/windows/win32/learnwin32/the-Contributor-manager',
'WM_PAINT_queue':'https://learn.microsoft.com/en-us/windows/win32/gdi/wm-paint',
'NULL_classbrush_no_erase':'https://learn.microsoft.com/en-us/windows/win32/gdi/window-background'}
}
open('audit-dwm-transition-contrast.json','w',encoding='utf8').write(json.dumps(r,ensure_ascii=False,indent=2))
