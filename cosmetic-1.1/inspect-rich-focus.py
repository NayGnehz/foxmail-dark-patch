import importlib.util
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
n.b=open('reveal-gate-v2/Foxmail-dark-reveal.exe','rb').read()
for start,size in [(0xb42a98,300),(0xb42fdc,145),(0xb438f0,55),(0xb43970,140),(0x87ba8c,620),(0x87b274,328)]:print('\nROUTE',hex(start));n.dis(start,size)
