import importlib.util,struct,pathlib
s=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
def dyn(v):
 p=n.read(v-48)
 if not p:return []
 o=n.off(p);cnt=struct.unpack_from('<H',n.b,o)[0]
 return [(struct.unpack_from('<H',n.b,o+2+i*2)[0],struct.unpack_from('<I',n.b,o+2+2*cnt+4*i)[0]) for i in range(cnt)]
for first in [0xa92008,0xa90898]:
 v=first;print('CHAIN',hex(v))
 while v:
  print(n.classname(v),hex(v),'dyn',hex(n.read(v-48)))
  for msg,addr in dyn(v):
   if msg in [0xf,0x14,0x317,0x318,0x18,0x85,0x400+1] or 0x300<=msg<0x320:print(hex(msg),hex(addr))
  pr=n.read(v-36);v=n.read(pr) if pr else 0
print('Native strings')
for word in ['PrintWindow','AnimateWindow','WM_PRINT','UpdateLayeredWindow','SetLayeredWindowAttributes','DrawThemeParentBackground']:
 at=n.b.find(word.encode());print(word,hex(n.va(at)) if at>=0 else 'absent',list(map(hex,n.refs(n.va(at)))) if at>=0 else [])
