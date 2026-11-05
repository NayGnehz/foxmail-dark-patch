exec(open('audit-layered-refs.py',encoding='utf-8-sig').read().split('def cstr')[0])
for word in ['DwmExtendFrameIntoClientArea','DwmEnableBlurBehindWindow','DwmIsCompositionEnabled','SetLayeredWindowAttributes']:
 at=n.b.find(word.encode('utf-16le'));print(word,hex(n.va(at)) if at>=0 else None,list(map(hex,n.refs(n.va(at)))) if at>=0 else [])
for a,z in [(0xa0cae8,105),(0xa1b26e,95),(0xa1b61c,52)]:print('RANGE',hex(a));n.dis(a,z)
for x in [0x12f6ad4,0x12f6ad0,0xa0cae8]:print('REFS',hex(x),list(map(hex,n.refs(x))),'CALLS',list(map(hex,calls(x))))
