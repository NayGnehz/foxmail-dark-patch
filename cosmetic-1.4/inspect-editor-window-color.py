import importlib.util,struct
s=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
for text in ['J2D_GetWindowColor','GetWindowColor']:
 needle=text.encode('utf-16le');at=n.b.find(needle)
 while at>=0:
  a=n.va(at);print(text,hex(a),'refs',list(map(hex,n.refs(a))));at=n.b.find(needle,at+1)
