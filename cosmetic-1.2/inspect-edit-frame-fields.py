# FOXMAIL_RETIRED_BASELINE_CLI: old experiment source retained; baseline EXE retired by explicit approval.
if __name__ == '__main__':
    raise SystemExit('Retired historical baseline CLI. See docs/cleanup-report-20261105.md and existing audit reports; use the current print/compose entry.')
import importlib.util,struct
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('cosmetic-1.1/payload/Foxmail深色.exe','rb').read()
for name in ['TMailListSearchFrame','TNetworkOptionFrame']:
 for v in n.classes(name):
  print(name,'VMT',hex(v),'ctor',hex(n.read(v+0x2c)));f=n.read(v-56);o=n.off(f);c=struct.unpack_from('<H',n.b,o)[0];o+=6
  for i in range(c):
   off,typ=struct.unpack_from('<IH',n.b,o);ln=n.b[o+6];s=n.b[o+7:o+7+ln].decode('latin1');print('field',hex(off),s);o+=7+ln
