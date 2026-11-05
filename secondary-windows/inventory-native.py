"""Read only native class/layout metadata for an explicit process. No titles or accessibility."""
import ctypes as c,ctypes.wintypes as w,json,sys,pathlib
u=c.WinDLL('user32',use_last_error=True)
H=w.HWND;P=c.c_ssize_t;CB=c.WINFUNCTYPE(w.BOOL,H,P)
u.EnumWindows.argtypes=[CB,P];u.EnumChildWindows.argtypes=[H,CB,P]
u.GetWindowThreadProcessId.argtypes=[H,c.POINTER(w.DWORD)];u.GetWindowThreadProcessId.restype=w.DWORD
u.GetClassNameW.argtypes=[H,w.LPWSTR,c.c_int];u.GetClassNameW.restype=c.c_int
u.GetWindowRect.argtypes=[H,c.POINTER(w.RECT)];u.GetWindowRect.restype=w.BOOL
u.GetWindowLongW.argtypes=[H,c.c_int];u.GetWindowLongW.restype=w.LONG
u.IsWindowVisible.argtypes=[H];u.IsWindowVisible.restype=w.BOOL
u.GetParent.argtypes=[H];u.GetParent.restype=H
pid=int(sys.argv[1]);tops=[];rows=[]
def item(h,top):
 p=w.DWORD();tid=u.GetWindowThreadProcessId(h,c.byref(p));n=c.create_unicode_buffer(128);u.GetClassNameW(h,n,128);r=w.RECT();u.GetWindowRect(h,c.byref(r))
 return {'handle':hex(h),'top':hex(top),'pid':p.value,'tid':tid,'class':n.value,'parent':hex(u.GetParent(h) or 0),'visible':bool(u.IsWindowVisible(h)),'rect':[r.left,r.top,r.right,r.bottom],'style':hex(u.GetWindowLongW(h,-16)&0xffffffff),'exstyle':hex(u.GetWindowLongW(h,-20)&0xffffffff)}
@CB
def top(h,l):
 p=w.DWORD();u.GetWindowThreadProcessId(h,c.byref(p))
 if p.value==pid:tops.append(h)
 return True
u.EnumWindows(top,0)
for h in tops:
 rows.append(item(h,h))
 @CB
 def child(ch,l):rows.append(item(ch,h));return True
 u.EnumChildWindows(h,child,0)
report={'readOnly':True,'noTextNoAccessibility':True,'pid':pid,'windows':rows}
out=pathlib.Path(__file__).parent/'native-class-layout.json';out.write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({'topForms':[r for r in rows if r['handle']==r['top'] and (r['class'].endswith('.UnicodeClass') or r['class']=='TApplication')],'nativeChildClasses':sorted(set(r['class'] for r in rows)),'count':len(rows),'report':str(out)},indent=2))
