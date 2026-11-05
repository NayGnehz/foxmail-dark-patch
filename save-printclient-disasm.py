exec(open('audit-print-dispatch.py',encoding='utf-8-sig').read().split('for first')[0])
import contextlib
with open('audit-printclient-native-route.disasm.txt','w',encoding='utf8') as out,contextlib.redirect_stdout(out):
 for a,z in [(0x11345d8,80),(0x11300d4,50),(0x112feac,52),(0x408888,6),(0xa934c0,70)]:
  print('RANGE',hex(a));n.dis(a,z)
 for v in [0xa92008,0xa90898,0x1125318]:
  print(n.classname(v),hex(v),'PaintWindow',hex(n.read(v+0xb8)),'DefaultHandler',hex(n.read(v-16)))
