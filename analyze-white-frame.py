import importlib.util,pathlib,sys
spec=importlib.util.spec_from_file_location('native',pathlib.Path(__file__).with_name('native-whitebars.py'))
n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
if len(sys.argv)>1 and sys.argv[1]=='chain':
 for name in sys.argv[2:]:
  for v in n.classes(name):
   while v:
    print(hex(v),n.classname(v),'DMT',hex(n.read(v-48)))
    p=n.read(v-36);v=n.read(p) if p else 0
 sys.exit()
if len(sys.argv)>1 and sys.argv[1]=='near':
 start=int(sys.argv[2],16)
 data=n.b[n.off(start):n.off(start)+1024]
 for m in n.re.finditer(rb'[A-Za-z_][A-Za-z0-9_]{3,}',data):print(hex(start+m.start()),m.group().decode())
 for a in range(start,start+256,16):print(hex(a),n.b[n.off(a):n.off(a)+16].hex())
 sys.exit()
if len(sys.argv)>1 and sys.argv[1]!='calls':
 for a in sys.argv[1:]:n.dis(int(a,16),340)
 sys.exit()
import struct
def calls(target):
 out=[]
 for name,r,f,s in n.sections:
  if name!='CODE':continue
  p=f
  while True:
   p=n.b.find(b'\xe8',p,f+s)
   if p<0:break
   addr=n.va(p)
   if addr+5+struct.unpack_from('<i',n.b,p+1)[0]==target:out.append(addr)
   p+=1
 return out
if len(sys.argv)>1 and sys.argv[1]=='calls':
 for a in sys.argv[2:]: print(a,[hex(x) for x in calls(int(a,16))])
 sys.exit()
for label,iat in [('DrawEdge',15706416),('FrameRect',15706320),('DrawFrameControl',15706408)]:
 refs=n.refs(iat+0x400000)
 print(label,'IAT refs',[hex(x) for x in refs])
 for x in refs:
  if n.b[n.off(x)-2:n.off(x)]==b'\xff\x25': print('THUNK',hex(x-2),'CALLS',[hex(x) for x in calls(x-2)])
print('Frame3D colors');n.dis(0x66d4c4,64)
print('Frame3D helper');n.dis(0x66bd94,420)
