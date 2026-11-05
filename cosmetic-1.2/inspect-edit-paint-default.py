# FOXMAIL_RETIRED_BASELINE_CLI: old experiment source retained; baseline EXE retired by explicit approval.
if __name__ == '__main__':
    raise SystemExit('Retired historical baseline CLI. See docs/cleanup-report-20261105.md and existing audit reports; use the current print/compose entry.')
import importlib.util
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('cosmetic-1.1/payload/Foxmail深色.exe','rb').read()
for start,size in [(0xb27c10,40),(0xb27cf8,36),(0xb27bb0,100),(0x1130594,350),(0x1134160,220)]:print('\nROUTE',hex(start));n.dis(start,size)
