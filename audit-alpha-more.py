exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
for a,z in [(0x8b56b0,125),(0xa13d2c,24),(0xdcde94,140),(0xa1b684,155),(0x8429d0,100)]:print('RANGE',hex(a));n.dis(a,z)
print('VMT Tab methods')
v=0xa13d2c
for k in range(0,0x170,4):
 a=n.read(v+k)
 if 0xa13000<=a<0xa1d000:print(hex(k),hex(a))
