"""Fixed software comparison at one crash function; no process/dump/user data."""
import importlib.util,hashlib,json,os,struct,uuid
from pathlib import Path
source=Path(__file__).parent.parent/'native-whitebars.py'
spec=importlib.util.spec_from_file_location('crash_software',source)
n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
assert hashlib.sha256(n.b).hexdigest()=='f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'
current=(Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-account-right-inset/Foxmail深色.exe').read_bytes()
assert hashlib.sha256(current).hexdigest()=='540cf174a53e319529605b0cb3e171550783a6fe6455d29d16e5bc410f6d1f33'
pe=struct.unpack_from('<I',current,60)[0]
print('largeAddressAware',bool(struct.unpack_from('<H',current,pe+22)[0]&0x20))
start,end=0x9662f0,0x966424
a,b=n.b[n.off(start):n.off(end)],current[n.off(start):n.off(end)]
print(json.dumps({'start':hex(start),'endExclusive':hex(end),'originalSHA256':hashlib.sha256(a).hexdigest(),'currentSHA256':hashlib.sha256(b).hexdigest(),'equal':a==b,'changedVAs':[hex(start+i)for i in range(len(a))if a[i]!=b[i]],'entryPointerReferences':[hex(x)for x in n.refs(start)]}))
for cls in ['TVirtualTreeAccessibility','TVirtualTreeItemAccessibility','TVTDefaultAccessibleProvider','TVTDefaultAccessibleItemProvider']:
 v,=n.classes(cls)
 matches=[]
 for offset in range(-16,0x120,4):
  if n.read(v+offset)==start:matches.append(hex(offset))
 table=n.read(v-72);print(cls,hex(v),'matchingVirtualSlots',matches,'interfaceTable',hex(table))
 print('lifetime',cls,'size',n.read(v-40),'destroy',hex(n.read(v-4)),'vmtReferences',[hex(x)for x in n.refs(v)],'classRefReferences',[hex(x)for x in n.refs(v-76)])
 if table:
  count=n.read(table);assert count<100
  for i in range(count):
   entry=table+4+i*28;vt=n.read(entry+16)
   try:
    for slot in range(40):
     target=n.read(vt+slot*4)
     if not 0x400000<=target<0x1200000:continue
     ins=list(n.md.disasm(n.b[n.off(target):n.off(target)+20],target))[:4]
     for j,x in enumerate(ins):
      if x.mnemonic=='jmp':ins=ins[:j+1];break
     if target==start or any(x.mnemonic=='jmp'and any(op.type==2 and op.imm==start for op in x.operands)for x in ins):print('matching-interface',cls,'iid',str(uuid.UUID(bytes_le=n.b[n.off(entry):n.off(entry)+16])),'entry',hex(entry),'vtable',hex(vt),'slot',slot,'interfaceOffset',n.read(entry+20),'thunk',hex(target),'ins',[(x.mnemonic,x.op_str)for x in ins])
   except ValueError:pass
