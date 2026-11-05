exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
for x in [0x12f6ac0,0x12f6ac4,0x12f6ac8,0x12f6acc,0x12f6ad0,0x12f6ad4]:print('REFS',hex(x),list(map(hex,n.refs(x))))
for a,z in [(0xa1a3e8,44),(0xddedac,100),(0xde0834,100)]:print('RANGE',hex(a));n.dis(a,z)
for v in [0xdde8e4,0xde036c]:
 print('CLASS',n.classname(v));t=n.read(v-52);o=n.off(t);cnt=struct.unpack_from('<H',n.b,o)[0];o+=2
 for i in range(cnt):
  size,a=struct.unpack_from('<HI',n.b,o);ln=n.b[o+6];print(n.b[o+7:o+7+ln].decode('latin1'),hex(a));o+=size
for m in re.finditer(b'dwm',n.b,re.I):
 a=n.va(m.start());print('DWMSTR',hex(a),n.b[m.start():m.start()+70],list(map(hex,n.refs(a))))
