import importlib.util,struct
spec=importlib.util.spec_from_file_location('native', 'native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
for v in n.classes('TOptionForm'):
 print('VMT',hex(v))
 t=n.read(v-52);o=n.off(t);count=struct.unpack_from('<H',n.b,o)[0];o+=2
 for i in range(count):
  size,addr=struct.unpack_from('<HI',n.b,o);ln=n.b[o+6];name=n.b[o+7:o+7+ln].decode('latin1')
  print(name,hex(addr))
  if name=='OnOptionTypesBtnClick':n.dis(addr,260)
  o+=size
