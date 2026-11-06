"""Static disassembly and exact resource/RTTI metadata; software files only."""
import json,os,sys,struct,importlib.util,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent.parent))
spec=importlib.util.spec_from_file_location('native_static',Path(__file__).parent.parent/'native-whitebars.py')
n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
assert hashlib.sha256(n.b).hexdigest()=='f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'
root=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-next';root.mkdir(exist_ok=True)
mapping=json.loads((root.parent/'version587/native-map.json').read_text())
def methods(vmt):
 p=n.read(vmt-52)
 if not p:return []
 count=struct.unpack_from('<H',n.b,n.off(p))[0];assert count<3000
 out=[];p+=2
 for _ in range(count):
  q=n.off(p);size=struct.unpack_from('<H',n.b,q)[0];assert 7<=size<=1024
  address=struct.unpack_from('<I',n.b,q+2)[0];length=n.b[q+6];assert 7+length<=size
  name=n.b[q+7:q+7+length].decode();out.append((name,address));p+=size
 return out
if sys.argv[1]=='group':
 x=next(x for x in mapping['code']if x['oldVA']==0xb6a52c)
 start=x['newVA']-0x88
 ins=list(n.md.disasm(n.b[n.off(start):n.off(start)+800],start))
 (root/'group-paint.txt').write_text('\n'.join(f'{i.address:08x} {i.bytes.hex():22s} {i.mnemonic:8s} {i.op_str}'for i in ins))
 for i in ins:
  if i.mnemonic=='call' or any(c in i.op_str for c in ['0xffffff','0xc6','0xc0c0','0xff0000']):print(hex(i.address),i.mnemonic,i.op_str)
elif sys.argv[1]=='methods':
 for cls in sys.argv[2:]:
  for v in n.classes(cls):
   print(cls,hex(v),json.dumps([(a,hex(b))for a,b in methods(v)if any(s in a.lower()for s in ['paint','draw','select','erase','create'])]))
elif sys.argv[1]=='dis':n.dis(int(sys.argv[2],16),int(sys.argv[3],0))
elif sys.argv[1]=='colors':
 start=int(sys.argv[2],16);size=int(sys.argv[3],0)
 seq=list(n.md.disasm(n.b[n.off(start):n.off(start)+size],start))
 for k,i in enumerate(seq):
  if any(x.type==2 and (x.imm&0xffffffff)in [0xffffff,0xc0c0c0,0xc6c6c6,0xff000005,0xff00000d,0xd6c7bb,0x1fffffff]for x in i.operands):
   print('---')
   for j in seq[max(0,k-2):k+4]:print(hex(j.address),j.bytes.hex(),j.mnemonic,j.op_str)
elif sys.argv[1]=='literal':
 needle=struct.pack('<I',int(sys.argv[2],16));at=0;hits=[]
 while True:
  at=n.b.find(needle,at)
  if at<0:break
  if at<0xd00000:hits.append((hex(n.va(at)),n.b[at-9:at+12].hex()))
  at+=1
 print(json.dumps(hits))
elif sys.argv[1]=='classes-near':
 center=int(sys.argv[2],16)
 for v in range(center-0x6000,center+0x6000,4):
  try:
   if n.read(v-76)==v:
    name=n.classname(v)
    if name.startswith('T') and name.replace('_','').isalnum():print(hex(v),name)
  except Exception:pass
elif sys.argv[1]=='string':
 for a in sys.argv[2:]:
  va=int(a,16);q=n.off(va);length=n.read(va-4);assert 0<length<=256
  print(hex(va),n.b[q:q+length*2].decode('utf-16-le').split('\0')[0])
elif sys.argv[1]=='dispatch':
 for v in n.classes(sys.argv[2]):
  while v:
   p=n.read(v-48);rows=[]
   if p:
    count=struct.unpack_from('<H',n.b,n.off(p))[0];assert count<4096
    for i in range(count):
     msg=struct.unpack_from('<H',n.b,n.off(p+2+2*i))[0]
     if msg in [15,20,0x85,0x317,0x318]:rows.append((hex(msg),hex(n.read(p+2+2*count+4*i))))
   print(n.classname(v),hex(v),rows)
   p=n.read(v-36);v=n.read(p)if p else 0
elif sys.argv[1]=='virtuals':
 for v in n.classes(sys.argv[2]):
  print(sys.argv[2],hex(v),'size',n.read(v-40))
  print(json.dumps([(hex(k),hex(n.read(v+k)))for k in range(0,0x70,4)]))
elif sys.argv[1]=='slot':
 slot=int(sys.argv[3],16);assert 0<=slot<=0x200 and slot%4==0
 for v in n.classes(sys.argv[2]):print(sys.argv[2],hex(v),hex(slot),hex(n.read(v+slot)))
elif sys.argv[1]=='refs-string':
 for encoding in ['ascii','utf-16le']:
  needle=sys.argv[2].encode(encoding)+b'\0'*(2 if encoding=='utf-16le'else 1);at=0
  while True:
   at=n.b.find(needle,at)
   if at<0:break
   address=n.va(at);print(encoding,hex(address),[hex(x)for x in n.refs(address)[:12]]);at+=len(needle)
elif sys.argv[1]=='png-field':
 start=n.off(0x8c0000);end=n.off(0x8c9000);needle=bytes.fromhex(sys.argv[2]);at=start
 while True:
  at=n.b.find(needle,at,end)
  if at<0:break
  print(hex(n.va(at)),n.b[max(start,at-12):at+24].hex());at+=1
