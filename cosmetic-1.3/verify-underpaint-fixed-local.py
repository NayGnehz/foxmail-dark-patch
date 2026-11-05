# FOXMAIL_RETIRED_BASELINE_CLI: old experiment source retained; baseline EXE retired by explicit approval.
if __name__ == '__main__':
    raise SystemExit('Retired historical baseline CLI. See docs/cleanup-report-20261105.md and existing audit reports; use the current print/compose entry.')
import importlib.util,hashlib,json
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('cosmetic-1.2/payload/Foxmail深色.exe','rb').read()
print('HELPER SHA',hashlib.sha256(n.b[n.off(0x87b3bc):n.off(0x87b591)]).hexdigest())
print('INHERITSFROM');n.dis(0x40434c,65)
print('REPLACEMENT FIXTURE')
f=bytes.fromhex('c745e420202000eb23');open('cosmetic-1.3/shared-edit-underpaint-fixture.bin','wb').write(f)
for i in n.md.disasm(f,0x87b3e7):print(hex(i.address),i.mnemonic,i.op_str)
print('POSTJOIN WINDOW');n.dis(0x87b413,36)
