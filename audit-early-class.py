exec(open('audit-print-dispatch.py',encoding='utf-8-sig').read().split('for first')[0])
for v in [0xa92008,0xa90898,0x87491c,0x6a23e0,0x6a2cd8,0x6a1b50,0x1125318]:
 print(n.classname(v),'createparams',hex(n.read(v+0x30)))
for needle in [b'BUTTON\0',b'Button\0',b'B\0U\0T\0T\0O\0N\0\0\0']:
 at=n.b.find(needle);print(needle,hex(n.va(at)) if at>=0 else '',list(map(hex,n.refs(n.va(at)))) if at>=0 else '')
