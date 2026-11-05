exec(open('audit-print-dispatch.py',encoding='utf-8-sig').read().split('for first')[0])
op=n.op
def cstr(o):return n.b[o:n.b.find(b'\0',o)].decode('ascii')
r=n.u32(op+104);d=n.off(n.base+r)
while n.u32(d+12):
 dll=cstr(n.off(n.base+n.u32(d+12)));iat=n.u32(d+16);t=n.off(n.base+(n.u32(d) or iat));i=0
 while n.u32(t+4*i):
  v=n.u32(t+4*i)
  if v<0x80000000:
   name=cstr(n.off(n.base+v)+2)
   if name in ['CallWindowProcA','CallWindowProcW','DefWindowProcA','DefWindowProcW','SendMessageA','SendMessageW']:print(name,'IAT',hex(n.base+iat+4*i))
  i+=1
 d+=20
