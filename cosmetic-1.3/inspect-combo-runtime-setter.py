# FOXMAIL_RETIRED_BASELINE_CLI: old experiment source retained; baseline EXE retired by explicit approval.
if __name__ == '__main__':
    raise SystemExit('Retired historical baseline CLI. See docs/cleanup-report-20261105.md and existing audit reports; use the current print/compose entry.')
import importlib.util
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('cosmetic-1.2/payload/Foxmail深色.exe','rb').read()
for h in ['8982b8020000','8990b8020000']:
 o=n.off(0xb70000)
 while True:
  o=n.b.find(bytes.fromhex(h),o,n.off(0xb73000))
  if o<0:break
  p=n.b.rfind(bytes.fromhex('558bec'),o-65,o);print(hex(n.va(p)));n.dis(n.va(p),45);o+=1
