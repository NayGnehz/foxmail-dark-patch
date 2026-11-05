exec(open('audit-print-dispatch.py',encoding='utf-8-sig').read().split('for first')[0])
exec(open('audit-fill-imports.py',encoding='utf-8').read().split('for name,iat')[0].split('def calls')[1].join(['def calls','']))
def cstr(o):return n.b[o:n.b.find(b'\0',o)].decode('ascii')
d=n.off(n.base+n.u32(n.op+104))
while n.u32(d+12):
 iat=n.u32(d+16);t=n.off(n.base+(n.u32(d) or iat));i=0
 while n.u32(t+4*i):
  v=n.u32(t+4*i)
  if v<0x80000000:
   name=cstr(n.off(n.base+v)+2)
   if name in ['AlphaBlend','UpdateLayeredWindow','SetLayeredWindowAttributes']:
    print('IMPORT',name,hex(n.base+iat+i*4))
    for ref in n.refs(n.base+iat+i*4):
     if n.b[n.off(ref)-2:n.off(ref)]==b'\xff\x25':print('THUNK',hex(ref-2),'calls',list(map(hex,calls(ref-2))))
  i+=1
 d+=20
for x in [0x12ea1a4,0x111e05c,0x111e090,0x111df60]:print('REFS',hex(x),list(map(hex,n.refs(x))),'calls',list(map(hex,calls(x))))
for name in ['TOptionForm','TTabForm','TFoxmailMainForm','TMainForm']:
 for v in n.classes(name):
  print('CLASS',name,hex(v));seen=set()
  while v and v not in seen:
   seen.add(v);print('PARENT',n.classname(v),hex(v));pr=n.read(v-36);v=n.read(pr) if pr else 0
