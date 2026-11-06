"""Reuse the bounded numeric reader with static-verified 587 addresses only."""
import json,os,re,sys,types,time,hashlib
from pathlib import Path
root=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-goal'
maps=json.loads((root/'canvas-map.json').read_text());source=Path(__file__).parent.parent/'secondary-windows/editor-canvas-readonly.py';code=source.read_text(encoding='utf8')
for item in maps['vmt']:
 old=item['oldVA']-0x400000;new=item['newVA']-0x400000
 if item['className']=='TFMGroupBox':continue
 code,count=re.subn(r'0x'+format(old,'x')+r'\b',hex(new),code,flags=re.I);assert count>=1
p=types.ModuleType('canvas587');p.__file__=str(source);exec(compile(code,str(source),'exec'),p.__dict__)
p.EXPECTED_SHA='7fca5528dd9d54956d929dc733ba60b049c0db6ded16f226f0a3821376d4a65e';p.ATOMS=tuple(x['newRVA']for x in maps['atoms'])
# Classes emitted with/without the RTL UnicodeClass suffix refer to the same exact VMT.
for name,value in list(p.EDITORS.items()):p.EDITORS[name+'.UnicodeClass']=value
probe=p.Snapshot(int(sys.argv[1]));groups=[]
try:
 report=probe.run()
 group=next(x for x in maps['vmt']if x['className']=='TFMGroupBox');rva=group['newVA']-p.BASE
 @p.CALLBACK
 def each(hwnd,_):
  name=p.C.create_unicode_buffer(160);p.class_name(hwnd,name,len(name));owner=p.W.DWORD();p.window_pid(hwnd,p.C.byref(owner))
  if owner.value!=probe.pid or name.value not in ['TFMGroupBox','TFMGroupBox.UnicodeClass']:return True
  for atomrva in p.ATOMS:
   atom=int.from_bytes(probe.read(p.BASE+atomrva,2),'little')
   if atom<0xc000:continue
   obj=p.get_prop(hwnd,atom)or 0
   try:
    probe.object_guard(obj,rva,group['size'])
    if probe.u32(obj+0x180)!=hwnd:continue
    fields=dict(bevelEdges162=probe.u8(obj+0x162),bevelInner163=probe.u8(obj+0x163),bevelOuter164=probe.u8(obj+0x164),bevelKind165=probe.u8(obj+0x165),bevelWidth168=probe.u32(obj+0x168),borderWidth16C=probe.u32(obj+0x16c),clientColor210=probe.u32(obj+0x210),headerColor214=probe.u32(obj+0x214))
    probe.object_guard(obj,rva,group['size']);assert probe.u32(obj+0x180)==hwnd
    groups.append(dict(window=probe.window(hwnd),fields=fields));break
   except RuntimeError:continue
  return True
 @p.CALLBACK
 def top(hwnd,_):
  each(hwnd,0);owner=p.W.DWORD();p.window_pid(hwnd,p.C.byref(owner))
  if owner.value==probe.pid:p.enum_children(hwnd,each,0)
  return True
 p.enum_windows(top,0);report['groupBoxPaintFields']=groups;report['probeSourceSHA256']=hashlib.sha256(source.read_bytes()).hexdigest()
 report['groupPainterRGBInstructions']=probe.read(0xb6a890,6).hex()
 # Fixed software skin cache global, not a search through process data.
 image=probe.u32(0x12e6b60)
 if image:
  vmt=probe.u32(image);assert p.BASE<=vmt< p.BASE+probe.image_size and probe.u32(vmt-76)==vmt
  name=probe.u32(vmt-44);length=probe.u8(name);assert 0<length<80 and p.BASE<=name<name+length+1<p.BASE+probe.image_size
  report['groupSkinCacheType']=probe.read(name+1,length).decode('ascii')
  assert report['groupSkinCacheType']=='TPNGObject'
  chunks=probe.u32(image+0x138);count=probe.u32(chunks+8);assert 0<count<=32
  header=probe.u32(probe.u32(chunks+12));hv=probe.u32(header);assert p.BASE<=hv<p.BASE+probe.image_size and probe.u32(hv-76)==hv
  hn=probe.u32(hv-44);hl=probe.u8(hn);assert 0<hl<80 and p.BASE<=hn<hn+hl+1<p.BASE+probe.image_size
  assert probe.read(hn+1,hl).decode('ascii')=='TChunkIHDR'
  w,h=probe.u32(header+0x458),probe.u32(header+0x45c);assert 0<w<=512 and 0<h<=512
  report['groupSkinSize']=[w,h]
  # TPNGObject's verified DIB path reads pixels at IHDR+450 and BITMAPINFO
  # at IHDR+21. This fixed cache is the software Border.png, never mail images.
  assert (w,h)==(141,22)
  dibw=probe.u32(header+0x25);dibh=probe.u32(header+0x29);bits=int.from_bytes(probe.read(header+0x2f,2),'little')
  assert dibw==w and dibh in [h,(-h)&0xffffffff] and bits in [8,24,32]
  pixels=probe.u32(header+0x450);stride=((w*bits+31)//32)*4;samples=[]
  for y in [0,h//2,h-1]:
   for x in [0,1,w//2,w-1]:
    at=pixels+y*stride+x*(bits//8)
    if bits==8:
     index=probe.u8(at);bgr=probe.read(header+0x49+index*4,3)
    else:bgr=probe.read(at,3)
    samples.append(dict(x=x,y=y,rgb=list(reversed(bgr))))
  assert probe.u32(0x12e6b60)==image and probe.u32(header+0x450)==pixels
  report['groupSoftwareBitmapSamples']=samples
  report['softwareResourceModuleHandle']=hex(probe.u32(0x12ed668))
 dest=root/('canvas-'+time.strftime('%Y%m%d-%H%M%S')+'.json');dest.write_text(json.dumps(report,indent=2))
 print(json.dumps(dict(saved=str(dest),editorCount=report['editorCount'],editors=report['editors'],visibleGroups=[x for x in groups if x['window']['visible']],groupPainterRGB=report['groupPainterRGBInstructions'],groupSkinCacheType=report.get('groupSkinCacheType'),groupSkinSize=report.get('groupSkinSize'),softwareResourceModuleHandle=report.get('softwareResourceModuleHandle'),bitmapSamples=report.get('groupSoftwareBitmapSamples')),ensure_ascii=False))
finally:p.close_handle(probe.handle)
