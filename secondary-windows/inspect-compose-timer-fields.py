exec(open(r'D:\Workspace\Foxmail\secondary-windows\inspect-compose-delayed-paths.py',encoding='utf-8-sig').read().split('for a in [')[0])
for v in [0x669CB0,0x89F9F0,0x8A0C50,0xA1DB24]:print(n.classname(v),hex(v),'instanceSize',hex(n.read(v-40)))
for a,z in [(0x66CDAC,0x90),(0x66D0F8,0x2c),(0x66D124,0x2c)]:print('ROUTINE',hex(a));n.dis(a,z)
