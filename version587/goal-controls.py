"""Only HWND classes/rects/styles and brush colors; no captions, text or messages."""
import ctypes as C,json,sys,os,hashlib,time
from ctypes import wintypes as W
from pathlib import Path
pid=int(sys.argv[1]);exe=Path(r'D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe')
assert hashlib.sha256(exe.read_bytes()).hexdigest() in {
 '7fca5528dd9d54956d929dc733ba60b049c0db6ded16f226f0a3821376d4a65e',
 'ce79d169ad6f908a4607ccc160efb17ce21b6afbcb9b8d1018c17331fff06c4a',
 'ad8b4a7eb7589e19345a710e01abe64ae537c1fbe545568105eeb6de1f17cac9'}
u=C.WinDLL('user32',use_last_error=True);k=C.WinDLL('kernel32',use_last_error=True);g=C.WinDLL('gdi32')
def bind(d,n,r,a):f=getattr(d,n);f.restype=r;f.argtypes=a;return f
cb=C.WINFUNCTYPE(W.BOOL,W.HWND,W.LPARAM)
class R(C.Structure):_fields_=[('l',W.LONG),('t',W.LONG),('r',W.LONG),('b',W.LONG)]
class P(C.Structure):_fields_=[('x',W.LONG),('y',W.LONG)]
class BR(C.Structure):_fields_=[('style',W.UINT),('color',W.DWORD),('hatch',C.c_void_p)]
owner=bind(u,'GetWindowThreadProcessId',W.DWORD,[W.HWND,C.POINTER(W.DWORD)]);cls=bind(u,'GetClassNameW',C.c_int,[W.HWND,W.LPWSTR,C.c_int]);rect=bind(u,'GetWindowRect',W.BOOL,[W.HWND,C.POINTER(R)])
client=bind(u,'GetClientRect',W.BOOL,[W.HWND,C.POINTER(R)]);origin=bind(u,'ClientToScreen',W.BOOL,[W.HWND,C.POINTER(P)])
style=bind(u,'GetWindowLongW',C.c_long,[W.HWND,C.c_int]);classlong=bind(u,'GetClassLongPtrW',C.c_size_t,[W.HWND,C.c_int]);parent=bind(u,'GetParent',W.HWND,[W.HWND]);visible=bind(u,'IsWindowVisible',W.BOOL,[W.HWND])
getobj=bind(g,'GetObjectW',C.c_int,[W.HANDLE,C.c_int,C.c_void_p]);syscolor=bind(u,'GetSysColor',W.DWORD,[C.c_int]);prop=bind(u,'GetPropW',C.c_void_p,[W.HWND,W.LPCWSTR])
enum=bind(u,'EnumWindows',W.BOOL,[cb,W.LPARAM]);children=bind(u,'EnumChildWindows',W.BOOL,[W.HWND,cb,W.LPARAM])
openp=bind(k,'OpenProcess',W.HANDLE,[W.DWORD,W.BOOL,W.DWORD]);close=bind(k,'CloseHandle',W.BOOL,[W.HANDLE]);query=bind(k,'QueryFullProcessImageNameW',W.BOOL,[W.HANDLE,W.DWORD,W.LPWSTR,C.POINTER(W.DWORD)])
h=openp(0x1000,False,pid);assert h
try:
 text=C.create_unicode_buffer(32768);length=W.DWORD(len(text));assert query(h,0,text,C.byref(length));assert text.value.lower()==str(exe).lower()
finally:close(h)
rows=[];roots=[]
def info(hwnd,root):
 p=W.DWORD();owner(hwnd,C.byref(p))
 if p.value!=pid:return
 name=C.create_unicode_buffer(160);assert cls(hwnd,name,len(name));r=R();cr=R();pt=P();assert rect(hwnd,C.byref(r))and client(hwnd,C.byref(cr))and origin(hwnd,C.byref(pt))
 brush=classlong(hwnd,-10);b=BR();data=None
 if 0<brush<=31:data={'systemIndex':brush-1,'systemColorOutsideFoxmail':syscolor(brush-1)}
 elif brush and getobj(brush,C.sizeof(b),C.byref(b))==C.sizeof(b):data={'style':b.style,'color':b.color}
 rows.append(dict(hwnd=hex(hwnd),root=hex(root),parent=hex(parent(hwnd)or 0),windowClass=name.value,rect=[r.l,r.t,r.r,r.b],clientRect=[pt.x,pt.y,pt.x+cr.r,pt.y+cr.b],style=hex(style(hwnd,-16)&0xffffffff),exstyle=hex(style(hwnd,-20)&0xffffffff),visible=bool(visible(hwnd)),classBrush=data,lifetimeMarked=bool(prop(hwnd,'FxRevealGate.Identity.43E5CD38.v2')),gateOwned=bool(prop(hwnd,'FxRevealGate.Owner.43E5CD38.v2'))))
@cb
def top(hwnd,_):
 p=W.DWORD();owner(hwnd,C.byref(p));name=C.create_unicode_buffer(160);cls(hwnd,name,len(name))
 if p.value==pid and name.value in ['TOptionForm.UnicodeClass','TFoxComposeForm.UnicodeClass','TFoxMainFrm.UnicodeClass']:roots.append(hwnd)
 return True
assert enum(top,0)
for root in roots:
 info(root,root)
 @cb
 def each(hwnd,_):info(hwnd,root);return True
 assert children(root,each,0)
dest=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-goal'/('controls-'+time.strftime('%Y%m%d-%H%M%S')+'.json');dest.parent.mkdir(exist_ok=True)
dest.write_text(json.dumps(dict(pid=pid,readOnly=True,noTextOrContent=True,windows=rows),indent=2))
print(json.dumps(dict(saved=str(dest),windowCount=len(rows),settingsRoots=[x for x in rows if x['windowClass']=='TOptionForm.UnicodeClass']),ensure_ascii=False))
for x in rows:
 if x['visible'] and x['windowClass']in ['TFMGroupBox','TNotebook','TPage','TAccountOptionFrame','TXPanel']:print(json.dumps(x))
