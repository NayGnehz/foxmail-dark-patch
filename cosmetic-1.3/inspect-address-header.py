import importlib.util,struct,json,pathlib
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
rows=[];code=[]
for v in n.classes('TDlg_SelAddr'):
 p=n.off(n.read(v-52));count=struct.unpack_from('<H',n.b,p)[0];p+=2
 for i in range(count):
  size,addr=struct.unpack_from('<HI',n.b,p);ln=n.b[p+6];name=n.b[p+7:p+7+ln].decode('latin1');p+=size
  rows.append({'name':name,'va':hex(addr)})
  if name in ('FormCreate','FormShow'):
   for ins in n.md.disasm(n.b[n.off(addr):n.off(addr)+10000],addr):
    code.append(f'{ins.address:08x} {ins.bytes.hex():24s} {ins.mnemonic:8s} {ins.op_str}')
    if ins.mnemonic=='ret':break
pathlib.Path('cosmetic-1.3/address-header-methods.json').write_text(json.dumps(rows,indent=2))
pathlib.Path('cosmetic-1.3/address-header-create.txt').write_text('\n'.join(code))
print(json.dumps([r for r in rows if any(x in r['name'].lower() for x in ('header','paint','draw','create','show'))]))
