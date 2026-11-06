"""Map numeric-only probe dependencies using static code windows and exact RTTI."""
import importlib.util,json,os,struct
from pathlib import Path
spec=importlib.util.spec_from_file_location('static_map',Path(__file__).with_name('map-native.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
root=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-goal';root.mkdir(exist_ok=True)
result={'atoms':[],'vmt':[]}
for oldrva in [0xef91b6,0xef91b4,0xef5b80,0xef5b7e]:
 atom=oldrva+0x400000;needle=struct.pack('<I',atom);at=0;hits=[]
 while True:
  at=m.old.find(needle,at)
  if at<0:break
  if at>=m.os_[0][3]+m.os_[0][2]:break
  start=None
  if m.old[at-3:at-1] in [b'\x0f\xb7',b'\x66\x8b']and m.old[at-1]&0xc7==5:start=at-3
  elif m.old[at-2:at]==b'\x66\xa1':start=at-2
  if start is not None:
   oldva=0x400000+m.os_[0][1]+start-m.os_[0][3]
   try:
    mapped=m.map_code(oldva);ins=m.instructions(m.new,mapped['newVA'],m.ns)[0]
    absolute=[o.mem.disp for o in ins.operands if o.type==m.CS_OP_MEM and not o.mem.base and not o.mem.index]
    if len(absolute)==1:hits.append({'oldInstructionVA':oldva,'newInstructionVA':mapped['newVA'],'newAtomRVA':absolute[0]-0x400000,'normalizedInstructions':mapped['normalizedInstructions']})
   except RuntimeError:pass
  at+=1
 assert hits,hex(oldrva)
 assert len(set(x['newAtomRVA']for x in hits))==1
 result['atoms'].append({'oldRVA':oldrva,'newRVA':hits[0]['newAtomRVA'],'proofs':hits})
for oldrva in [0x7946f0,0x783760,0x776ae0,0x74f564,0x766e08,0x76a284]:result['vmt'].append(m.map_vmt(oldrva+0x400000))
(root/'canvas-map.json').write_text(json.dumps(result,indent=2))
print(json.dumps({'atoms':[(hex(x['oldRVA']),hex(x['newRVA']),len(x['proofs']))for x in result['atoms']],'classes':[(x['className'],hex(x['newVA']),x['size'])for x in result['vmt']]}))
