exec(open('audit-print-dispatch.py',encoding='utf-8-sig').read().split('for first')[0])
for v in [0xa92008,0xa90898,0x874ab4,0x87491c,0x6a23e0,0x6a1b50,0x1125318]:print(n.classname(v),'default',hex(n.read(v-16)),'wndproc',hex(n.read(v+0x70)))
for a,z in [(0x112ff68,260),(0x11345d8,80)]:print('RANGE',hex(a));n.dis(a,z)
