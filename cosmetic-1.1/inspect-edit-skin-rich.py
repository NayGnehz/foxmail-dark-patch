import importlib.util,struct
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
n.b=open('reveal-gate-v2/Foxmail-dark-reveal.exe','rb').read()
for name in ['TFMZRichEdit','TZRichEdit','TZCustomRichEdit']:
 for v in n.classes(name):
  print('CLASS',name,hex(v),'parent',n.classname(n.read(n.read(v-36))))
  print('ctor',hex(n.read(v+0x2c)),'createwnd',hex(n.read(v+0xa0)))
  d=n.read(v-48)
  if d:
   o=n.off(d);c=struct.unpack_from('<H',n.b,o)[0]
   for i in range(c):print('msg',hex(struct.unpack_from('<H',n.b,o+2+2*i)[0]),hex(struct.unpack_from('<I',n.b,o+2+c*2+4*i)[0]))
for start,size in [(0x87b3bc,950),(0x87ba8c,900),(0xb27e28,180)]:print('\nROUTE',hex(start));n.dis(start,size)
