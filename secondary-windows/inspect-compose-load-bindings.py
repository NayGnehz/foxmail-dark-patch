exec(open(r'D:\Workspace\Foxmail\secondary-windows\inspect-compose-delayed-paths.py',encoding='utf-8-sig').read().split('for a in [')[0])
import json
j=json.loads((r/'cosmetic-1.3/class-method-index.json').read_text())
for v,c,name in j['methods']:
 if c=='TTimer' and not name.startswith('vslot'): print('TIMER',hex(v),name)
def walk(x,path):
 path=path+'.'+x['name']
 for p in x['properties']:
  if p['name'].startswith('On') and any(t in p['name'].lower() for t in ['load','create','resize','show','ready','init']):print(path,x['className'],p['name'],p['value'])
 for c in x['children']:walk(c,path)
for file in ['TFOXCOMPOSEFRAME','TFOXCOMPOSEFORM']:walk(json.loads((r/f'resource-inventory/{file}.dfm.json').read_text()),file)
for a,z in [(0xB7B60C,0x150),(0xB83F4C,0x51),(0xB89230,0x145),(0x111A918,0x90)]:
 print('ROUTINE',hex(a));n.dis(a,z)
