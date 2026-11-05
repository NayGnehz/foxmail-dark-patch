p='audit-layered-owners.py'
s=open(p,encoding='utf-8-sig').read().replace("if name and len(name)<100:vmts.append((a,name))","if name.startswith('T') and name.isidentifier() and len(name)<100 and 0x840000<a<0x8c0000:vmts.append((a,name))").replace("if hits:print(name,hex(v),hits)","if hits:print(name,hex(v),hits)")
open('audit-layered-owners-targeted.py','w',encoding='utf8').write(s)
