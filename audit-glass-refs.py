exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
for word in ['DwmExtendFrameIntoClientArea','DwmEnableBlurBehindWindow','DwmSetWindowAttribute','AlphaBlend','TransparentColor','AlphaBlendValue']:
 at=n.b.find(word.encode());print(word,hex(n.va(at)) if at>=0 else None,list(map(hex,n.refs(n.va(at)))) if at>=0 else [])
for a,z in [(0xa1b650,50),(0xa0cabc,100),(0xa1b080,100),(0xa1b0cc,100)]:print('RANGE',hex(a));n.dis(a,z)
