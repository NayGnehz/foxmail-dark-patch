"""Bounded 587 compose window events and numeric editor state. No UI content."""
import ctypes as C,json,os,re,sys,time,types
from ctypes import wintypes as W
from pathlib import Path

root=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-goal'
maps=json.loads((root/'canvas-map.json').read_text())
source=Path(__file__).parent.parent/'secondary-windows/editor-canvas-readonly.py'
code=source.read_text(encoding='utf8')
for item in maps['vmt']:
 if item['className']=='TFMGroupBox':continue
 code,count=re.subn(r'0x'+format(item['oldVA']-0x400000,'x')+r'\b',hex(item['newVA']-0x400000),code,flags=re.I)
 assert count>=1
p=types.ModuleType('compose_numeric_587');p.__file__=str(source);exec(compile(code,str(source),'exec'),p.__dict__)
# Explicit candidate selection keeps the read-only object map bound to a known
# image; never accept an arbitrary installed executable hash.
candidate='--ncactivate' in sys.argv[1:]
if candidate:sys.argv.remove('--ncactivate')
presize='--presize' in sys.argv[1:]
if presize:sys.argv.remove('--presize')
ready='--ready' in sys.argv[1:]
if ready:sys.argv.remove('--ready')
assert sum((candidate,presize,ready))<=1,'Select only one exact candidate'
p.EXPECTED_SHA=('62faa3d801b1fcf8726a5b29f9636b8cc6e0fbec96e215ff7c856be6bbb5e52c' if ready else
                '252f62e085fdbaf161286c81ea459c110021b1eef6db4b2e5ab9398c2792f930' if presize else
                '4ca3440e7da018de28d3b920f93ba38af3f8500d1a767a7c091430577b6853c3' if candidate else
                'f8f4732d8fd74411c6bed7306041d02cbdcb4bad604eb3dc265b4fa6f7d03f82')
p.ATOMS=tuple(x['newRVA']for x in maps['atoms'])
for name,value in list(p.EDITORS.items()):p.EDITORS[name+'.UnicodeClass']=value
EVENT=C.WINFUNCTYPE(None,W.HANDLE,W.DWORD,W.HWND,W.LONG,W.LONG,W.DWORD,W.DWORD)
hook=p.bind(p.user,'SetWinEventHook',W.HANDLE,[W.DWORD,W.DWORD,W.HMODULE,EVENT,W.DWORD,W.DWORD,W.DWORD])
unhook=p.bind(p.user,'UnhookWinEvent',W.BOOL,[W.HANDLE])
ancestor=p.bind(p.user,'GetAncestor',W.HWND,[W.HWND,W.UINT])
peek=p.bind(p.user,'PeekMessageW',W.BOOL,[C.POINTER(W.MSG),W.HWND,W.UINT,W.UINT,W.UINT])
dispatch=p.bind(p.user,'DispatchMessageW',C.c_ssize_t,[C.POINTER(W.MSG)])
context=p.bind(p.user,'SetThreadDpiAwarenessContext',C.c_void_p,[C.c_void_p])
def prop(h,name):
 # Keep the shared binding's void* argument: editor() also uses integer atoms.
 return p.get_prop(h,C.cast(C.c_wchar_p(name),C.c_void_p))
dpi=p.bind(p.user,'GetDpiForWindow',W.UINT,[W.HWND])
dwm=C.WinDLL('dwmapi');attribute=p.bind(dwm,'DwmGetWindowAttribute',C.c_long,[W.HWND,W.DWORD,C.c_void_p,W.DWORD])
TARGET='TFoxComposeForm.UnicodeClass'
CLASSES={TARGET,'TCEFWindowParent','CefBrowserWindow','Chrome_WidgetWin_0','Chrome_RenderWidgetHostHWND','TTBXDock','TTBXToolbar',*p.EDITORS}
NAMES={0x8000:'create',0x8001:'destroy',0x8002:'show',0x8003:'hide',0x800b:'location'}
if sys.argv[1:] == ['--check']:
 assert p.get_prop.argtypes[1] is C.c_void_p  # named properties and atoms share this API
 print('587 mapping and native API bindings verified; no target opened or hook installed.');sys.exit(0)
snapshot_only=sys.argv[2:]==['--snapshot']
assert len(sys.argv) in (2,3) and sys.argv[1].isdigit() and (len(sys.argv)==2 or snapshot_only)
class ComposeProbe(p.Snapshot):
 def editor(self,h,name):
  result=super().editor(h,name)
  if result['status']!='validated-numeric-snapshot':return result
  chromium=int(result['editor']['chromium304'],16)
  if chromium:
   self.object_guard(chromium,0x776e44,1948)
   size=self.u32(chromium+0xd4);background=self.u32(chromium+0x170)
   if size!=0xa8:raise RuntimeError('cef-browser-settings-size-guard')
   self.object_guard(chromium,0x776e44,1948)
   if self.u32(chromium+0xd4)!=size or self.u32(chromium+0x170)!=background:raise RuntimeError('cef-browser-settings-race')
   result['editor']['createBrowserSettings']={'sizeD4':size,'backgroundARGB170':hex(background)}
  host=int(result['editor']['host300'],16)
  if not host:return result
  # Static 587 TCEFWindowParent inherits TWinControl.WM_ERASEBKGND.
  # Inspect only known color/double-buffer flags, never its brush or content.
  self.object_guard(host,0x76716c,548)
  hwnd=self.u32(host+0x180)
  fields={'controlStyle50':hex(int.from_bytes(self.read(host+0x50,3),'little')),'parentColor5A':self.u8(host+0x5a),
          'color70':hex(self.u32(host+0x70)),'doubleBuffered1F8':self.u8(host+0x1f8)}
  if fields['parentColor5A'] not in (0,1) or fields['doubleBuffered1F8'] not in (0,1):raise RuntimeError('host-paint-boolean-guard')
  self.object_guard(host,0x76716c,548)
  if self.u32(host+0x180)!=hwnd:raise RuntimeError('host-paint-identity-race')
  result['editor']['nativeHostPaintFields']=fields
  return result
probe=ComposeProbe(int(sys.argv[1]));handle=old_context=None
rows=[];errors=[];known={};last={};last_window={};started=time.perf_counter();first_show=None;timings=[];stop_reason='wait-expired'

def state(h):
 window=probe.window(h);rt=ancestor(h,2)
 if window['windowClass'] not in CLASSES or not rt:return None
 root_window=probe.window(rt)
 if root_window['windowClass']!=TARGET:return None
 cloaked=W.DWORD();hr=attribute(rt,14,C.byref(cloaked),4)
 data=dict(window=window,composeHwnd=p.hx(rt),rootWindow=root_window,dpi=dpi(rt),cloaked=cloaked.value if hr==0 else None,
           gateOwned=bool(prop(rt,'FxRevealGate.Owner.43E5CD38.v2')))
 for atom_rva in p.ATOMS:
  atom=int.from_bytes(probe.read(p.BASE+atom_rva,2),'little')
  if atom<0xc000:continue
  obj=p.get_prop(rt,atom)or 0
  if not obj:continue
  try:
   probe.object_guard(obj,0x90b0c4,1768)
   if probe.u32(obj+0x180)!=rt:continue
   width=probe.u32(obj+0x48);height=probe.u32(obj+0x4c)
   visible=probe.u8(obj+0x57);window_state=probe.u8(obj+0x22b)
   if not 0<width<16000 or not 0<height<16000:raise RuntimeError('compose-size-guard')
   if visible not in (0,1)or window_state not in (0,1,2):raise RuntimeError('compose-state-guard')
   probe.object_guard(obj,0x90b0c4,1768)
   if probe.u32(obj+0x180)!=rt or (p.get_prop(rt,atom)or 0)!=obj:raise RuntimeError('compose-size-identity-race')
   data['composeControlSize']=[width,height]
   data['composeVisible57']=visible;data['composeWindowState22B']=window_state;break
  except RuntimeError:continue
 return data

@EVENT
def event(_,kind,h,obj,child,tid,tick):
 global first_show
 if obj!=0 or child!=0 or kind not in NAMES or not h:return
 begin=time.perf_counter()
 try:
  if len(rows)>=3000:return
  if kind==0x8001:
   if h in known:rows.append(dict(ms=(begin-started)*1000,event='destroy',hwnd=p.hx(h),windowClass=known.pop(h)))
   return
  value=state(h)
  if value is None:return
  name=value['window']['windowClass'];known[h]=name
  rows.append(dict(ms=(begin-started)*1000,event=NAMES[kind],osEventTick=tick,**value))
  if name in p.EDITORS and kind in (0x8000,0x8002):
   sample=probe.editor(h,name);key=json.dumps(sample,sort_keys=True)
   if last.get(h)!=key:
    last[h]=key;rows.append(dict(ms=(time.perf_counter()-started)*1000,event='editor-state',snapshot=sample))
  if kind==0x8002 and name==TARGET and first_show is None:first_show=begin
 except Exception as ex:
  if len(errors)<20:errors.append(str(ex))
 finally:timings.append((time.perf_counter()-begin)*1000)

try:
 probe.guard();old_context=context(C.c_void_p(-4));assert old_context
 if not snapshot_only:
  handle=hook(0x8000,0x800b,None,event,probe.pid,0,2);assert handle
  print('READY: waiting for a compose window show; numeric events only, maximum 120 seconds.',flush=True)
 else:first_show=started
 message=W.MSG();next_sample=started
 while time.perf_counter()-started<120:
  while peek(C.byref(message),None,0,0,1):dispatch(C.byref(message))
  now=time.perf_counter()
  if len(rows)>=3000 or probe.bytes_read>=262144:stop_reason='bounded-budget';break
  if first_show is not None and now-first_show>=4:stop_reason='four-seconds-after-first-show';break
  # Once a compose appears, sample only its validated editor chain, at 20Hz.
  # Unchanged samples are discarded. No pixel copying or text APIs.
  if now>=next_sample:
   next_sample=now+.05
   @p.CALLBACK
   def top(h,_):
    try:
     if probe.window(h)['windowClass']!=TARGET:return True
     value=state(h);window_key=json.dumps(value,sort_keys=True)
     if last_window.get(h)!=window_key:
      last_window[h]=window_key;rows.append(dict(ms=(time.perf_counter()-started)*1000,event='compose-state',**value))
     @p.CALLBACK
     def child(ch,_):
      try:
       name=probe.window(ch)['windowClass']
       if name in p.EDITORS:
        sample=probe.editor(ch,name);key=json.dumps(sample,sort_keys=True)
        if last.get(ch)!=key:
         last[ch]=key;rows.append(dict(ms=(time.perf_counter()-started)*1000,event='editor-state',snapshot=sample))
      except Exception as ex:
       if len(errors)<20:errors.append(type(ex).__name__+': '+str(ex))
      return True
     if first_show is not None:p.enum_children(h,child,0)
    except RuntimeError:pass
    return True
   p.enum_windows(top,0)
   if snapshot_only:stop_reason='one-shot-existing-compose';break
  time.sleep(.005)
 assert probe.process_stamp()==probe.created
 report=dict(pid=probe.pid,softwareSHA256=p.EXPECTED_SHA,readOnly=True,noTextNoHTMLNoURLsNoScreenshots=True,
             elapsedSeconds=time.perf_counter()-started,stopReason=stop_reason,firstShowMs=(first_show-started)*1000 if first_show else None,
             numericBytes=probe.bytes_read,events=rows,errors=errors,callbackTotalMs=sum(timings),callbackMaxMs=max(timings,default=0),
             limit='Out-of-context events may be delayed. Load-end, cloak state and geometry are not presentation acknowledgments. No causal pixel attribution.')
 dest=root/('compose-state-'+time.strftime('%Y%m%d-%H%M%S')+'.json');dest.write_text(json.dumps(report,indent=2))
 print(json.dumps(dict(saved=str(dest),events=len(rows),numericBytes=probe.bytes_read,stopReason=stop_reason,errors=errors)))
finally:
 if handle:unhook(handle)
 if old_context:context(old_context)
 p.close_handle(probe.handle)
