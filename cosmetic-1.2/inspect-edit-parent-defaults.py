# FOXMAIL_RETIRED_BASELINE_CLI: old experiment source retained; baseline EXE retired by explicit approval.
if __name__ == '__main__':
    raise SystemExit('Retired historical baseline CLI. See docs/cleanup-report-20261105.md and existing audit reports; use the current print/compose entry.')
import importlib.util
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('cosmetic-1.1/payload/Foxmail深色.exe','rb').read()
for name in ['TXPanel','TFMGroupBox']:
 for v in n.classes(name):
  for _ in range(8):
   print(name,hex(v),n.classname(v));p=n.read(v-36)
   if not p:break
   v=n.read(p)
for start,size in [(0xa1e2a8,420),(0xb6a3e8,360)]:print('\nCTOR',hex(start));n.dis(start,size)
