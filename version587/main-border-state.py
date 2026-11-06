"""Bounded main-window border state; no text, pixels, messages or writes."""
import json,os,re,sys,types,time
from pathlib import Path
root=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-goal'
maps=json.loads((root/'canvas-map.json').read_text())
source=Path(__file__).parent.parent/'secondary-windows/editor-canvas-readonly.py'
code=source.read_text(encoding='utf8')
for item in maps['vmt']:
 if item['className']=='TFMGroupBox':continue
 code,count=re.subn(r'0x'+format(item['oldVA']-0x400000,'x')+r'\b',hex(item['newVA']-0x400000),code,flags=re.I);assert count>=1
p=types.ModuleType('bounded_main');p.__file__=str(source);exec(compile(code,str(source),'exec'),p.__dict__)
p.EXPECTED_SHA='ce79d169ad6f908a4607ccc160efb17ce21b6afbcb9b8d1018c17331fff06c4a'
candidate='--ncactivate' in sys.argv[2:]
if candidate:
 assert sys.argv[2:]==['--ncactivate']
 p.EXPECTED_SHA='f8f4732d8fd74411c6bed7306041d02cbdcb4bad604eb3dc265b4fa6f7d03f82'
else:assert len(sys.argv)==2
foreground=p.bind(p.user,'GetForegroundWindow',p.W.HWND,[])
iconic=p.bind(p.user,'IsIconic',p.W.BOOL,[p.W.HWND])
dpi=p.bind(p.user,'GetDpiForWindow',p.W.UINT,[p.W.HWND])
context=p.bind(p.user,'SetThreadDpiAwarenessContext',p.C.c_void_p,[p.C.c_void_p])
class POINT(p.C.Structure):_fields_=[('x',p.W.LONG),('y',p.W.LONG)]
client=p.bind(p.user,'GetClientRect',p.W.BOOL,[p.W.HWND,p.C.POINTER(p.RECT)])
origin=p.bind(p.user,'ClientToScreen',p.W.BOOL,[p.W.HWND,p.C.POINTER(POINT)])
dwm=p.C.WinDLL('dwmapi');get_attribute=p.bind(dwm,'DwmGetWindowAttribute',p.C.c_long,[p.W.HWND,p.W.DWORD,p.C.c_void_p,p.W.DWORD])
probe=p.Snapshot(int(sys.argv[1]));rows=[];errors=[]
try:
 probe.guard()
 @p.CALLBACK
 def each(hwnd,_):
  wp=p.W.DWORD();p.window_pid(hwnd,p.C.byref(wp))
  if wp.value!=probe.pid:return True
  name=p.C.create_unicode_buffer(160);p.class_name(hwnd,name,len(name))
  if name.value!='TFoxMainFrm.UnicodeClass':return True
  row={'window':probe.window(hwnd),'foreground':foreground()==hwnd,'iconic':bool(iconic(hwnd)),'dpi':dpi(hwnd),'dwm':{}}
  previous=context(p.C.c_void_p(-4));assert previous
  try:
   wr=p.RECT();cr=p.RECT();pt=POINT()
   assert p.get_rect(hwnd,p.C.byref(wr))and client(hwnd,p.C.byref(cr))and origin(hwnd,p.C.byref(pt))
   row['physicalGeometry']={'windowSize':[wr.right-wr.left,wr.bottom-wr.top],'clientRectInWindow':[pt.x-wr.left,pt.y-wr.top,pt.x-wr.left+cr.right,pt.y-wr.top+cr.bottom]}
  finally:context(previous)
  for label,attribute in [('nonclientRenderingEnabled',1),('immersiveDark',20),('borderColor',34),('cloaked',14)]:
   value=p.W.DWORD();hr=get_attribute(hwnd,attribute,p.C.byref(value),4)
   row['dwm'][label]={'hr':hr,'value':hex(value.value)if hr==0 else None}
  for entry in maps['atoms']:
   atom=int.from_bytes(probe.read(p.BASE+entry['newRVA'],2),'little')
   if atom<0xc000:continue
   obj=p.get_prop(hwnd,atom)or 0
   if not obj:continue
   try:
    probe.object_guard(obj,0xfdd0ac-p.BASE,1368)
    if probe.u32(obj+0x180)!=hwnd:continue
    def fields():
     gate=probe.u32(obj+0x3b0);flag=probe.u8(obj+0x3d8);global_flag=probe.u8(0x12d4e94)
     if flag not in (0,1)or global_flag not in (0,1):raise RuntimeError('paint-boolean-guard')
     state=probe.u8(obj+0x22b);flag3fc=probe.u8(obj+0x3fc);flag3fd=probe.u8(obj+0x3fd);scale=probe.u32(0x12f349c)
     if state not in (0,1,2)or flag3fc not in (0,1)or flag3fd not in (0,1)or not 25<=scale<=800:raise RuntimeError('skin-margin-state-guard')
     pages=probe.u32(obj+0x35c);count=None
     if pages:
      # Proven UI TList identity; never read its item array or any tab content.
      probe.object_guard(pages,0x642e9c-p.BASE,16);count=probe.u32(pages+8)
      if count>10000:raise RuntimeError('UI-list-count-guard')
      probe.object_guard(pages,0x642e9c-p.BASE,16)
      if probe.u32(obj+0x35c)!=pages:raise RuntimeError('UI-list-identity-race')
     return {'updateGate3B0':gate if gate<0x80000000 else gate-0x100000000,'flag3D8':flag,'global12D4E94':global_flag,'dynamicQueryResolved':bool(probe.u32(0x12f7ad0)),'windowState22B':state,'flag3FC':flag3fc,'firstDefaultActivationPending3FD':flag3fd,'scalePercent12F349C':scale,'UIListCount35C':count}
    sampled=fields();probe.object_guard(obj,0xfdd0ac-p.BASE,1368)
    if probe.u32(obj+0x180)!=hwnd or (p.get_prop(hwnd,atom)or 0)!=obj or sampled!=fields():raise RuntimeError('main-state-race-guard')
    row['paintFields']=sampled
    if not sampled['dynamicQueryResolved']:
     # A0CC58 returns false for a NULL function slot, so A1B734 is false.
     n=sampled['UIListCount35C'];f=sampled['flag3FC'];state=sampled['windowState22B']
     top=27 if n is None or n==0 or(n==1 and not f)else 40
     if state==2 and(f or(n is not None and n>1)):top=28
     margins=[(x*sampled['scalePercent12F349C']+50)//100 for x in [5,top,5,5]]
     row['derivedSkinMargins']={'M':margins,'Y':0 if state!=2 else None,'inference':'Static A17DF8/A1B95C formula from current fields; not an execution trace. Maximized Q function is not evaluated.'}
    break
   except RuntimeError as ex:errors.append(str(ex))
  rows.append(row);return True
 assert p.enum_windows(each,0)
 assert probe.created==probe.process_stamp()
 report={'pid':probe.pid,'readOnly':True,'softwareSHA256':p.EXPECTED_SHA,'noTextOrPixels':True,'numericBytes':probe.bytes_read,'rows':rows,'errors':errors,'limit':'Numeric state only. Dynamic predicate is not executed and no route attribution is inferred.'}
 if candidate:
  report['suppressedDefaultFrameCount']=probe.u32(p.BASE+22548600)
  report['numericBytes']=probe.bytes_read
 dest=root/('main-border-state-'+time.strftime('%Y%m%d-%H%M%S')+'.json');dest.write_text(json.dumps(report,indent=2));print(json.dumps({'saved':str(dest),**report}))
finally:p.close_handle(probe.handle)
