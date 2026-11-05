exec(open(r'D:\Workspace\Foxmail\secondary-windows\inspect-compose-delayed-paths.py',encoding='utf-8-sig').read().split('for a in [')[0])
for a,z in [(0xD1E13C,0x128),(0xD27128,0x68),(0xD153E4,0x48)]:print('ROUTINE',hex(a));n.dis(a,z)
