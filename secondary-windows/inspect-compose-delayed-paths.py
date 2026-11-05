import importlib.util,pathlib,struct
r=pathlib.Path(r'D:\Workspace\Foxmail');s=importlib.util.spec_from_file_location('n',r/'native-whitebars.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
def api(a):
 o=n.off(a); x=n.b[o:o+6]
 if x[:2]!=b'\xff\x25':return x.hex()
 slot=struct.unpack_from('<I',x,2)[0]; dirs=n.op+96; imp=struct.unpack_from('<I',n.b,dirs+8)[0];p=n.off(n.base+imp)
 while any(n.b[p:p+20]):
  orig,_,_,name,thunk=struct.unpack_from('<IIIII',n.b,p);q=n.off(n.base+name);lib=n.b[q:n.b.index(0,q)].decode();i=0
  while n.read(n.base+(orig or thunk)+i*4):
   if n.base+thunk+i*4==slot:
    v=n.read(n.base+(orig or thunk)+i*4);q=n.off(n.base+v)+2;return lib+'!'+n.b[q:n.b.index(0,q)].decode()
   i+=1
  p+=20
 return hex(slot)
for a in [0x408e18]:print('API',hex(a),api(a))
for a,z in [(0x66D054,164),(0x1132CE8,80),(0xA1ECF0,110),(0xB999C0,110),(0xB8AA1C,108),(0x111D5A4,120)]:
 print('ROUTINE',hex(a));n.dis(a,z)
