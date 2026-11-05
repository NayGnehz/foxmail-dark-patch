# FOXMAIL_RETIRED_BASELINE_CLI: old experiment source retained; baseline EXE retired by explicit approval.
if __name__ == '__main__':
    raise SystemExit('Retired historical baseline CLI. See docs/cleanup-report-20261105.md and existing audit reports; use the current print/compose entry.')
import importlib.util,struct,json
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('cosmetic-1.2/payload/Foxmail深色.exe','rb').read()
for target in [0xb433e8]:
 print('\nTARGET',hex(target),'absolute refs',[hex(x) for x in n.refs(target)])
 calls=[]
 for name,r,raw,size in n.sections:
  if r>0xc00000:continue
  i=raw
  while True:
   i=n.b.find(b'\xe8',i,raw+size-4)
   if i<0:break
   if n.va(i)+5+struct.unpack_from('<i',n.b,i+1)[0]==target:calls.append(n.va(i))
   i+=1
 print('CALLS',len(calls),[hex(x) for x in calls])
 for addr in calls:print('\nCALLER',hex(addr));n.dis(addr-24,38)

