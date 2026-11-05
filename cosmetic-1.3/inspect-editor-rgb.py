exec(open('cosmetic-1.3/inspect-editor-chrome.py',encoding='utf-8-sig').read().split('v=0x')[0])
for start,end in [(0xb84b04,0xb8998c),(0xb89d00,0xb8d000)]:
 for i in n.md.disasm(n.b[n.off(start):n.off(end)],start):
  if i.mnemonic=='mov' and i.op_str.startswith('edx, 0x'):
   x=int(i.op_str.split('0x')[1],16)
   if x>0xffff and not (0x400000<=x<0x1300000): print(hex(i.address),i.bytes.hex(),i.op_str)
