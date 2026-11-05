# FOXMAIL_RETIRED_BASELINE_CLI: old experiment source retained; baseline EXE retired by explicit approval.
if __name__ == '__main__':
    raise SystemExit('Retired historical baseline CLI. See docs/cleanup-report-20261105.md and existing audit reports; use the current print/compose entry.')
import importlib.util
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('cosmetic-1.1/payload/Foxmail深色.exe','rb').read()
for a in [0x669ef4,0x87cda8,0x1113a24,0x881b70,0x111462c,0x875524,0x66a80c,0x66aa28]:
 try:print(hex(a),hex(n.read(a)),n.classname(n.read(a)))
 except Exception as e:print(e)
for name in ['TXPanel','TFMGroupBox']:
 for v in n.classes(name):print(name,hex(v),'ctor',hex(n.read(v+0x2c)))
n.dis(0x656994,160)
