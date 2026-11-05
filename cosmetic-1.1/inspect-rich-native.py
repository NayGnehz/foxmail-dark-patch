import importlib.util,struct
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
n.b=open('reveal-gate-v2/Foxmail-dark-reveal.exe','rb').read()
for v in n.classes('TCustomRichEdit'):
 print('VMT',hex(v));d=n.read(v-48);o=n.off(d);c=struct.unpack_from('<H',n.b,o)[0]
 for i in range(c):print('msg',hex(struct.unpack_from('<H',n.b,o+2+2*i)[0]),hex(struct.unpack_from('<I',n.b,o+2+c*2+4*i)[0]))
for start,size in [(0x68cb00,430),(0x87c1a0,360)]:print('\nROUTE',hex(start));n.dis(start,size)
# message immediates in original code only
for i in range(n.off(0x680000),n.off(0x69f000)):
 if n.b[i:i+5]==bytes.fromhex('6843040000'):print('EM_SETBKGNDCOLOR ref',hex(n.va(i)));n.dis(n.va(i)-20,65)
