import importlib.util
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('reveal-gate-v2/Foxmail-dark-reveal.exe','rb').read()
for start,size in [(0x655d60,105),(0xb4317c,500),(0x68cd98,100)]:print('\nROUTE',hex(start));n.dis(start,size)
for addr in [0x87c26c,0x87c2b0,0x87c2ec,0x87c32c]:
 o=n.off(addr);s=n.b[o:o+160].split(b'\x00\x00')[0];print(hex(addr),n.b[o:o+160].decode('utf-16le',errors='ignore').split('\x00')[0])
