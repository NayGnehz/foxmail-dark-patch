"""Read numeric gate counters only. No remote calls, UI automation or mail reads."""
import ctypes as c, ctypes.wintypes as w, json, struct, sys, pathlib
folder=pathlib.Path(__file__).resolve().parent
b=(folder/'FoxmailRevealGate.dll').read_bytes()
u16=lambda p:struct.unpack_from('<H',b,p)[0]
u32=lambda p:struct.unpack_from('<I',b,p)[0]
pe=u32(60);op=pe+24;so=op+u16(pe+20)
sections=[(u32(so+i*40+12),u32(so+i*40+20),max(u32(so+i*40+8),u32(so+i*40+16))) for i in range(u16(pe+6))]
def off(rva):
    for r,p,n in sections:
        if r<=rva<r+n:return p+rva-r
    raise ValueError('unmapped RVA')
ex=off(u32(op+96));names=off(u32(ex+32));ords=off(u32(ex+36));funcs=off(u32(ex+28));stats_rva=None;route_rva=None;print_rva=None
for i in range(u32(ex+24)):
    p=off(u32(names+i*4));name=b[p:b.index(0,p)].decode('ascii')
    if name=='FxPrintGateStats':print_rva=u32(funcs+u16(ords+i*2)*4)
    if name=='FxGateStats':stats_rva=u32(funcs+u16(ords+i*2)*4)
    if name=='FxGateRouteStats':route_rva=u32(funcs+u16(ords+i*2)*4)
if print_rva is None:raise RuntimeError('print stats export missing')
if stats_rva is None:raise RuntimeError('stats export missing')
if route_rva is None:raise RuntimeError('route stats export missing')
k=c.WinDLL('kernel32',use_last_error=True);ps=c.WinDLL('psapi',use_last_error=True)
k.OpenProcess.argtypes=[w.DWORD,w.BOOL,w.DWORD];k.OpenProcess.restype=w.HANDLE
k.ReadProcessMemory.argtypes=[w.HANDLE,c.c_void_p,c.c_void_p,c.c_size_t,c.POINTER(c.c_size_t)];k.ReadProcessMemory.restype=w.BOOL
k.CloseHandle.argtypes=[w.HANDLE]
ps.EnumProcessModulesEx.argtypes=[w.HANDLE,c.POINTER(c.c_void_p),w.DWORD,c.POINTER(w.DWORD),w.DWORD];ps.EnumProcessModulesEx.restype=w.BOOL
ps.GetModuleBaseNameW.argtypes=[w.HANDLE,c.c_void_p,w.LPWSTR,w.DWORD];ps.GetModuleBaseNameW.restype=w.DWORD
fields=['size','version','calls','invocations','nested_bypasses','cold_bypasses','eligible','acquired','redraws','redraw_failures','released','release_failures','recovery_attempts','retired_identities','lifetimes_marked','unwinds','pending_recovery']
route_fields=['size','version','main_calls','proxy_calls','proxy_direct_bypasses','proxy_iconic_calls','settings_calls','main_acquired','proxy_acquired','settings_acquired']
results=[]
for arg in sys.argv[1:]:
    pid=int(arg);entry={'pid':pid};h=k.OpenProcess(0x410,False,pid)
    if not h:entry['error']='OpenProcess:'+str(c.get_last_error());results.append(entry);continue
    try:
        modules=(c.c_void_p*1024)();needed=w.DWORD()
        if not ps.EnumProcessModulesEx(h,modules,c.sizeof(modules),c.byref(needed),3):raise OSError(c.get_last_error(),'EnumProcessModulesEx')
        for module in modules[:min(len(modules),needed.value//c.sizeof(c.c_void_p))]:
            name=c.create_unicode_buffer(260)
            if ps.GetModuleBaseNameW(h,module,name,260) and name.value.lower()=='foxmailrevealgate.dll':
                buf=(c.c_ubyte*68)();got=c.c_size_t()
                if not k.ReadProcessMemory(h,module+stats_rva,buf,68,c.byref(got)) or got.value!=68:raise OSError(c.get_last_error(),'ReadProcessMemory')
                counters=dict(zip(fields,struct.unpack('<17I',bytes(buf))))
                if counters['size']!=68 or counters['version']!=1:raise RuntimeError('Unexpected stats ABI')
                entry['stats']=counters
                route_buf=(c.c_ubyte*40)();got=c.c_size_t()
                if not k.ReadProcessMemory(h,module+route_rva,route_buf,40,c.byref(got)) or got.value!=40:raise OSError(c.get_last_error(),'ReadProcessMemory route')
                routes=dict(zip(route_fields,struct.unpack('<10I',bytes(route_buf))))
                if routes['size']!=40 or routes['version']!=2:raise RuntimeError('Unexpected route stats ABI')
                entry['routes']=routes
                print_buf=(c.c_ubyte*16)();got=c.c_size_t()
                if not k.ReadProcessMemory(h,module+print_rva,print_buf,16,c.byref(got)) or got.value!=16:raise OSError(c.get_last_error(),'ReadProcessMemory print counters')
                print_stats=dict(zip(['size','version','calls','acquired'],struct.unpack('<4I',bytes(print_buf))))
                if print_stats['size']!=16 or print_stats['version']!=1:raise RuntimeError('Unexpected print stats ABI')
                entry['print']=print_stats;break
        else:entry['helperLoaded']=False
    except Exception as error:entry['error']=str(error)
    finally:k.CloseHandle(h)
    results.append(entry)
print(json.dumps({'readOnly':True,'snapshotAtomic':False,'processes':results},indent=2))
