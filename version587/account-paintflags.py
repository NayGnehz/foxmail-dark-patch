"""Read bounded drawing flags only; no UI messages, text, writes or accounts."""
import os,sys,types,json,hashlib,time,re
from pathlib import Path
source=Path(__file__).parent.parent/'secondary-windows/editor-canvas-readonly.py'
root=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-goal'
maps=json.loads((root/'canvas-map.json').read_text());code=source.read_text(encoding='utf8')
for item in maps['vmt']:
 if item['className']=='TFMGroupBox':continue
 code,count=re.subn(r'0x'+format(item['oldVA']-0x400000,'x')+r'\b',hex(item['newVA']-0x400000),code,flags=re.I);assert count>=1
p=types.ModuleType('bounded_native');p.__file__=str(source);exec(compile(code,str(source),'exec'),p.__dict__)
p.EXPECTED_SHA='ce79d169ad6f908a4607ccc160efb17ce21b6afbcb9b8d1018c17331fff06c4a';p.ATOMS=tuple(x['newRVA']for x in maps['atoms'])
targets={'TFMGroupBox':(0xb6a5e8,536),'TNotebook':(0x66ab6c,556),'TPage':(0x66a950,532)}
probe=p.Snapshot(int(sys.argv[1]));rows=[];errors=[]
try:
 probe.guard()
 @p.CALLBACK
 def each(hwnd,_):
  try:
   owner=p.W.DWORD();p.window_pid(hwnd,p.C.byref(owner))
   if owner.value!=probe.pid:return True
   name=p.C.create_unicode_buffer(160);p.class_name(hwnd,name,len(name));cls=name.value.removesuffix('.UnicodeClass')
   if cls not in targets:return True
   va,size=targets[cls]
   for atomrva in p.ATOMS:
    atom=int.from_bytes(probe.read(p.BASE+atomrva,2),'little')
    if atom<0xc000:continue
    obj=p.get_prop(hwnd,atom)or 0
    try:
     probe.object_guard(obj,va-p.BASE,size)
     if probe.u32(obj+0x180)!=hwnd:continue
     if cls=='TNotebook':fields={'transparent228':probe.u8(obj+0x228)}
     elif cls=='TPage':fields={'transparent210':probe.u8(obj+0x210)}
     else:fields={'clientColor210':probe.u32(obj+0x210),'headerColor214':probe.u32(obj+0x214)}
     fields['controlStyle50']=hex(probe.u32(obj+0x50));fields['color68']=hex(probe.u32(obj+0x68))
     probe.object_guard(obj,va-p.BASE,size);assert probe.u32(obj+0x180)==hwnd
     rows.append({'window':probe.window(hwnd),'fields':fields});break
    except RuntimeError:continue
  except Exception as e:errors.append(type(e).__name__)
  return True
 @p.CALLBACK
 def top(hwnd,_):
  owner=p.W.DWORD();p.window_pid(hwnd,p.C.byref(owner))
  if owner.value==probe.pid:each(hwnd,0);p.enum_children(hwnd,each,0)
  return True
 assert p.enum_windows(top,0)
 assert probe.created==probe.process_stamp()
 report={'pid':probe.pid,'readOnly':True,'noTextOrContent':True,'numericReads':probe.calls,'bytesRead':probe.bytes_read,'rows':rows,'errors':errors}
 dest=root/('account-paintflags-'+time.strftime('%Y%m%d-%H%M%S')+'.json');dest.write_text(json.dumps(report,indent=2))
 print(json.dumps({'saved':str(dest),'count':len(rows),'visible':[x for x in rows if x['window']['visible']],'errors':errors}))
finally:p.close_handle(probe.handle)
