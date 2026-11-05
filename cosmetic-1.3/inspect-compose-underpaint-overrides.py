# FOXMAIL_RETIRED_BASELINE_CLI: old experiment source retained; baseline EXE retired by explicit approval.
if __name__ == '__main__':
    raise SystemExit('Retired historical baseline CLI. See docs/cleanup-report-20261105.md and existing audit reports; use the current print/compose entry.')
import importlib.util
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('cosmetic-1.2/payload/Foxmail深色.exe','rb').read()
for a in [0xc230ff,0xc23171,0xc231f6]:n.dis(a,20)
for v in n.classes('TFMComboBox'):n.dis(n.read(v+0x2c),270)
