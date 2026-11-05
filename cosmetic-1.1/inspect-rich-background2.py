import importlib.util
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
n.b=open('reveal-gate-v2/Foxmail-dark-reveal.exe','rb').read()
for start,size in [(0xb27cb8,64),(0xb42bc4,1040),(0xa8d7dc,500),(0xab7138,400)]:print('\nROUTE',hex(start));n.dis(start,size)
