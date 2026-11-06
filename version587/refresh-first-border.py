"""One asynchronous perimeter repaint of the exact baseline main window.
No process memory, text, pixels, style changes, timers or persistent patch.
"""
import ctypes as C,hashlib,json,os,sys,time
from ctypes import wintypes as W
from pathlib import Path
exe=Path(r'D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe')
expected='ce79d169ad6f908a4607ccc160efb17ce21b6afbcb9b8d1018c17331fff06c4a'
assert hashlib.sha256(exe.read_bytes()).hexdigest()==expected
pid=int(sys.argv[1]);u=C.WinDLL('user32',use_last_error=True);k=C.WinDLL('kernel32',use_last_error=True);g=C.WinDLL('gdi32',use_last_error=True)
def bind(d,n,r,a):f=getattr(d,n);f.restype=r;f.argtypes=a;return f
cb=C.WINFUNCTYPE(W.BOOL,W.HWND,W.LPARAM)
class RECT(C.Structure):_fields_=[('l',W.LONG),('t',W.LONG),('r',W.LONG),('b',W.LONG)]
openp=bind(k,'OpenProcess',W.HANDLE,[W.DWORD,W.BOOL,W.DWORD]);close=bind(k,'CloseHandle',W.BOOL,[W.HANDLE])
query=bind(k,'QueryFullProcessImageNameW',W.BOOL,[W.HANDLE,W.DWORD,W.LPWSTR,C.POINTER(W.DWORD)])
owner=bind(u,'GetWindowThreadProcessId',W.DWORD,[W.HWND,C.POINTER(W.DWORD)])
cls=bind(u,'GetClassNameW',C.c_int,[W.HWND,W.LPWSTR,C.c_int]);enum=bind(u,'EnumWindows',W.BOOL,[cb,W.LPARAM])
visible=bind(u,'IsWindowVisible',W.BOOL,[W.HWND]);iconic=bind(u,'IsIconic',W.BOOL,[W.HWND]);client=bind(u,'GetClientRect',W.BOOL,[W.HWND,C.POINTER(RECT)])
dpi=bind(u,'GetDpiForWindow',W.UINT,[W.HWND]);context=bind(u,'SetThreadDpiAwarenessContext',C.c_void_p,[C.c_void_p])
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
 assert enum(each,0) and len(roots)==1
 hwnd=roots[0];assert visible(hwnd) and not iconic(hwnd)
 # Only this diagnostic thread adopts physical pixel coordinates.
 old_context=context(C.c_void_p(-4));assert old_context
 r=RECT();assert client(hwnd,C.byref(r)) and 200<r.r<16000 and 100<r.b<16000
 outer=region(0,0,r.r,r.b);inner=region(4,4,r.r-4,r.b-4);assert outer and inner
 assert combine(outer,outer,inner,4)==3  # RGN_DIFF -> complex four-sided region
 wp=W.DWORD();owner(hwnd,C.byref(wp));assert wp.value==pid
 assert hashlib.sha256(exe.read_bytes()).hexdigest()==expected
 started=time.perf_counter();ok=redraw(hwnd,None,outer,0x481);elapsed=(time.perf_counter()-started)*1000
 assert ok
 report=dict(pid=pid,softwareSHA256=expected,windowClass='TFoxMainFrm.UnicodeClass',hwnd=hex(hwnd),dpi=dpi(hwnd),clientPhysicalPixels=[r.r,r.b],perimeterPixels=4,flags='RDW_INVALIDATE|RDW_ALLCHILDREN|RDW_FRAME',flagsHex='0x481',synchronousPaint=False,eraseRequested=False,oneShot=True,callMs=round(elapsed,3),visualResultUnknown=True)
 dest=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-goal'/('first-border-refresh-'+time.strftime('%Y%m%d-%H%M%S')+'.json')
 dest.write_text(json.dumps(report,indent=2));print(json.dumps(dict(saved=str(dest),**report)))
finally:
 if outer:delete(outer)
 if inner:delete(inner)
 if old_context:context(old_context)
 close(h)
