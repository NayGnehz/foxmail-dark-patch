exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
for a,z in [(0xa180a0,200),(0xa0cb4c,230),(0xddea20,120),(0xde0460,160)]:print('RANGE',hex(a));n.dis(a,z)
for x in [0xddea53,0xde04db]:print('REFS',hex(x),list(map(hex,n.refs(x))),'CALLS',list(map(hex,calls(x))))
