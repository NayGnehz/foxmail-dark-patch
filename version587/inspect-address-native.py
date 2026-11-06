"""Address-list paint mapping: only verified static software binaries."""
import os,json,hashlib,importlib.util,struct
from pathlib import Path
spec=importlib.util.spec_from_file_location('address_static_map',Path(__file__).with_name('map-native.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
assert os.environ['FOXMAIL_PIPELINE_LEASE']==os.environ['PORTABLE_INSTANCE_ROOT']
stage=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-address-native';stage.mkdir(exist_ok=True)
current=Path(r'D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe').read_bytes()
expected='233e7bdfb5f0d3e688a46b7e9eccbed3572795b5312e7d5c810ad4a8b1b387c6'
assert hashlib.sha256(current).hexdigest()==expected
rows=[];errors=[];text=[]
for va,size,label in [(0xbdcd9c,0x220,'member-list-header'),(0xbdb918,0x500,'member-list-constructor'),(0xbebb4c,0x120,'chooser-panel-header'),(0xbdce62,24,'header-bottom-pen'),(0xbdced2,24,'header-column-pen'),(0xbebbda,24,'chooser-header-pen')]:
 try:
  row=m.map_code(va);start=row['newVA'];data=m.new[m.off(start,m.ns):m.off(start,m.ns)+size];now=current[m.off(start,m.ns):m.off(start,m.ns)+size]
  row.update(label=label,size=size,originalBytes=data.hex(),currentBytes=now.hex());rows.append(row)
  text.append('\n'+label+' '+hex(va)+' -> '+hex(start))
  text.extend(f'{i.address:08x} {i.bytes.hex():24s} {i.mnemonic:8s} {i.op_str}'for i in m.instructions(m.new,start,m.ns,size))
 except Exception as e:errors.append(label+': '+str(e))
vmts=[]
for va in (0xbdb248,):
 try:vmts.append(m.map_vmt(va))
 except Exception as e:errors.append(str(e))
(stage/'paint-map.json').write_text(json.dumps(dict(currentSHA256=expected,code=rows,vmt=vmts,errors=errors),indent=2))
(stage/'paint-disasm.txt').write_text('\n'.join(text))
print(json.dumps(dict(code=[(x['label'],hex(x['newVA']))for x in rows],vmt=vmts,errors=errors)))
spec=importlib.util.spec_from_file_location('address_rtti',Path(__file__).parent.parent/'native-whitebars.py')
n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
published=[]
for name in ('TAddrMember','TAddrFolder','TAddressAppFrame','TAddrMemberListLoader','TDlg_SelAddr'):
 for v in n.classes(name):
  methods=[];p=n.read(v-52)
  if p:
   count=struct.unpack_from('<H',n.b,n.off(p))[0];p+=2;assert count<3000
   for _ in range(count):
    q=n.off(p);size=struct.unpack_from('<H',n.b,q)[0];a=n.read(p+2);length=n.b[q+6];assert 7+length<=size
    label=n.b[q+7:q+7+length].decode()
    if any(s in label.lower()for s in ('paint','draw','create')):methods.append(dict(name=label,va=a))
    p+=size
  published.append(dict(className=name,vmt=v,methods=methods))
extra=[];lines=[]
targets=[(0xbdd318,0x84,'loader callback +588'),(0xbdd39c,0x2e8,'loader callback +580'),(0xbdd684,0x84,'loader callback +590'),(0xbdd708,0x158,'loader callback +6F8')]
targets += [(x['va'],0x180,r['className']+'.'+x['name'])for r in published for x in r['methods']if x['name'] in ('FrameCreate','FormCreate','vdtPaintBackground')]
for a,size,label in targets:
 data=n.b[n.off(a):n.off(a)+size];extra.append(dict(newVA=a,size=size,label=label,originalBytes=data.hex(),currentBytes=current[n.off(a):n.off(a)+size].hex()))
 lines.append('\n'+label+' '+hex(a));lines.extend(f'{i.address:08x} {i.bytes.hex():24s} {i.mnemonic:8s} {i.op_str}'for i in m.instructions(m.new,a,m.ns,size))
(stage/'published-methods.json').write_text(json.dumps(published,indent=2));(stage/'callbacks.json').write_text(json.dumps(extra,indent=2));(stage/'callbacks-disasm.txt').write_text('\n'.join(lines))
print(json.dumps(published))
