import json,contextlib
exec(open('audit-print-dispatch.py',encoding='utf-8-sig').read().split('for first')[0])
report='''本次318/原生打印计数全零，排除该次白闪归因。
正常customWM_PAINT先87BAF8 BeginPaint，87BB2D仅绘graphic子控件，87BB53 EndPaint，然后才A92D10/A9156C；这里没有调用原BUTTONproc。新窄边界是BeginPaint返回、EndPaint返回的真实窗口像素，现有四阶段只验证后续内存位图。
TWinControl双缓冲113065E先BeginPaint屏幕，1130675才给memoryDC擦底，11306C9复制；可出现早期屏幕与memoryDC不同，但未证白色。
类刷存在静态覆盖缺口：A929FC/A9129C最终call112EC40，GetClassInfoA把系统BUTTON整份WNDCLASS覆盖进Params，替换早先映射WHITE_BRUSH。注册hook只处理pseudo1..31或自有缓存刷，外来真实刷/NULL放行；系统BUTTON刷实际值未知。hooks在原entry前安装，无启动顺序遗漏证据。
建议仅取两类GCLP_HBRBACKGROUND实际刷类型/颜色，关联BeginPaint前后和EndPaint后窗口背景点。尚未找到可确认的白色生产源，不建议改刷或改显示流程。'''
open('audit-early-window-surface.json','w',encoding='utf8').write(json.dumps({'scope':'只读原版和脚本；未启动、修改或构建应用。','report':report},ensure_ascii=False,indent=2))
with open('audit-early-window-surface.disasm.txt','w',encoding='utf8') as out,contextlib.redirect_stdout(out):
 for a,z in [(0x87bad0,148),(0x1130651,133),(0xa929fc,104),(0xa9129c,104),(0x112ec40,165),(0x112f00b,32)]:
  print('RANGE',hex(a));n.dis(a,z)
