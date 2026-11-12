"""Bounded static code inspection for screenshot contrast fixes. No process access."""
import importlib.util, hashlib, struct, sys, os
from pathlib import Path
os.environ['FOXMAIL_STATIC_EXE']=str(Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-guard-wsb-7da1a592/guest-input/Foxmail/Foxmail.exe')
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
      if any(x in label.lower()for x in ['init','creat','load','font','search','show','paint','draw','erase']):print(kind,label,hex(a))
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
elif sys.argv[1]=='published':
 for name in sys.argv[2:]:
  needle=bytes([len(name)])+name.encode();at=0
  while True:
   at=n.b.find(needle,at)
   if at<0:break
   print(name,hex(n.va(at)),hex(n.u32(at-4)));at+=len(needle)
elif sys.argv[1]=='vmt':
 for name in sys.argv[2:]:
  for v in n.classes(name):
   print(name,hex(v),'parent',n.classname(n.read(n.read(v-36))))
   for i in range(0,0x80,4):print(hex(i),hex(n.read(v+i)))
elif sys.argv[1]=='fields':
 for v in n.classes(sys.argv[2]):
  p=n.read(v-56);count=struct.unpack_from('<H',n.b,n.off(p))[0];p+=6
  for _ in range(count):
   q=n.off(p);a=n.read(p);length=n.b[q+6];name=n.b[q+7:q+7+length].decode();p+=7+length
   print(name,hex(a))
elif sys.argv[1]=='near':
 center=int(sys.argv[2],0)&~3
 for v in range(center-0x4000,center+0x4000,4):
  try:
   if n.read(v-76)==v:print(hex(v),n.classname(v))
  except (ValueError,UnicodeDecodeError,struct.error):pass
elif sys.argv[1]=='literal':
 start,size,color=[int(x,0)for x in sys.argv[2:]];raw=n.off(start);at=raw
 while True:
  at=n.b.find(struct.pack('<I',color),at,raw+size)
  if at<0:break
  if n.b[at-1] in (0x68,0xba,0xb9,0xb8):n.dis(n.va(at-1),26)
  at+=4
elif sys.argv[1]=='properties':
 names=set(sys.argv[3:])
 for v in n.classes(sys.argv[2]):
  while v:
   ti=n.read(v-60)
   if ti:
    p=n.off(ti);assert n.b[p]==7
    q=p+2+n.b[p+1];assert n.u32(q)==v
    own=q+11+n.b[q+10];count=struct.unpack_from('<H',n.b,own)[0];p=own+2;assert count<1000
    for _ in range(count):
     length=n.b[p+26];name=n.b[p+27:p+27+length].decode();assert length<128
     if not names or name in names:print(n.classname(v),name,'get',hex(n.u32(p+4)),'set',hex(n.u32(p+8)))
     p+=27+length
   parent=n.read(v-36);v=n.read(parent)if parent else 0
elif sys.argv[1]=='dispatch':
 message=int(sys.argv[3],0)
 for v in n.classes(sys.argv[2]):
  while v:
   table=n.read(v-48)
   if table:
    count=struct.unpack_from('<H',n.b,n.off(table))[0];assert count<4096
    for i in range(count):
     value=struct.unpack_from('<H',n.b,n.off(table+2+2*i))[0]
     if value==message:print(n.classname(v),hex(v),hex(message),hex(n.read(table+2+2*count+4*i)))
   parent=n.read(v-36);v=n.read(parent)if parent else 0
