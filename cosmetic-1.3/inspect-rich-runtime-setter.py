# FOXMAIL_RETIRED_BASELINE_CLI: old experiment source retained; baseline EXE retired by explicit approval.
if __name__ == '__main__':
    raise SystemExit('Retired historical baseline CLI. See docs/cleanup-report-20261105.md and existing audit reports; use the current print/compose entry.')
import importlib.util,struct
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('cosmetic-1.2/payload/Foxmail深色.exe','rb').read()
needle=bytes.fromhex('89820c030000');o=n.off(0xb42a00);end=n.off(0xb44000)
while True:
 o=n.b.find(needle,o,end)
 if o<0:break
 start=n.b.rfind(bytes.fromhex('558bec'),max(0,o-60),o);print('RICH SETTER',hex(n.va(start)));n.dis(n.va(start),48);o+=1
