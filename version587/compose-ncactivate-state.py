"""One-shot exact-candidate activation counters and native form state; no UI content."""
import json,os,re,sys,types,time
from pathlib import Path

EXPECTED_SHA='4ca3440e7da018de28d3b920f93ba38af3f8500d1a767a7c091430577b6853c3'
root=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp'
stage=root/'version587-compose-ncactivate'
maps=json.loads((root/'version587-goal/canvas-map.json').read_text())
source=Path(__file__).parent.parent/'secondary-windows/editor-canvas-readonly.py'
code=source.read_text(encoding='utf8')
for item in maps['vmt']:
    if item['className']=='TFMGroupBox':continue
    code,count=re.subn(r'0x'+format(item['oldVA']-0x400000,'x')+r'\b',hex(item['newVA']-0x400000),code,flags=re.I)
    assert count>=1
p=types.ModuleType('compose_nca_numeric');p.__file__=str(source)
exec(compile(code,str(source),'exec'),p.__dict__)
p.EXPECTED_SHA=EXPECTED_SHA
p.ATOMS=tuple(x['newRVA']for x in maps['atoms'])
dpi=p.bind(p.user,'GetDpiForWindow',p.W.UINT,[p.W.HWND])
iconic=p.bind(p.user,'IsIconic',p.W.BOOL,[p.W.HWND])
foreground=p.bind(p.user,'GetForegroundWindow',p.W.HWND,[])
CLASSES={'TFoxComposeForm.UnicodeClass':(0x90b0c4,1768),'TFoxMainFrm.UnicodeClass':(0xbdd0ac,1368)}
m=json.loads((stage/'validation.json').read_text())
assert m['candidateSHA256']==EXPECTED_SHA and m['baselineSHA256']=='f8f4732d8fd74411c6bed7306041d02cbdcb4bad604eb3dc265b4fa6f7d03f82'
assert m['oldMainSectionByteIdentical'] and m['siteRva']==0x6166e7 and m['vmtRva']==0x90b0c4
assert m['counterRva']==22552696 and m['mainCounterRva']==22548600
if sys.argv[1:]==['--check']:
    print('Exact compose candidate metadata, 587 mapping and numeric API bindings verified; no process opened.')
    sys.exit(0)
assert len(sys.argv)==2 and sys.argv[1].isdigit()
probe=p.Snapshot(int(sys.argv[1]));rows=[];errors=[]
try:
    probe.guard()
    for rva in (m['counterRva'],m['mainCounterRva']):assert 0<=rva<=probe.image_size-4
    @p.CALLBACK
    def each(hwnd,_):
        owner=p.W.DWORD();p.window_pid(hwnd,p.C.byref(owner))
        if owner.value!=probe.pid:return True
        name=p.C.create_unicode_buffer(128)
        if not p.class_name(hwnd,name,len(name))or name.value not in CLASSES:return True
        try:
            window=probe.window(hwnd);rva,size=CLASSES[name.value]
            row={'window':window,'dpi':dpi(hwnd),'iconic':bool(iconic(hwnd)),'foreground':foreground()==hwnd,'status':'no-valid-fixed-atom-object'}
            for atom_rva in p.ATOMS:
                atom=int.from_bytes(probe.read(p.BASE+atom_rva,2),'little')
                if atom<0xc000:continue
                obj=p.get_prop(hwnd,atom)or 0
                if not obj:continue
                try:probe.object_guard(obj,rva,size)
                except RuntimeError:continue
                if probe.u32(obj+0x180)!=hwnd:continue
                pending,state=probe.u8(obj+0x3fd),probe.u8(obj+0x22b)
                if pending not in (0,1)or state not in (0,1,2):raise RuntimeError('activation-boolean-state-guard')
                probe.object_guard(obj,rva,size)
                if (p.get_prop(hwnd,atom)or 0)!=obj or probe.u32(obj+0x180)!=hwnd or probe.u8(obj+0x3fd)!=pending or probe.u8(obj+0x22b)!=state:
                    raise RuntimeError('activation-object-race-guard')
                now=probe.window(hwnd)
                if any(now[k]!=window[k]for k in ('pid','tid','windowClass','parent')):raise RuntimeError('activation-window-race-guard')
                row.update(status='validated-numeric-snapshot',firstDefaultActivationPending3FD=pending,windowState22B=state)
                break
            rows.append(row)
        except RuntimeError as ex:errors.append(str(ex))
        return True
    assert p.enum_windows(each,0)
    counters={'composeFirstDefaultSuppressed':probe.u32(p.BASE+m['counterRva']),'mainFirstDefaultSuppressed':probe.u32(p.BASE+m['mainCounterRva'])}
    assert probe.process_stamp()==probe.created
    report={'pid':probe.pid,'softwareSHA256':EXPECTED_SHA,'readOnly':True,'noTextNoHTMLNoURLsNoScreenshots':True,'numericBytes':probe.bytes_read,'counters':counters,'rows':rows,'errors':errors,'limitation':'Counter hits prove branch execution only; they do not prove removal of a visible border or body flash.'}
    dest=stage/('activation-state-'+str(time.time_ns())+'.json')
    with dest.open('x',encoding='utf8')as output:json.dump(report,output,indent=2)
    print(json.dumps({'saved':str(dest),**report}))
finally:p.close_handle(probe.handle)
