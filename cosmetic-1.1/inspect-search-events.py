import importlib.util,struct
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('reveal-gate-v2/Foxmail-dark-reveal.exe','rb').read()
for name in ['TMailAppFrame','TMailArchiveAppFrame','TAddressAppFrame','TCalendarAppFrame','TNoteAppFrame']:
 for v in n.classes(name):
  print('CLASS',name,hex(v));t=n.read(v-52)
  if t:
   o=n.off(t);c=struct.unpack_from('<H',n.b,o)[0];o+=2
   for i in range(c):
    size,addr=struct.unpack_from('<HI',n.b,o);ln=n.b[o+6];s=n.b[o+7:o+7+ln].decode('latin1')
    if any(x in s.lower() for x in ['search','enter','focus','paint']):print(s,hex(addr))
    o+=size
  # fieldtable header entries: count uint16 + class table ptr, entries offset/classindex/name
  f=n.read(v-56)
  if f:
   o=n.off(f);c=struct.unpack_from('<H',n.b,o)[0];print('fieldtable',hex(f),c);o+=6
   for i in range(c):
    offset,typ=struct.unpack_from('<IH',n.b,o);ln=n.b[o+6];s=n.b[o+7:o+7+ln].decode('latin1')
    if 'search' in s.lower():print('FIELD',s,hex(offset),typ)
    o+=7+ln
