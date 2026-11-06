"""Exact 587 load-completion route, software bytes only; no process/user data."""
import importlib.util, os, json, struct
from pathlib import Path
spec=importlib.util.spec_from_file_location('ready_static_map',Path(__file__).with_name('map-native.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
root=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-goal'
assert os.environ['FOXMAIL_PIPELINE_LEASE']==os.environ['PORTABLE_INSTANCE_ROOT']
rows=[];lines=[]
for old,size,label in [(0xB88FA8,0x6A,'align-host-and-post-WM_SIZE'),(0xB8AA1C,0x3D,'loadEnd324 and callbacks'),(0xB83F4C,0x70,'main-nonblank-frame load-end'),(0xB999C0,0x55,'TFoxHTMLEditor virtual E4'),(0x1132F68,0x30,'host Handle getter')]:
 mapped=m.map_code(old);new=mapped['newVA'];data=m.new[m.off(new,m.ns):m.off(new,m.ns)+size]
 rows.append(dict(label=label,size=size,bytes=data.hex(),**mapped));lines.append('\n'+label+' '+hex(old)+' -> '+hex(new))
 for i in m.instructions(m.new,new,m.ns,size):lines.append(f'{i.address:08x} {i.bytes.hex():22s} {i.mnemonic:8s} {i.op_str}')
(root/'compose-ready-map.json').write_text(json.dumps(rows,indent=2));(root/'compose-ready-disasm.txt').write_text('\n'.join(lines))
print(json.dumps({'mapping':[(x['label'],hex(x['oldVA']),hex(x['newVA']))for x in rows]}))

# Follow only the known editor/CEF code ranges.  The scanned immediates are
# software field offsets, never live pointers or user strings.
extra=[]
for start,size,label in [(0xB842B0,0x75,'complete mainframe handler ABI'),(0x1133FFC,0x60,'HandleNeeded and getter'),(0x408E18,6,'PostMessage thunk'),(0xB89650,0x80,'editor event binding'),(0xB89CF0,0x128,'constructor clears loadEnd'),(0xB64C48,0x40,'Chromium loadEnd direct event dispatch')]:
 extra.append('\n'+label)
 for i in m.instructions(m.new,start,m.ns,size):extra.append(f'{i.address:08x} {i.bytes.hex():22s} {i.mnemonic:8s} {i.op_str}')
for start,end,disp in [(0xB83000,0xB9C000,0x324),(0xB60000,0xB83000,0x2A8)]:
 needle=struct.pack('<I',disp);at=m.off(start,m.ns);stop=m.off(end,m.ns)
 while True:
  at=m.new.find(needle,at,stop)
  if at<0:break
  va=start+at-m.off(start,m.ns)
  for back in range(1,5):
   seq=m.instructions(m.new,va-back,m.ns,36)
   if seq and any(op.type==3 and op.mem.disp==disp for op in seq[0].operands):
    extra.append('\nfield offset '+hex(disp))
    for x in seq:extra.append(f'{x.address:08x} {x.bytes.hex():22s} {x.mnemonic:8s} {x.op_str}')
    break
  at+=1
for target in [0xB8AD80,0xB8930C]:
 hits=[]
 for vs,rva,size,raw in m.ns[:1]:
  at=raw
  while True:
   at=m.new.find(b'\xe8',at,raw+size-4)
   if at<0:break
   address=0x400000+rva+at-raw
   if address+5+struct.unpack_from('<i',m.new,at+1)[0]==target:hits.append(hex(address))
   at+=1
 extra.append('calls-to '+hex(target)+' '+repr(hits))
(root/'compose-ready-extra.txt').write_text('\n'.join(extra))
for va in [0xB94A54,0xB83AC4,0xB6716C]:
 q=m.off(m.u(m.new,va-44,m.ns),m.ns);name=m.new[q+1:q+1+m.new[q]].decode()
 print(json.dumps({'vmtVA':hex(va),'name':name,'size':m.u(m.new,va-40,m.ns)}))
print('Extra software-only disassembly: '+str(root/'compose-ready-extra.txt'))
