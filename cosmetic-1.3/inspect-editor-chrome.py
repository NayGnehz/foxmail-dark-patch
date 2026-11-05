import importlib.util
s=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
v=0xb946f0
while v:
 print('CLASS',n.classname(v),hex(v))
 for q in [0x2c,0x30,0xbc,0xcc,0xd0,0xd4,0xd8,0xdc,0xe0,0xe4,0xe8,0xec,0xf0,0xf4,0xf8]:print(hex(q),hex(n.read(v+q)))
 p=n.read(v-36);v=n.read(p) if p else 0
print('CONSTRUCTOR COLOR CONSTANTS')
for i in n.md.disasm(n.b[n.off(0xb8998c):n.off(0xb8998c)+1300],0xb8998c):
 if i.mnemonic in ('mov','push') and ('0xffffff' in i.op_str or '0xc0c0c0' in i.op_str or '0xadadad' in i.op_str or '0x303' in i.op_str):print(hex(i.address),i.mnemonic,i.op_str)
