exec(open('secondary-windows/inspect-print-static-strings.py',encoding='utf-8-sig').read().split('for name')[0])
for a in [0xff2a36,0xff704a]:
 print('around',hex(a),n.b[n.off(a)-8:n.off(a)+90].decode('utf-16le','replace'));print('refs-minus4',list(map(hex,n.refs(a-4))))
for name in ['print_mail_frame','PrintToPDF','print_to_pdf','PrintBackgrounds','PrintPreview','background-color']:
 at=n.b.find(name.encode());i=0
 while at>=0 and i<8:
  a=n.va(at);print('ANSI',name,hex(a),'refs',list(map(hex,n.refs(a)))[:10]);at=n.b.find(name.encode(),at+1);i+=1
