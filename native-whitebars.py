import sys,struct,re,json
# Fixed shared dependency; no per-project installation or global fallback.
from pathlib import Path
_workspace = next((p for p in Path(__file__).resolve().parents if (p / '_开发环境' / 'contracts' / 'portable-v1.json').is_file()), None)
if _workspace is None:
    raise RuntimeError('Restore the registered shared environment beside Foxmail')
_capstone_root = _workspace / '_开发环境' / 'tools' / 'python-libs' / 'capstone' / '5.0.9' / 'win-x64'
if not (_capstone_root / 'capstone' / '__init__.py').is_file():
    raise RuntimeError('Restore shared Capstone 5.0.9; no global fallback')
sys.path.insert(0, str(_capstone_root))
from capstone import *
b=open(r'D:\Users\Public\Downloads\Foxmail\Foxmail.exe','rb').read()
u32=lambda o:struct.unpack_from('<I',b,o)[0]
pe=u32(60);op=pe+24;base=u32(op+28);so=op+struct.unpack_from('<H',b,pe+20)[0]
sections=[]
for i in range(struct.unpack_from('<H',b,pe+6)[0]):
 p=so+40*i;sections.append((b[p:p+8].rstrip(b'\0').decode(),u32(p+12),u32(p+20),u32(p+16)))
def off(va):
 for n,r,f,s in sections:
  if base+r<=va<base+r+s:return f+va-base-r
 raise ValueError(hex(va))
def va(o):
 for n,r,f,s in sections:
  if f<=o<f+s:return base+r+o-f
 raise ValueError(hex(o))
def read(va_):return u32(off(va_))
md=Cs(CS_ARCH_X86,CS_MODE_32);md.detail=True
def dis(start,size=300):
 for i in md.disasm(b[off(start):off(start)+size],start): print(f'{i.address:08x} {i.bytes.hex():22s} {i.mnemonic:8s} {i.op_str}')
def refs(addr):
 needle=struct.pack('<I',addr);at=0;result=[]
 while True:
  at=b.find(needle,at)
  if at<0:break
  result.append(va(at));at+=1
 return result
def classes(name):
 needle=bytes([len(name)])+name.encode();at=0
 while True:
  at=b.find(needle,at)
  if at<0:break
  addr=va(at)
  for ref in refs(addr):
   vmt=ref+44
   try:
    if read(vmt-76)==vmt:yield vmt
   except:pass
  at+=1
def classname(vmt):
 o=off(read(vmt-44));return b[o+1:o+1+b[o]].decode(errors='replace')
if __name__=='__main__':
 if sys.argv[1]=='dis':dis(int(sys.argv[2],16),int(sys.argv[3],0) if len(sys.argv)>3 else 300)
 elif sys.argv[1]=='refs':print([hex(x) for x in refs(int(sys.argv[2],16))])
 elif sys.argv[1]=='class':
  for v in classes(sys.argv[2]):
   print('VMT',hex(v),classname(v),'parentref',hex(read(v-36)))
   for d in range(-76,256,4):print(hex(d),hex(read(v+d)))
