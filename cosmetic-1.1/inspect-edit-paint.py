import importlib.util,struct,json
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
n.b=open('reveal-gate-v2/Foxmail-dark-reveal.exe','rb').read()
for name in ['TFMEdit','TUnicodeEdit','TTntCustomEdit','TCustomEdit','TWinControl','TSearchEdit','TFMSearchEdit']:
 for v in n.classes(name):
  print('\nCLASS',name,hex(v),'PARENT',n.classname(n.read(n.read(v-36))))
  d=n.read(v-48)
  if d:
   o=n.off(d);count=struct.unpack_from('<H',n.b,o)[0]
   for i in range(count):
    msg=struct.unpack_from('<H',n.b,o+2+i*2)[0];addr=struct.unpack_from('<I',n.b,o+2+count*2+i*4)[0]; print('MESSAGE',hex(msg),hex(addr))
  if name in ['TFMEdit','TCustomEdit','TTntCustomEdit']:
   for addr in [n.read(v+0x2c),n.read(v+0x9c),n.read(v+0xa0)]:n.dis(addr,230)
