exec(open(r'D:\Workspace\Foxmail\secondary-windows\inspect-compose-delayed-paths.py',encoding='utf-8-sig').read().split('for a in [')[0])
for a,z in [(0xD25FE8,0x240),(0xD27128,0x100),(0xD153E4,0xA0),(0x66D174,0x50)]:print('ROUTINE',hex(a));n.dis(a,z)
for a in [0x408CE0]:print('API',hex(a),api(a))
