exec(open('audit-print-dispatch.py',encoding='utf-8-sig').read().split('for first')[0])
for v in [0xa92008,0xa90898,0x6a23e0,0x6a1b50,0x1125318]:print(n.classname(v),'PaintWindow',hex(n.read(v+0xb8)))
for a,z in [(0x112fd98,250),(n.read(0xa92008+0xb8),260),(0x1130070,145)]:print('RANGE',hex(a));n.dis(a,z)
