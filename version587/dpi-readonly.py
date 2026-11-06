"""Read only process/window DPI numbers. No memory reads, settings or UI messages."""
import ctypes as C,json,sys
from ctypes import wintypes as W
k=C.WinDLL('kernel32',use_last_error=True);u=C.WinDLL('user32',use_last_error=True);s=C.WinDLL('shcore',use_last_error=True)
def bind(d,n,r,a):
 f=getattr(d,n);f.restype=r;f.argtypes=a;return f
openp=bind(k,'OpenProcess',W.HANDLE,[W.DWORD,W.BOOL,W.DWORD]);close=bind(k,'CloseHandle',W.BOOL,[W.HANDLE])
query=bind(k,'QueryFullProcessImageNameW',W.BOOL,[W.HANDLE,W.DWORD,W.LPWSTR,C.POINTER(W.DWORD)])
awareness=bind(s,'GetProcessDpiAwareness',C.c_long,[W.HANDLE,C.POINTER(C.c_int)])
pid=int(sys.argv[1]);h=openp(0x1000,False,pid);assert h
try:
 p=C.create_unicode_buffer(32768);size=W.DWORD(len(p));assert query(h,0,p,C.byref(size))
 assert p.value.lower()==r'D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe'.lower()
 value=C.c_int(-1);hr=awareness(h,C.byref(value));assert hr==0
 cb=C.WINFUNCTYPE(W.BOOL,W.HWND,W.LPARAM)
 enum=bind(u,'EnumWindows',W.BOOL,[cb,W.LPARAM]);owner=bind(u,'GetWindowThreadProcessId',W.DWORD,[W.HWND,C.POINTER(W.DWORD)])
 cls=bind(u,'GetClassNameW',C.c_int,[W.HWND,W.LPWSTR,C.c_int]);dpi=bind(u,'GetDpiForWindow',W.UINT,[W.HWND])
 context=bind(u,'GetWindowDpiAwarenessContext',C.c_void_p,[W.HWND]);context_awareness=bind(u,'GetAwarenessFromDpiAwarenessContext',C.c_int,[C.c_void_p])
 class RECT(C.Structure):_fields_=[('left',W.LONG),('top',W.LONG),('right',W.LONG),('bottom',W.LONG)]
 rect=bind(u,'GetWindowRect',W.BOOL,[W.HWND,C.POINTER(RECT)]);visible=bind(u,'IsWindowVisible',W.BOOL,[W.HWND]);iconic=bind(u,'IsIconic',W.BOOL,[W.HWND])
 dwm=C.WinDLL('dwmapi');cloaked=bind(dwm,'DwmGetWindowAttribute',C.c_long,[W.HWND,W.DWORD,C.c_void_p,W.DWORD])
 rows=[]
 @cb
 def each(hwnd,_):
  wp=W.DWORD();owner(hwnd,C.byref(wp))
  if wp.value==pid:
   name=C.create_unicode_buffer(160);cls(hwnd,name,len(name))
   if name.value in ['TFoxMainFrm.UnicodeClass','TFoxComposeForm.UnicodeClass','TOptionForm.UnicodeClass']:
    r=RECT();ok=rect(hwnd,C.byref(r));cloak=W.DWORD();hr=cloaked(hwnd,14,C.byref(cloak),C.sizeof(cloak))
    rows.append(dict(windowClass=name.value,dpi=dpi(hwnd),awareness=context_awareness(context(hwnd)),visible=bool(visible(hwnd)),iconic=bool(iconic(hwnd)),size=[r.right-r.left,r.bottom-r.top]if ok else None,cloaked=cloak.value if hr==0 else None))
  return True
 assert enum(each,0)
 print(json.dumps(dict(readOnly=True,pid=pid,processAwareness=value.value,windows=rows),ensure_ascii=False))
finally:close(h)
