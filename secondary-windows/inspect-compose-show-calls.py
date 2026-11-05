exec(open(r'D:\Workspace\Foxmail\secondary-windows\inspect-compose-delayed-paths.py',encoding='utf-8-sig').read().split('for a in [')[0])
import json
j=json.loads((r/'cosmetic-1.3/class-method-index.json').read_text()); methods=j['methods']; by={}
for v,c,name in methods:by.setdefault(v,[]).append(c+'.'+name)
for a,z in [(0x111CC54,0x5E0),(0x1119328,0x60),(0xB88FA8,0x6A)]:
 print('CALLS',hex(a))
 for i in n.md.disasm(n.b[n.off(a):n.off(a)+z],a):
  if i.mnemonic in ['call','jmp'] and i.op_str.startswith('0x'):
   target=int(i.op_str,16);print(hex(i.address),i.mnemonic,hex(target),api(target) if target<0x410000 else ','.join(by.get(target,[])[:4]))
for v,c,name in methods:
 if ('Host' in c or 'Chromium' in c) and (name=='message0x5' or 'Resize' in name): print('HOST',hex(v),c,name)
for c in j['classes']:
 if 'Host' in c[1] or 'Pool' in c[1] and 'Cef' in c[1]:print('TYPE',hex(c[0]),c[1])
