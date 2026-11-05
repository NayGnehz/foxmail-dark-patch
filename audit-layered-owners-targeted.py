exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
vmts=[]
for name,r,f,z in n.sections:
 for o in range(f,f+z-80,4):
  a=n.va(o)+76
  if n.u32(o)!=a:continue
  try:
   name=n.classname(a)
   if name.startswith('T') and name.isidentifier() and len(name)<100 and 0x840000<a<0x8c0000:vmts.append((a,name))
  except:pass
print('COUNT',len(vmts))
ranges=[(0x842000,0x843000),(0x848000,0x848700),(0x86a000,0x86a700),(0x89dd00,0x89e600),(0xc5d500,0xc5df00),(0x8b5000,0x8b5900)]
for v,name in vmts:
 hits=[]
 try:
  for k in range(-24,0x200,4):
   a=n.read(v+k)
   if any(lo<=a<hi for lo,hi in ranges):hits.append((hex(k),hex(a)))
  for msg,a in dyn(v):
   if any(lo<=a<hi for lo,hi in ranges):hits.append(('msg'+hex(msg),hex(a)))
 except:pass
 if hits:print(name,hex(v),hits)
