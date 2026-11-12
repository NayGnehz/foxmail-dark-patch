"""Bounded static code inspection for screenshot contrast fixes. No process access."""
import importlib.util, hashlib, struct, sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('native',Path(__file__).parent.parent/'native-whitebars.py')
n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
assert hashlib.sha256(n.b).hexdigest()=='f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'
if sys.argv[1]=='classes':
 for name in sys.argv[2:]:
  for v in n.classes(name):
   print(name,hex(v),'size',hex(n.read(v-40)))
   for kind,delta in [('methods',52),('fields',56)]:
    p=n.read(v-delta)
    if not p:continue
    count=struct.unpack_from('<H',n.b,n.off(p))[0];p+=2 if kind=='methods'else 6
    assert count<3000
    for _ in range(count):
     q=n.off(p)
     if kind=='methods':
      size=struct.unpack_from('<H',n.b,q)[0];a=n.read(p+2);length=n.b[q+6];label=n.b[q+7:q+7+length].decode();p+=size
      if any(x in label.lower()for x in ['init','creat','load','font','search','show']):print(kind,label,hex(a))
     else:
      a=n.read(p);length=n.b[q+6];label=n.b[q+7:q+7+length].decode();p+=7+length
      if any(x in label.lower()for x in ['search','edit','font']):print(kind,label,hex(a))
elif sys.argv[1]=='dis':
 for pair in sys.argv[2:]:
  va,size=[int(x,0)for x in pair.split(':')];print('FUNCTION',hex(va),size);n.dis(va,size)
elif sys.argv[1]=='field-refs':
 start,size,field=[int(x,0)for x in sys.argv[2:]]
 seq=list(n.md.disasm(n.b[n.off(start):n.off(start)+size],start))
 hits=set()
 for k,i in enumerate(seq):
  if any(o.type==3 and o.mem.disp==field for o in i.operands):
   for j in range(max(0,k-4),min(len(seq),k+10)):hits.add(j)
 for j in sorted(hits):
  i=seq[j];print(f'{i.address:08x} {i.bytes.hex():22s} {i.mnemonic:8s} {i.op_str}')
elif sys.argv[1]=='field-bytes':
 start,size,field=[int(x,0)for x in sys.argv[2:]]
 raw=n.off(start);needle=struct.pack('<I',field);at=raw
 while True:
  at=n.b.find(needle,at,raw+size)
  if at<0:break
  va=n.va(at-2);print('FIELD',hex(va),n.b[at-10:at].hex());n.dis(va,65);at+=4