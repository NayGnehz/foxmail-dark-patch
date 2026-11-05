exec(open(r'D:\Workspace\Foxmail\secondary-windows\inspect-compose-delayed-paths.py',encoding='utf-8-sig').read().split('for a in [')[0])
for a in [0x408d60,0x408f80]:print('API',hex(a),api(a))
for a,z in [(18033924,250),(0x112BE68,90),(0x1119328,150),(0x112AA00,200),(17943636,230),(0x66CFD0,125)]:
 print('ROUTINE',hex(a));n.dis(a,z)
