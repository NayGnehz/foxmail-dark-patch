# FOXMAIL_RETIRED_BASELINE_CLI: old experiment source retained; baseline EXE retired by explicit approval.
if __name__ == '__main__':
    raise SystemExit('Retired historical baseline CLI. See docs/cleanup-report-20261105.md and existing audit reports; use the current print/compose entry.')
import importlib.util,struct,json
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('cosmetic-1.2/payload/Foxmail深色.exe','rb').read()
classes=[];methods=[]
for sec,r,raw,size in n.sections:
 if r>0xc00000:continue
 for o in range(raw,raw+size-80,4):
  if n.u32(o)!=n.va(o)+76:continue
  v=n.va(o)+76
  try:
   name=n.classname(v)
   if not name.startswith('T') or len(name)>80 or not name.isascii():continue
   classes.append((v,name))
   for slot in range(-32,0x200,4):
    addr=n.read(v+slot)
    if 0x401000<=addr<0x1000000:methods.append((addr,name,'vslot'+hex(slot)))
   d=n.read(v-48)
   if d:
    p=n.off(d);cnt=struct.unpack_from('<H',n.b,p)[0]
    for i in range(cnt):methods.append((n.read(d+2+2*cnt+4*i),name,'message'+hex(struct.unpack_from('<H',n.b,p+2+2*i)[0])))
   d=n.read(v-52)
   if d:
    p=n.off(d);cnt=struct.unpack_from('<H',n.b,p)[0];p+=2
    for i in range(cnt):
     ln=n.b[p+6];methods.append((n.u32(p+2),name,n.b[p+7:p+7+ln].decode('latin1')));p+=struct.unpack_from('<H',n.b,p)[0]
  except Exception:pass
print('classes',len(classes),'methods',len(methods))
for a in [0xb276ff,0xb42eb8,0xb71a32,0xbabe00,0xbcc392,0xc0ec40,0xc16328,0xf4ff7b,0xf94edd]:
 lower=[m for m in methods if m[0]<=a];near=sorted(set(lower),reverse=True)[:7];print(hex(a),near)
open('cosmetic-1.3/class-method-index.json','w').write(json.dumps({'classes':classes,'methods':methods}))
