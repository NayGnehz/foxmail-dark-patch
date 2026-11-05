import importlib.util
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
n.b=open('reveal-gate-v2/Foxmail-dark-reveal.exe','rb').read()
for start,size in [(0xb27534,1100),(0xb279cc,500),(0xb27e28,180),(0x1132578,100)]:
 print('\nROUTE',hex(start));n.dis(start,size)
