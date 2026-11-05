import importlib.util,pathlib,json,struct
r=pathlib.Path(r'D:\Workspace\Foxmail');s=importlib.util.spec_from_file_location('n',r/'native-whitebars.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
v=0xD0AEB8;p=n.read(v-56);o=n.off(p);print('fieldtable',hex(p),'header',n.b[o:o+24].hex());count=struct.unpack_from('<H',n.b,o)[0];q=o+6
for i in range(count):
 offset,typ=struct.unpack_from('<IH',n.b,q);length=n.b[q+6];name=n.b[q+7:q+7+length].decode(errors='replace');q+=7+length
 if offset in [0x430,0x41c,0x508,0x500,0x418]:print(hex(offset),typ,name)
j=json.loads((r/'cosmetic-1.3/class-method-index.json').read_text());print('keys',list(j))
for key,items in j.items():
 if key=='classes':continue
 for x in items:
  if isinstance(x,list) and len(x)>2 and x[1] in ['TFoxComposeForm','TCustomForm','TWinControl','TXPanel','TPanel'] and ('7c' in x[2] or 'Show' in x[2] or x[2].startswith('message0xb0')):print(key,x)
for i in n.md.disasm(n.b[n.off(0xD0AEB8):n.off(0xD20000)],0xD0AEB8):
 if '0x430' in i.op_str:
  print('timerref',hex(i.address),i.mnemonic,i.op_str)
