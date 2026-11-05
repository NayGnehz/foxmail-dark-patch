import importlib.util
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('reveal-gate-v2/Foxmail-dark-reveal.exe','rb').read()
for start,size in [(0xfbf2e0,100),(0xfd2c30,100),(0xd045ac,80),(0xcd42c0,80),(0xfbdf38,140)]:print('\nROUTE',hex(start));n.dis(start,size)
