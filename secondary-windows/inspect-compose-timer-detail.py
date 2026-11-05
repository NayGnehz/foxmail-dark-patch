exec(open(r'D:\Workspace\Foxmail\secondary-windows\inspect-compose-timer.py',encoding='utf-8-sig').read().split('for i in n.md.disasm')[0])
n.md.skipdata=True
for i in n.md.disasm(n.b[n.off(0xD0B000):n.off(0xD20000)],0xD0B000):
 if '0x430' in i.op_str:print('timerref',hex(i.address),i.mnemonic,i.op_str)
d=json.loads((r/'resource-inventory/TFOXCOMPOSEFORM.dfm.json').read_text())
def walk(x):
 if x['name'] in ['ToolBar','RightToolBar','toolbarPanel','tbDock','TimerOnShow']:print('DFM',x['name'],x['className'],[(p['name'],p['value']) for p in x['properties'] if p['name'] in ['Color','ParentColor','DoubleBuffered','Visible','Align','Enabled','Interval']])
 for c in x['children']:walk(c)
walk(d)
for name in ['TTimer','TTBXToolbar','TTBXDock','TXPanel','TCustomForm','TFoxComposeForm']:
 for v in n.classes(name):print('CLASS',name,hex(v),'slot7c',hex(n.read(v+0x7c)))
for a,z in [(0x66D0F8,90),(0xD1D5A4,160),(0xB88FA8,340),(0xB8AA1C,120),(0xB999C0,140),(0xA1EDF0,140)]:
 print('ROUTINE',hex(a));n.dis(a,z)
