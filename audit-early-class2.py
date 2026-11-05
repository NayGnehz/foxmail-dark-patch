exec(open('audit-print-dispatch.py',encoding='utf-8-sig').read().split('for first')[0])
for v in [0xa92008,0xa90898,0x87491c,0x6a23e0,0x6a2cd8,0x6a1b50,0x1125318]:print(n.classname(v),'CreateParams',hex(n.read(v+0x98)))
n.dis(0x87a278,110)
