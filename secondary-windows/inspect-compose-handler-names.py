exec(open(r'D:\Workspace\Foxmail\secondary-windows\inspect-compose-delayed-paths.py',encoding='utf-8-sig').read().split('for a in [')[0])
import json
j=json.loads((r/'cosmetic-1.3/class-method-index.json').read_text())
for v,c,name in j['methods']:
 if c in ['TFoxComposeFrame','TFoxComposeForm','TFoxHTMLEditorBase','TFoxHTMLEditor','TCustomForm'] and any(t in name.lower() for t in ['resize','loaded','ready','show','loadend']):print(hex(v),c,name)
for a,z in [(0x1133328,56),(0x11332F0,56),(0x66CFF0,100)]: print('ROUTINE',hex(a));n.dis(a,z)
# exact E8 call references to generic Show (not indirect calls), addresses only
for sect,rv,raw,size in n.sections:
 if sect!='.text':continue
 data=n.b[raw:raw+size]
 for at in range(len(data)-4):
  if data[at]==0xE8:
   source=n.base+rv+at;delta=struct.unpack_from('<i',data,at+1)[0]
   if source+5+delta==0x111D5A4 and 0xD00000<=source<0xD30000: print('COMPOSE_RANGE_SHOW_CALL',hex(source))
