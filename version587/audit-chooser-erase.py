"""Original and deployed-candidate erase bytes only; no live process access."""
import hashlib, importlib.util, json, os, struct
from pathlib import Path

temp=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp'
os.environ['FOXMAIL_STATIC_EXE']=str(temp/'version587-guard-wsb-7da1a592/guest-input/Foxmail/Foxmail.exe')
spec=importlib.util.spec_from_file_location('native',Path(__file__).parent.parent/'native-whitebars.py')
n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
original=n.b
assert hashlib.sha256(original).hexdigest()=='f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'
site=0x9872c8
original_handler=original[n.off(site):n.off(site)+26]
assert original_handler.hex()=='558bec83c4f88955f88945fc8b45f8c7400c0100000059595dc3'
string_vmt=next(n.classes('TVirtualStringTree'))
draw_vmt=next(n.classes('TVirtualDrawTree'))
metadata=json.loads((temp/'version587-native/Foxmail深色.exe.json').read_text(encoding='utf-8'))
erase=next(s for s in metadata['nativeInitialErase']['sites']if s['name']=='virtualDrawTree')
candidate=(temp/'version587-search-chooser-followup/Foxmail.exe').read_bytes()
assert hashlib.sha256(candidate).hexdigest()=='ff1e6f70c7bb551242ce441b8008a1ff211dbbcfe812d3866e713d31d6d865a6'
n.b=candidate
pe=struct.unpack_from('<I',candidate,60)[0];op=pe+24;table=op+struct.unpack_from('<H',candidate,pe+20)[0]
n.sections=[]
for i in range(struct.unpack_from('<H',candidate,pe+6)[0]):
 p=table+i*40
 name=candidate[p:p+8].rstrip(b'\0').decode()
 n.sections.append((name,struct.unpack_from('<I',candidate,p+12)[0],struct.unpack_from('<I',candidate,p+20)[0],struct.unpack_from('<I',candidate,p+16)[0]))
at=n.off(site);assert candidate[at]==0xe9
target=site+5+struct.unpack_from('<i',candidate,at+1)[0]
assert target==0x400000+erase['entryRva']
stub=candidate[n.off(target):n.off(target)+erase['size']]
draw_cmp=b'\x3d'+struct.pack('<I',draw_vmt-0x400000)
assert stub.count(draw_cmp)==1
assert b'\x3d'+struct.pack('<I',string_vmt-0x400000)not in stub
pos=stub.index(draw_cmp)
assert stub[pos+5:pos+7]==b'\x0f\x84'and stub[pos+11]==0xe9
report={'originalHandlerSHA256':hashlib.sha256(original_handler).hexdigest(),
 'originalHandlerOnlyAcknowledgesErase':True,'handlerVA':hex(site),'candidateHookVA':hex(target),
 'drawVmt':hex(draw_vmt),'stringVmt':hex(string_vmt),'hookVmtRvas':erase['vmtRvas'],
 'stringTreeHasNoPrefillInCurrentHook':True,'candidateSHA256':hashlib.sha256(candidate).hexdigest(),
 'scope':'Static evidence of an uncovered erase class. No visual A/B or timing attribution.'}
stage=temp/'version587-search-chooser-followup'
(stage/'erase-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
