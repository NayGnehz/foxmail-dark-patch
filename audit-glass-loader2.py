exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
import re
for a,z in [(0xa0ca08,174),(0xa0cae8,100),(0xa1b598,55),(0xddedac,200),(0xde0834,150)]:print('RANGE',hex(a));n.dis(a,z)
for m in re.finditer(b'dwm',n.b,re.I):
 a=n.va(m.start());print('DWMSTR',hex(a),repr(n.b[m.start():m.start()+60]),list(map(hex,n.refs(a))))
