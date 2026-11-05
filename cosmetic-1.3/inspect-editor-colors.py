exec(open('cosmetic-1.3/inspect-editor-chrome.py',encoding='utf-8-sig').read().split('v=0x')[0])
for start,end in [(0xb84dec,0xb85790),(0xb94d00,0xb95000),(0xb88c00,0xb88fa8)]:
 for i in n.md.disasm(n.b[n.off(start):n.off(end)],start):
  if i.mnemonic in ('mov','push') and any(hex(x) in i.op_str for x in [0xffffff,0xc0c0c0,0xe8e2db,0x1fffffff,0xff000005,0xadadad,0xb5ada5]):print(hex(i.address),i.bytes.hex(),i.mnemonic,i.op_str)
print('BASE METHODS')
for q in range(0,0xcc,4):print(hex(q),hex(n.read(0xb83760+q)))
