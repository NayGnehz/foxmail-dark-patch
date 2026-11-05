import importlib.util
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('reveal-gate-v2/Foxmail-dark-reveal.exe','rb').read()
for start,size in [(0xfbdfc0,596),(0xfb9104,300),(0xb43450,235),(0x68d404,185)]:print('\nROUTE',hex(start));n.dis(start,size)
