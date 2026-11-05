exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
import pathlib,json
for field in [0x2e0,0x2e1]:
 print('FIELD',hex(field))
 for ref in n.refs(field):
  if 0x640000<ref<0x1139000:
   o=n.off(ref);pre=n.b[o-2:o];
   if pre[:1] in [b'\xc6',b'\x88']:print(hex(ref-2),n.b[o-2:o+6].hex())
for p in pathlib.Path('resource-inventory').glob('*.dfm.json'):
 if p.name not in ['TOPTIONFORM.dfm.json']:continue
 data=json.loads(p.read_text(encoding='utf8'))
 def walk(x):
  if isinstance(x,dict):
   if any(k in str(x.get('name','')) for k in ['Alpha','Transparent','Animate']):print(p.name,x)
   for v in x.values():walk(v)
  elif isinstance(x,list):
   for y in x:walk(y)
 walk(data)
