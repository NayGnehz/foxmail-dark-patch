exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
for a,z in [(0x887f50,125),(0x889108,145),(0xa07890,95),(0xbb7510,65),(0xcd42b0,120)]:print('RANGE',hex(a));n.dis(a,z)
