import importlib.util
s=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
for v in [0xb946f0,0xb83760]:print(hex(v),n.classname(v),'size',hex(n.read(v-40)),'self',hex(n.read(v-76)))
for name in ['TFoxChromium','TCEFWindowParent']:
 for v in n.classes(name):print(hex(v),name,'size',hex(n.read(v-40)))
