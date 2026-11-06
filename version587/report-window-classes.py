"""Visible dialog classes/PIDs only. No captions, text, messages or screenshots."""
import ctypes as C,json
from ctypes import wintypes as W
u=C.WinDLL('user32',use_last_error=True)
def bind(name,result,args):
    f=getattr(u,name);f.restype=result;f.argtypes=args;return f
cb=C.WINFUNCTYPE(W.BOOL,W.HWND,W.LPARAM)
enum=bind('EnumWindows',W.BOOL,[cb,W.LPARAM])
visible=bind('IsWindowVisible',W.BOOL,[W.HWND])
klass=bind('GetClassNameW',C.c_int,[W.HWND,W.LPWSTR,C.c_int])
owner=bind('GetWindowThreadProcessId',W.DWORD,[W.HWND,C.POINTER(W.DWORD)])
foreground=bind('GetForegroundWindow',W.HWND,[])
rows=[]
@cb
def each(h,_):
    if not visible(h):return True
    name=C.create_unicode_buffer(128);klass(h,name,len(name))
    if name.value=='#32770'or any(s in name.value.lower()for s in ('bug','report','exception','foxmail')):
        pid=W.DWORD();tid=owner(h,C.byref(pid))
        rows.append(dict(hwnd=hex(h),pid=pid.value,tid=tid,windowClass=name.value,foreground=foreground()==h))
    return True
assert enum(each,0)
print(json.dumps(dict(noTextNoScreenshots=True,dialogs=rows)))
