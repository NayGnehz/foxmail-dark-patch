import importlib.util
s=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
for name in ['background-color','print_mail_frame.html','PrintToPDF','D2J_Print','GetPrintHTML','PrintPreview']:
 needle=name.encode('utf-16le');at=n.b.find(needle);count=0
 while at>=0 and count<15:
  a=n.va(at);print(name,hex(a),'refs',list(map(hex,n.refs(a)))[:15]);at=n.b.find(needle,at+1);count+=1
