import json,contextlib
exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
r={
'scope':'只读原版binary/资源/截图；未启动或修改Foxmail、构建、运行窗口。',
'conclusion':'尚未找到TOptionForm/TTabForm自身淡入的具体开关或计时器，不能直接推荐关某个fade。截图证明窗口组合呈透出状态，不能仅凭这一帧确定为layered动画。',
'layered':{'SetLayeredWindowAttributes':'动态pointer12EA1A4。TCustomForm111DF60在self+2E0(AlphaBlend)或+2E8(TransparentColor)为真时加WS_EX_LAYERED，111E01D调用，alpha来自self+2E1。111E090是AlphaBlendValue setter，未发现静态E8调用；有RTTI setter所以不能据此证明从未调用。TTntForm882C59/882C63只在已有AlphaBlend=true时先false再true重建属性，不含fade递增/计时。','UpdateLayeredWindow':'IAT12FA610/thunk409070共6个E8站：842B3C/842C2E=TTBPopupWindow菜单fade服务(842BD4由TTBPopupWindow消息955/8B56EC调用)；848321=TShadow；86A5BD=TCtrlShadowService；89E2DA=TShadowService；C5DB09=TBubbleShadow附近。尚无OptionForm主客户区overlay连接。','AlphaBlend':'IAT12FA9FC/thunk408460只有848450,A0C1FE,A0C226,A50AF3四站。848450是TShadow；A0C1FE/A0C226的BLENDFUNCTION固定alphaFF、AC_SRC_ALPHA1，非时间渐变；A50AF3尚未完整归属。'},
'timers':'FAnimateTimerTimer的真实method为DDEDAC(TDlgSyncModal,VMTDDE8E4)和DE0834(TDlgImapModal,VMTDE036C)。代码读取self+410 label文本，超长时截短，再追加点号并SetText；是等待文字动画，不能当淡入开关。',
'compositionCandidate':'共享TTabForm CreateWnd A17F70(+D4)在A18134调用A0CAE8。后者向[12F6AD4]传hwnd和16字节按left/right/top/bottom排列的margins，符合DwmExtendFrameIntoClientArea ABI（函数名未被解析证实，属推断）。A1A3E8边距固定left8/top34/right8/bottom8，并非全client(-1)。A1B598 gate依赖composition查询、self+3D8及global12D3E94。现有A1B0CC明确黑刷清边缘，不能据此证明全窗玻璃或整窗淡入。',
'nextDecision':'下一步若继续应在全窗合成层定性（短暂层叠/玻璃/临时overlay的实际HWND和alpha），不是重复checkbox像素。没有确定owner与实际alpha值前，不全局改SetLayeredWindowAttributes/UpdateLayeredWindow/AlphaBlend，也不盲关TTabForm composition gate；菜单和阴影也依赖它们。'
}
open('audit-internal-alpha-fade.json','w',encoding='utf8').write(json.dumps(r,ensure_ascii=False,indent=2))
with open('audit-internal-alpha-fade.disasm.txt','w',encoding='utf8') as out,contextlib.redirect_stdout(out):
 for a,z in [(0x111df60,255),(0x111e05c,104),(0x882c48,68),(0x842bd4,102),(0x8b56ec,24),(0x8482e1,75),(0xa0c1cb,96),(0xa17f70,469),(0xa1a3e8,44),(0xa0cae8,100),(0xddedac,174),(0xde0834,137)]:
  print('RANGE',hex(a));n.dis(a,z)
 print('Owner methods: TDlgSyncModal,DDEDAC;TDlgImapModal,DE0834;TTBPopupWindow msg955,8B56EC;TShadow VMT845EA4;TCtrlShadowService VMT869BC0;TShadowService VMT89D654;TBubbleShadow VMTC5CC14')
