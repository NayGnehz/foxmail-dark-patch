"""Exact compose-ready candidate counters and native geometry; no UI content."""
import ctypes as C,hashlib,json,os,re,struct,sys,time,types
from pathlib import Path

args=sys.argv[1:]
candidate=bool(args and args[0]=='--host-ownership')
if candidate:args=args[1:]
EXE_SHA=('24665d0450f6a7b5efc9cba26cfc05dc9d0c8a761d6a91a093853d2ea4688f9c' if candidate
         else '62faa3d801b1fcf8726a5b29f9636b8cc6e0fbec96e215ff7c856be6bbb5e52c')
HELPER_SHA=('1a42c70987f206fb09bd69cfbe88cf836ca318bf614dd0dfeea12a86dd3c4041' if candidate
            else '0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70')
FIELDS=('size','version','armed','active','notified','snapshotReady','readyReleased',
        'timeoutReleased','closed','released','releaseFailed','retired','setupFailed',
        'surfacePending','redrawFailed','callbackExceptions','posted','staleMessages')
assert re.fullmatch('[a-f0-9]{64}',EXE_SHA)and re.fullmatch('[a-f0-9]{64}',HELPER_SHA)
assert 3<=len(FIELDS)<=32 and FIELDS[:2]==('size','version')
root=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp'
stage=root/('version587-compose-ready-check-host-ownership' if candidate else 'version587-compose-ready')
mapping=json.loads((root/'version587-goal/canvas-map.json').read_text())
source=Path(__file__).parent.parent/'secondary-windows/editor-canvas-readonly.py'
code=source.read_text(encoding='utf8')
for item in mapping['vmt']:
    if item['className']=='TFMGroupBox':continue
    code,n=re.subn(r'0x'+format(item['oldVA']-0x400000,'x')+r'\b',hex(item['newVA']-0x400000),code,flags=re.I)
    assert n>=1
p=types.ModuleType('compose_ready_numeric');p.__file__=str(source)
exec(compile(code,str(source),'exec'),p.__dict__)
p.EXPECTED_SHA=EXE_SHA
p.ATOMS=tuple(x['newRVA']for x in mapping['atoms'])
checking=args==['--check']
assert checking or len(args)==1 and args[0].isdigit()
helper=(stage/'FoxmailRevealGate.dll' if checking else Path(p.EXPECTED_PATH).with_name('FoxmailRevealGate.dll'))
blob=helper.read_bytes();assert hashlib.sha256(blob).hexdigest()==HELPER_SHA
pe=struct.unpack_from('<I',blob,60)[0];op=pe+24
assert blob[:2]==b'MZ' and blob[pe:pe+4]==b'PE\0\0'
assert struct.unpack_from('<H',blob,pe+4)[0]==0x14c and struct.unpack_from('<H',blob,op)[0]==0x10b
sections=[];so=op+struct.unpack_from('<H',blob,pe+20)[0]
for i in range(struct.unpack_from('<H',blob,pe+6)[0]):
    _,rva,length,raw=struct.unpack_from('<IIII',blob,so+40*i+8)
    sections.append((rva,length,raw))
def offset(rva,length=4):
    matches=[raw+rva-start for start,size,raw in sections if start<=rva and rva+length<=start+size]
    assert len(matches)==1 and matches[0]+length<=len(blob)
    return matches[0]
def u32(rva):return struct.unpack_from('<I',blob,offset(rva))[0]
export_rva,export_size=struct.unpack_from('<II',blob,op+96)
count=u32(export_rva+24);assert 0<count<4096
names,ordinals,functions=(u32(export_rva+x)for x in (32,36,28))
found=[]
for i in range(count):
    name_at=offset(u32(names+4*i),1);end=blob.index(0,name_at)
    assert end-name_at<256
    if blob[name_at:end]==b'FxComposeReadyStats':
        ordinal=struct.unpack_from('<H',blob,offset(ordinals+2*i,2))[0]
        assert ordinal<u32(export_rva+20)
        found.append(u32(functions+4*ordinal))
assert len(found)==1
stats_rva=found[0];stats_size=4*len(FIELDS)
assert not export_rva<=stats_rva<export_rva+export_size
assert u32(stats_rva)==stats_size and u32(stats_rva+4)==1
image_size=struct.unpack_from('<I',blob,op+56)[0]
assert 0<=stats_rva<=image_size-stats_size
module_path=p.bind(p.psapi,'GetModuleFileNameExW',p.W.DWORD,[p.W.HANDLE,p.W.HMODULE,p.W.LPWSTR,p.W.DWORD])
dpi=p.bind(p.user,'GetDpiForWindow',p.W.UINT,[p.W.HWND])
iconic=p.bind(p.user,'IsIconic',p.W.BOOL,[p.W.HWND])
foreground=p.bind(p.user,'GetForegroundWindow',p.W.HWND,[])
dwm=C.WinDLL('dwmapi')
window_attribute=p.bind(dwm,'DwmGetWindowAttribute',C.c_long,[p.W.HWND,p.W.DWORD,C.c_void_p,p.W.DWORD])
if checking:
    print('Exact helper stats export/layout and native bindings verified; no target opened.');sys.exit(0)
probe=p.Snapshot(int(args[0]))
try:
    probe.guard()
    modules=(C.c_void_p*512)();needed=p.W.DWORD()
    assert p.enum_modules(probe.handle,modules,C.sizeof(modules),C.byref(needed),3)and needed.value<=C.sizeof(modules)
    bases=[]
    for base in modules[:needed.value//C.sizeof(C.c_void_p)]:
        name=C.create_unicode_buffer(32768)
        if module_path(probe.handle,base,name,len(name))and p.norm(name.value)==p.norm(helper):bases.append(base)
    assert len(bases)==1
    base=bases[0];info=p.MODULEINFO()
    assert p.module_info(probe.handle,base,C.byref(info),C.sizeof(info))and info.base==base and info.size==image_size
    dos=probe.read(base,64);assert dos[:2]==b'MZ' and struct.unpack_from('<I',dos,60)[0]==pe
    hdr=probe.read(base+pe,88)
    assert hdr[:4]==b'PE\0\0' and struct.unpack_from('<H',hdr,4)[0]==0x14c
    assert struct.unpack_from('<I',hdr,80)[0]==image_size
    values=struct.unpack('<'+'I'*len(FIELDS),probe.read(base+stats_rva,stats_size))
    assert values[:2]==(stats_size,1)
    rows=[]
    @p.CALLBACK
    def each(hwnd,_):
        pid=p.W.DWORD();p.window_pid(hwnd,C.byref(pid))
        if pid.value!=probe.pid:return True
        name=C.create_unicode_buffer(128)
        if p.class_name(hwnd,name,len(name))and name.value in ('TFoxMainFrm.UnicodeClass','TFoxComposeForm.UnicodeClass'):
            try:
                cloaked=p.W.DWORD()
                hr=window_attribute(hwnd,14,C.byref(cloaked),C.sizeof(cloaked))
                rows.append(dict(window=probe.window(hwnd),dpi=dpi(hwnd),iconic=bool(iconic(hwnd)),
                                 foreground=foreground()==hwnd,cloaked=cloaked.value if hr==0 else None))
            except RuntimeError:pass
        return True
    assert p.enum_windows(each,0)
    assert probe.process_stamp()==probe.created
    report=dict(pid=probe.pid,softwareSHA256=EXE_SHA,helperSHA256=HELPER_SHA,readOnly=True,
                noTextNoHTMLNoURLsNoScreenshots=True,numericBytes=probe.bytes_read,stats=dict(zip(FIELDS,values)),rows=rows,
                limitation='Counters are non-atomic snapshots. Readiness and release counts do not prove pixel presentation or visual acceptance.')
    dest=stage/('ready-state-'+str(time.time_ns())+'.json')
    with dest.open('x',encoding='utf8')as output:json.dump(report,output,indent=2)
    print(json.dumps(dict(saved=str(dest),**report)))
finally:p.close_handle(probe.handle)
