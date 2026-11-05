exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
for a,z in [(0x842ad0,160),(0x842bc0,150),(0x8482a0,160),(0x86a550,145),(0x89e270,140),(0xc5daa0,140),(0x882c20,95),(0x111e12c,110)]:print('RANGE',hex(a));n.dis(a,z)
