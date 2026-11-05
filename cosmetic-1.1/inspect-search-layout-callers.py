import importlib.util,struct
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('reveal-gate-v2/Foxmail-dark-reveal.exe','rb').read()
print('relative call references to search layout FB912C')
for section,r,raw,size in n.sections:
 if not (r < 0xC00000):continue
 for i in range(raw,raw+size-5):
  if n.b[i]==0xe8 and n.va(i)+5+struct.unpack_from('<i',n.b,i+1)[0]==0xfb912c:print(hex(n.va(i)));n.dis(n.va(i)-3,15)

