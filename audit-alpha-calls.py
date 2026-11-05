exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
for a,z in [(0xa0c150,245),(0xa50a80,145),(0x848400,110),(0xa1b3d4,260)]:print('RANGE',hex(a));n.dis(a,z)
