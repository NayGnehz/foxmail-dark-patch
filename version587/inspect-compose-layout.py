"""Read-only 563-to-587 compose layout mapping; no process or user-data reads."""
import importlib.util, os, json
from pathlib import Path
spec=importlib.util.spec_from_file_location('layout_static_map',Path(__file__).with_name('map-native.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
root=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-goal'
assert os.environ['FOXMAIL_PIPELINE_LEASE']==os.environ['PORTABLE_INSTANCE_ROOT']
rows=[];lines=[]
for old,size,label,onlycalls in [(0xD13260,0x39C,'FormShow',False),(0xD1210C,0x4BF,'FormCreate exact routine calls',True),(0xD15444,0xC7,'CreateParams vslot98',False),(0xA2CDCC,0x69,'FormShow layout helper',False)]:
 mapped=m.map_code(old);rows.append(dict(label=label,**mapped));new=mapped['newVA']
 lines.append('\n'+label+' '+hex(old)+' -> '+hex(new)+' normalized='+str(mapped['normalizedInstructions']))
 for i in m.instructions(m.new,new,m.ns,size):
  if not onlycalls or i.mnemonic in ('call','ret','jmp'):
   lines.append(f'{i.address:08x} {i.bytes.hex():22s} {i.mnemonic:8s} {i.op_str}')
(root/'compose-layout-map.json').write_text(json.dumps(rows,indent=2))
(root/'compose-layout-disasm.txt').write_text('\n'.join(lines))
print(json.dumps({'mapping':[(x['label'],hex(x['oldVA']),hex(x['newVA']),x['normalizedInstructions'])for x in rows], 'report':str(root/'compose-layout-disasm.txt')}))
