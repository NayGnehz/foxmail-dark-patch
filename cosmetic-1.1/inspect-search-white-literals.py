import importlib.util
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('reveal-gate-v2/Foxmail-dark-reveal.exe','rb').read()
for name,start,end in [('mail',0xfb8000,0xfc9000),('archive',0xfd0000,0xfd4000),('address',0xd42000,0xd48000),('calendar',0xd03000,0xd06000),('note',0xcd3000,0xcd6000)]:
 o=n.off(start);stop=n.off(end)
 while True:
  o=n.b.find(bytes.fromhex('baffffff00'),o,stop)
  if o<0:break
  print('\nWHITE',name,hex(n.va(o)));n.dis(n.va(o),30);o+=5
print('LAYOUT REFS',*[hex(a) for a in n.refs(0xfb912c)])
