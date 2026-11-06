"""One asynchronous perimeter repaint of the exact baseline main window.
No process memory, text, pixels, style changes, target timers or persistent patch.
"""
import ctypes as C,hashlib,json,os,sys,time
from ctypes import wintypes as W
from pathlib import Path
exe=Path(r'D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe')
expected='ce79d169ad6f908a4607ccc160efb17ce21b6afbcb9b8d1018c17331fff06c4a'
assert hashlib.sha256(exe.read_bytes()).hexdigest()==expected
pid=int(sys.argv[1]);u=C.WinDLL('user32',use_last_error=True);k=C.WinDLL('kernel32',use_last_error=True);g=C.WinDLL('gdi32',use_last_error=True)
arguments=sys.argv[2:]
outside_client='--outside-client' in arguments
if outside_client:arguments.remove('--outside-client')
wait_visible=bool(arguments)
observation_seconds=0
if wait_visible:
 assert len(arguments) in (1,2) and arguments[0]=='--wait-visible'
 observation_seconds=int(arguments[1])if len(arguments)==2 else 3
 assert 1<=observation_seconds<=30
def bind(d,n,r,a):f=getattr(d,n);f.restype=r;f.argtypes=a;return f
cb=C.WINFUNCTYPE(W.BOOL,W.HWND,W.LPARAM)
class RECT(C.Structure):_fields_=[('l',W.LONG),('t',W.LONG),('r',W.LONG),('b',W.LONG)]
openp=bind(k,'OpenProcess',W.HANDLE,[W.DWORD,W.BOOL,W.DWORD]);close=bind(k,'CloseHandle',W.BOOL,[W.HANDLE])
query=bind(k,'QueryFullProcessImageNameW',W.BOOL,[W.HANDLE,W.DWORD,W.LPWSTR,C.POINTER(W.DWORD)])
owner=bind(u,'GetWindowThreadProcessId',W.DWORD,[W.HWND,C.POINTER(W.DWORD)])
cls=bind(u,'GetClassNameW',C.c_int,[W.HWND,W.LPWSTR,C.c_int]);enum=bind(u,'EnumWindows',W.BOOL,[cb,W.LPARAM])
visible=bind(u,'IsWindowVisible',W.BOOL,[W.HWND]);iconic=bind(u,'IsIconic',W.BOOL,[W.HWND]);client=bind(u,'GetClientRect',W.BOOL,[W.HWND,C.POINTER(RECT)])
dpi=bind(u,'GetDpiForWindow',W.UINT,[W.HWND]);context=bind(u,'SetThreadDpiAwarenessContext',C.c_void_p,[C.c_void_p])
foreground=bind(u,'GetForegroundWindow',W.HWND,[])
region=bind(g,'CreateRectRgn',W.HANDLE,[C.c_int]*4);combine=bind(g,'CombineRgn',C.c_int,[W.HANDLE,W.HANDLE,W.HANDLE,C.c_int]);delete=bind(g,'DeleteObject',W.BOOL,[W.HANDLE])
redraw=bind(u,'RedrawWindow',W.BOOL,[W.HWND,C.POINTER(RECT),W.HANDLE,W.UINT])
h=openp(0x1000,False,pid);assert h
old_context=None;outer=inner=None
try:
 name=C.create_unicode_buffer(32768);size=W.DWORD(len(name));assert query(h,0,name,C.byref(size))
 assert os.path.normcase(name.value)==os.path.normcase(str(exe))
 roots=[]
 @cb
 def each(hwnd,_):
  wp=W.DWORD();owner(hwnd,C.byref(wp));name=C.create_unicode_buffer(160);cls(hwnd,name,len(name))
  if wp.value==pid and name.value=='TFoxMainFrm.UnicodeClass':roots.append(hwnd)
  return True
 deadline=time.monotonic()+(30 if wait_visible else 0)
 while True:
  roots.clear();assert enum(each,0) and len(roots)<=1
  if len(roots)==1 and visible(roots[0]) and not iconic(roots[0]):break
  if time.monotonic()>=deadline:raise RuntimeError('main-window-not-visible; no repaint performed')
  time.sleep(0.1)
 hwnd=roots[0]
 foreground_at_visible=foreground()==hwnd
 # Diagnostic observation interval only; no delay in the target UI thread and
 # no production timing policy is inferred from this one-shot experiment.
 if wait_visible:time.sleep(observation_seconds)
 assert visible(hwnd) and not iconic(hwnd)
 # Only this diagnostic thread adopts physical pixel coordinates.
 old_context=context(C.c_void_p(-4));assert old_context
 r=RECT();assert client(hwnd,C.byref(r)) and 200<r.r<16000 and 100<r.b<16000
 if outside_client:
  outer=region(-4,-4,r.r+4,r.b+4);inner=region(0,0,r.r,r.b)
 else:
  outer=region(0,0,r.r,r.b);inner=region(4,4,r.r-4,r.b-4)
 assert outer and inner
 assert combine(outer,outer,inner,4)==3  # RGN_DIFF -> complex four-sided region
 wp=W.DWORD();owner(hwnd,C.byref(wp));assert wp.value==pid
 assert hashlib.sha256(exe.read_bytes()).hexdigest()==expected
 flags=0x441 if outside_client else 0x481
 started=time.perf_counter();ok=redraw(hwnd,None,outer,flags);elapsed=(time.perf_counter()-started)*1000
 assert ok
 report=dict(pid=pid,softwareSHA256=expected,windowClass='TFoxMainFrm.UnicodeClass',hwnd=hex(hwnd),dpi=dpi(hwnd),clientPhysicalPixels=[r.r,r.b],perimeterPixels=4,region='outside-client-only'if outside_client else 'inside-client-only',flags='RDW_INVALIDATE|RDW_FRAME|'+('RDW_NOCHILDREN'if outside_client else 'RDW_ALLCHILDREN'),flagsHex=hex(flags),foregroundAtVisible=foreground_at_visible,foregroundAtReport=foreground()==hwnd,synchronousPaint=False,eraseRequested=False,oneShot=True,diagnosticObservationSeconds=observation_seconds,callMs=round(elapsed,3),visualResultUnknown=True)
 dest=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-goal'/('first-border-refresh-'+time.strftime('%Y%m%d-%H%M%S')+'.json')
 dest.write_text(json.dumps(report,indent=2));print(json.dumps(dict(saved=str(dest),**report)))
finally:
 if outer:delete(outer)
 if inner:delete(inner)
 if old_context:context(old_context)
 close(h)
