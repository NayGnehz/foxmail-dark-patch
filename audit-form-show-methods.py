exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
for name in ['TTabForm','TOptionForm']:
 for v in n.classes(name):
  print('CLASS',name,hex(v),'methodTable',hex(n.read(v-52)))
  t=n.read(v-52)
  if t:
   o=n.off(t);cnt=struct.unpack_from('<H',n.b,o)[0];o+=2
   for i in range(cnt):
    size,a=struct.unpack_from('<HI',n.b,o);ln=n.b[o+6];print(n.b[o+7:o+7+ln].decode('latin1'),hex(a));o+=size
  print('dynamic',[(hex(x),hex(y))for x,y in dyn(v)])
print('CALL832?',list(map(hex,calls(0x842bd4))))
