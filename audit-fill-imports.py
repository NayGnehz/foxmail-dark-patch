import importlib.util,pathlib,struct
spec=importlib.util.spec_from_file_location('native',pathlib.Path(__file__).with_name('native-whitebars.py'))
n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
def calls(target):
 out=[]
 for name,r,f,s in n.sections:
  if name!='CODE':continue
  p=f
  while True:
   p=n.b.find(b'\xe8',p,f+s)
   if p<0:break
   a=n.va(p)
   if a+5+struct.unpack_from('<i',n.b,p+1)[0]==target:out.append(a)
   p+=1
 return out
for name,iat in [('GdipGraphicsClear',15709152),('SetClassLongA',15705792),('ExtTextOutW',15706972),('ExtTextOutA',15706976),('GdipCreateSolidFill',15710324)]:
 print(name)
 for ref in n.refs(0x400000+iat):
  if n.b[n.off(ref)-2:n.off(ref)]!=b'\xff\x25':continue
  thunk=ref-2;sites=calls(thunk);print('Thunk',hex(thunk),'sites',list(map(hex,sites)))
  if len(sites)<20:
   for s in sites:n.dis(s-25,48)
