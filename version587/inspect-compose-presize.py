"""Read-only static presize feasibility; exact original software input only."""
import importlib.util, os, json, sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('presize_static_map',Path(__file__).with_name('map-native.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
root=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-goal'
assert os.environ['FOXMAIL_PIPELINE_LEASE']==os.environ['PORTABLE_INSTANCE_ROOT']
rows=[];lines=[]
def emit(new,size,label):
 data=m.new[m.off(new,m.ns):m.off(new,m.ns)+size]
 lines.append('\n'+label+' '+hex(new)+' size='+hex(size))
 for i in m.instructions(m.new,new,m.ns,size):lines.append(f'{i.address:08x} {i.bytes.hex():22s} {i.mnemonic:8s} {i.op_str}')
 return data.hex()
if len(sys.argv)>1:
 assert sys.argv[1]=='dis'
 for arg in sys.argv[2:]:
  address,size=map(lambda x:int(x,0),arg.split(':'));rows.append(dict(newVA=address,size=size,bytes=emit(address,size,'verified-new-address')))
else:
 for old,size,label in [(0xD1E13C,0x106,'save-layout'),(0xD25FE8,0x18,'FormResize'),(0x11299AC,0x80,'Width and Height setters'),(0xD24C74,0x1E,'mode predicate'),(0x111D5A4,0x1C,'Show'),(0x10ED9B8,0x21,'normal Width getter'),(0x10ED928,0x21,'normal Height getter'),(0x10ED970,0x21,'normal WindowState getter')]:
  try:
   mapped=m.map_code(old,7 if old==0x111D5A4 else 0);new=mapped['newVA'];rows.append(dict(label=label,size=size,bytes=emit(new,size,label),**mapped))
  except Exception as ex:rows.append(dict(label=label,oldVA=old,error=str(ex)))
(root/('compose-presize-extra-map.json' if len(sys.argv)>1 else 'compose-presize-map.json')).write_text(json.dumps(rows,indent=2))
(root/('compose-presize-extra-disasm.txt' if len(sys.argv)>1 else 'compose-presize-disasm.txt')).write_text('\n'.join(lines))
print(json.dumps({'mapping':[(x.get('label'),hex(x.get('oldVA',0)),hex(x.get('newVA',0)),x.get('error'))for x in rows], 'report':str(root/('compose-presize-extra-disasm.txt' if len(sys.argv)>1 else 'compose-presize-disasm.txt'))}))


