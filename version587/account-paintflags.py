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
counter=None
if len(sys.argv)>2:
 assert len(sys.argv)==3 and sys.argv[2]=='--counter'
 counter=json.loads((root.parent/'version587-account-counter/validation.json').read_text())
 assert counter['baselineSHA256']==p.EXPECTED_SHA
 assert counter['candidateSHA256']=='ad8b4a7eb7589e19345a710e01abe64ae537c1fbe545568105eeb6de1f17cac9'
 p.EXPECTED_SHA=counter['candidateSHA256']
targets={'TFMGroupBox':(0xb6a5e8,536),'TNotebook':(0x66ab6c,556),'TPage':(0x66a950,532)}
probe=p.Snapshot(int(sys.argv[1]));rows=[];errors=[];candidates=[];roots=[];class_counts={}
try:
 probe.guard()
 counter_before=None
 if counter:
  assert probe.read(p.BASE+counter['sectionRva'],27).hex()==counter['stubHex']
  assert probe.u32(p.BASE+counter['slotRva'])==p.BASE+counter['sectionRva']
  counter_before=probe.u32(p.BASE+counter['counterRva'])
 @p.CALLBACK
 def each(hwnd,_):
  try:
   owner=p.W.DWORD();p.window_pid(hwnd,p.C.byref(owner))
   if owner.value!=probe.pid:return True
   name=p.C.create_unicode_buffer(160);p.class_name(hwnd,name,len(name));cls=name.value.removesuffix('.UnicodeClass')
   class_counts[cls]=class_counts.get(cls,0)+1
   if cls not in targets:return True
   va,size=targets[cls]
   candidate={'window':probe.window(hwnd),'status':'no-matching-fixed-atom','rejections':[]};candidates.append(candidate)
   for atomrva in p.ATOMS:
    atom=int.from_bytes(probe.read(p.BASE+atomrva,2),'little')
    if atom<0xc000:continue
    obj=p.get_prop(hwnd,atom)or 0
    if not obj:continue
    try:
     probe.object_guard(obj,va-p.BASE,size)
     if probe.u32(obj+0x180)!=hwnd:continue
     if cls=='TNotebook':fields={'transparent228':probe.u8(obj+0x228)}
     elif cls=='TPage':fields={'transparent210':probe.u8(obj+0x210)}
     else:fields={'clientColor210':probe.u32(obj+0x210),'headerColor214':probe.u32(obj+0x214)}
     # +0x68 is used as a font object by the native painters, not a COLORREF.
     fields['controlStyle50']=hex(probe.u32(obj+0x50))
     if cls!='TFMGroupBox' and next(iter(fields.values())) not in (0,1):raise RuntimeError('transparent-boolean-guard')
     probe.object_guard(obj,va-p.BASE,size);assert probe.u32(obj+0x180)==hwnd
     if (p.get_prop(hwnd,atom)or 0)!=obj:raise RuntimeError('window-object-race-guard')
     rows.append({'window':probe.window(hwnd),'fields':fields});candidate['status']='validated';break
    except RuntimeError as ex:candidate['rejections'].append({'atomRva':hex(atomrva),'guard':str(ex)})
  except Exception as e:errors.append(type(e).__name__)
  return True
 @p.CALLBACK
 def top(hwnd,_):
  owner=p.W.DWORD();p.window_pid(hwnd,p.C.byref(owner))
  if owner.value==probe.pid:
   w=probe.window(hwnd)
   roots.append(w)
   each(hwnd,0);p.enum_children(hwnd,each,0)
  return True
 assert p.enum_windows(top,0)
 assert probe.created==probe.process_stamp()
 counter_after=probe.u32(p.BASE+counter['counterRva'])if counter else None
 report={'pid':probe.pid,'readOnly':True,'noTextOrContent':True,'softwareSHA256':p.EXPECTED_SHA,'inheritedPaintCounter':[counter_before,counter_after]if counter else None,'numericReads':probe.calls,'bytesRead':probe.bytes_read,'rows':rows,'candidates':candidates,'roots':roots,'classCounts':class_counts,'errors':errors}
 dest=root/('account-paintflags-'+time.strftime('%Y%m%d-%H%M%S')+'.json');dest.write_text(json.dumps(report,indent=2))
 print(json.dumps({'saved':str(dest),'count':len(rows),'inheritedPaintCounter':report['inheritedPaintCounter'],'visible':[x for x in rows if x['window']['visible']],'unvalidated':[x for x in candidates if x['status']!='validated'],'settingsRoots':[x for x in roots if x['windowClass']=='TOptionForm.UnicodeClass'],'classCounts':{k:v for k,v in class_counts.items()if k in targets},'errors':errors}))
finally:p.close_handle(probe.handle)
