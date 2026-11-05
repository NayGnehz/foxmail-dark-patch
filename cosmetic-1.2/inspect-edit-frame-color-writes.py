# FOXMAIL_RETIRED_BASELINE_CLI: old experiment source retained; baseline EXE retired by explicit approval.
if __name__ == '__main__':
    raise SystemExit('Retired historical baseline CLI. See docs/cleanup-report-20261105.md and existing audit reports; use the current print/compose entry.')
import importlib.util,struct
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('cosmetic-1.1/payload/Foxmail深色.exe','rb').read()
for start,end in [(0xf98c00,0xf9d000),(0xdb4d00,0xdb7000)]:
 for i in range(n.off(start),n.off(end)):
  if n.b[i]==0xe8 and n.va(i)+5+struct.unpack_from('<i',n.b,i+1)[0]==0x112a88c:print('\nSETCOLOR',hex(n.va(i)));n.dis(n.va(i)-20,30)
