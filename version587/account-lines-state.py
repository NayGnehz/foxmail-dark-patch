"""Exact 4.0 account control drawing fields/geometry; no text or account data."""
import ctypes as C,json,os,re,sys,time,types
from pathlib import Path

root=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-goal'
mapping=json.loads((root/'canvas-map.json').read_text())
source=Path(__file__).parent.parent/'secondary-windows/editor-canvas-readonly.py'
code=source.read_text(encoding='utf8')
for item in mapping['vmt']:
    if item['className']=='TFMGroupBox':continue
    code,n=re.subn(r'0x'+format(item['oldVA']-0x400000,'x')+r'\b',hex(item['newVA']-0x400000),code,flags=re.I)
    assert n>=1
p=types.ModuleType('account_lines_native');p.__file__=str(source)
exec(compile(code,str(source),'exec'),p.__dict__)
p.EXPECTED_SHA='62faa3d801b1fcf8726a5b29f9636b8cc6e0fbec96e215ff7c856be6bbb5e52c'
p.ATOMS=tuple(x['newRVA']for x in mapping['atoms'])
counter=None
inset_mode='--inset' in sys.argv[1:]
edge_mode='--edge' in sys.argv[1:]or inset_mode
assert not(inset_mode and '--edge' in sys.argv[1:])
assert not(edge_mode and '--counter' in sys.argv[1:])
if '--counter' in sys.argv[1:]:
    sys.argv.remove('--counter')
    counter=json.loads((root.parent/'version587-account-instance-counter/validation.json').read_text())
    assert counter['baselineSHA256']==p.EXPECTED_SHA
    assert counter['candidateSHA256']=='38a4634a2ca439e33ee3578a4b4df6a3fc685f651285b7066fdc72774483030e'
    p.EXPECTED_SHA=counter['candidateSHA256']
    assert [h['slotRva']for h in counter['hooks']]==[0x76a6b0,0x76a6bc,0x76a6c0,0x76a6c4]
if edge_mode:
    sys.argv.remove('--inset'if inset_mode else '--edge')
    counter=json.loads((root.parent/'version587-account-edge-calls/validation.json').read_text())
    assert counter['baselineSHA256']==p.EXPECTED_SHA
    assert counter['candidateSHA256']=='1c38639672b9ca1e5de77db307d604d7ac89ad1246c8ed8e44a88bb785ce6913'
    p.EXPECTED_SHA=counter['candidateSHA256']
    assert [h['siteRva']for h in counter['hooks']]==[0x47abc4,0x47acfe,0x47ad38]
    if inset_mode:
        layout=json.loads((root.parent/'version587-account-right-inset/validation.json').read_text())
        assert layout['baselineSHA256']==p.EXPECTED_SHA and layout['candidateSHA256']=='540cf174a53e319529605b0cb3e171550783a6fe6455d29d16e5bc410f6d1f33'
        assert layout['changedBytes']==1 and layout['parsedDfmOnlyWidthChanged']and layout['allOtherBytesUnchanged']
        p.EXPECTED_SHA=layout['candidateSHA256']
targets={'TFMGroupBox':(0x76a5e8,536),'TNotebook':(0x26ab6c,556),'TPage':(0x26a950,532)}
dpi=p.bind(p.user,'GetDpiForWindow',p.W.UINT,[p.W.HWND])
context=p.bind(p.user,'SetThreadDpiAwarenessContext',C.c_void_p,[C.c_void_p])
class POINT(C.Structure):_fields_=[('x',p.W.LONG),('y',p.W.LONG)]
client=p.bind(p.user,'GetClientRect',p.W.BOOL,[p.W.HWND,C.POINTER(p.RECT)])
origin=p.bind(p.user,'ClientToScreen',p.W.BOOL,[p.W.HWND,C.POINTER(POINT)])
style=p.bind(p.user,'GetWindowLongW',C.c_long,[p.W.HWND,C.c_int])
if sys.argv[1:]==['--check']:
    print('Exact 4.0 hash, 587 mappings and numeric bindings verified; no target opened.');sys.exit(0)
assert len(sys.argv)==2 and sys.argv[1].isdigit()
probe=p.Snapshot(int(sys.argv[1]));roots=[];rows=[];errors=[];main_dpi=[];seen=0;old_context=None
try:
    probe.guard();old_context=context(C.c_void_p(-4));assert old_context
    def counters():
        if not counter:return None
        result={}
        for h in counter['hooks']:
            scoped=h['skippedCounterRva']if edge_mode else h['accountCounterRva']
            site=h['siteRva']if edge_mode else h['slotRva']
            for rva in (site,h['stubRva'],h['allCounterRva'],scoped):assert 0<=rva<=probe.image_size-5
            if edge_mode:assert probe.read(p.BASE+site,5).hex()==h['siteHex']
            else:assert probe.u32(p.BASE+site)==p.BASE+h['stubRva']
            result[h['name']]={'all':probe.u32(p.BASE+h['allCounterRva']),('skipped'if edge_mode else 'account'):probe.u32(p.BASE+scoped)}
        return result
    before=counters()
    @p.CALLBACK
    def each(hwnd,_):
        global seen
        seen+=1
        if seen>2048 or probe.bytes_read>65536:return False
        try:
            window=probe.window(hwnd);name=window['windowClass'].removesuffix('.UnicodeClass')
            if name not in targets:return True
            rva,size=targets[name];row=dict(window=window,status='no-valid-object')
            cr=p.RECT();pt=POINT()
            if client(hwnd,C.byref(cr))and origin(hwnd,C.byref(pt)):
                row['clientScreen']=[pt.x,pt.y,pt.x+cr.right-cr.left,pt.y+cr.bottom-cr.top]
            row.update(style=hex(style(hwnd,-16)&0xffffffff),exstyle=hex(style(hwnd,-20)&0xffffffff))
            for atom_rva in p.ATOMS:
                atom=int.from_bytes(probe.read(p.BASE+atom_rva,2),'little')
                if atom<0xc000:continue
                obj=p.get_prop(hwnd,atom)or 0
                if not obj:continue
                try:
                    probe.object_guard(obj,rva,size)
                    if probe.u32(obj+0x180)!=hwnd:continue
                    fields={'controlStyle50':hex(int.from_bytes(probe.read(obj+0x50,3),'little'))}
                    if name=='TFMGroupBox':
                        visible=probe.u8(obj+0x57);ctl3d=probe.u8(obj+0x1a5)
                        if visible not in (0,1)or ctl3d not in (0,1):raise RuntimeError('drawing-boolean-guard')
                        fields.update(clientColor210=hex(probe.u32(obj+0x210)),headerColor214=hex(probe.u32(obj+0x214)),
                                      paintVmtC8=hex(probe.u32(p.BASE+rva+0xc8)),componentState1C=hex(int.from_bytes(probe.read(obj+0x1c,2),'little')),
                                      visible57=visible,ctl3d1A5=ctl3d,color70=hex(probe.u32(obj+0x70)))
                        parent_obj=probe.u32(obj+0x30);fields['parentAccountFrame']=False
                        if parent_obj:
                            try:
                                probe.object_guard(parent_obj,0x9aa69c,904)
                                if probe.u32(parent_obj+0x180)==p.get_parent(hwnd):fields['parentAccountFrame']=True
                            except RuntimeError:pass
                    else:
                        offset=0x228 if name=='TNotebook' else 0x210
                        transparent=probe.u8(obj+offset)
                        if transparent not in (0,1):raise RuntimeError('transparent-guard')
                        fields['transparent'+hex(offset)[2:]]=transparent
                    probe.object_guard(obj,rva,size)
                    if probe.u32(obj+0x180)!=hwnd or (p.get_prop(hwnd,atom)or 0)!=obj:raise RuntimeError('object-identity-race')
                    now=probe.window(hwnd)
                    if any(now[k]!=window[k]for k in ('pid','tid','parent','windowClass')):raise RuntimeError('window-identity-race')
                    row.update(status='validated-numeric-snapshot',object=hex(obj),fields=fields);break
                except RuntimeError:continue
            rows.append(row)
        except RuntimeError as ex:
            if len(errors)<16:errors.append(str(ex))
        return True
    @p.CALLBACK
    def top(hwnd,_):
        try:
            pid=p.W.DWORD();p.window_pid(hwnd,C.byref(pid))
            if pid.value!=probe.pid:return True
            window=probe.window(hwnd)
            if window['windowClass']=='TFoxMainFrm.UnicodeClass':main_dpi.append(dpi(hwnd))
            if window['windowClass']!='TOptionForm.UnicodeClass':return True
            roots.append(dict(window=window,dpi=dpi(hwnd)))
            p.enum_children(hwnd,each,0)
        except RuntimeError as ex:
            if len(errors)<16:errors.append(str(ex))
        return True
    assert p.enum_windows(top,0)
    assert probe.process_stamp()==probe.created
    after=counters()
    report=dict(pid=probe.pid,softwareSHA256=p.EXPECTED_SHA,readOnly=True,noTextNoAccountData=True,
                numericBytes=probe.bytes_read,mainWindowDpi=main_dpi,settings=roots,rows=rows,errors=errors,countersBefore=before,countersAfter=after,
                limitation='Native boundaries and drawing flags do not identify which painter produced a visible line.')
    dest=root/('account-lines-'+time.strftime('%Y%m%d-%H%M%S')+'.json')
    with dest.open('x',encoding='utf8')as output:json.dump(report,output,indent=2)
    print(json.dumps(dict(saved=str(dest),pid=probe.pid,softwareSHA256=p.EXPECTED_SHA,readOnly=True,
                          numericBytes=probe.bytes_read,mainWindowDpi=main_dpi,settings=roots,
                          accountGroups=[x for x in rows if x.get('fields',{}).get('parentAccountFrame')],
                          visibleNotebooks=[x['window']for x in rows if x['window']['windowClass']=='TNotebook'and x['window']['visible']],
                          countersBefore=before,countersAfter=after,errors=errors)))
finally:
    if old_context:context(old_context)
    p.close_handle(probe.handle)
