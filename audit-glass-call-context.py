exec(open('audit-layered-owners.py',encoding='utf-8-sig').read().split("print('COUNT'")[0])
for v,name in vmts:
 if name.startswith('T') and name.isidentifier() and (0xddd000<v<0xde1000 or 0xc5c000<v<0xc5dd00):print(hex(v),name)
for call in [0xa18134,0xa50af3]:
 o=n.off(call);at=n.b.rfind(b'\x55\x8b\xec',o-600,o);a=n.va(at);print('RANGE',hex(a));n.dis(a,call-a+45)
