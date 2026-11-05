import struct,sys,os,json
b=open(sys.argv[1],'rb').read()
u32=lambda o:struct.unpack_from('<I',b,o)[0]
u64=lambda o:struct.unpack_from('<Q',b,o)[0]
streams={u32(u32(12)+12*i):(u32(u32(12)+12*i+8),u32(u32(12)+12*i+4)) for i in range(u32(8))}
modules=[];memory=[]
if 4 in streams:
 o=streams[4][0]
 for i in range(u32(o)):
  p=o+4+i*108;n=u32(p+20);name=b[n+4:n+4+u32(n)].decode('utf-16le',errors='replace');modules.append((u64(p),u32(p+8),os.path.basename(name.replace('\\','/'))))
if 3 in streams:
 o=streams[3][0]
 for i in range(u32(o)):
  p=o+4+i*48;memory.append((u64(p+24),u32(p+32),u32(p+36)))
if 5 in streams:
 o=streams[5][0]
 for i in range(u32(o)):
  p=o+4+i*16;memory.append((u64(p),u32(p+8),u32(p+12)))
if 9 in streams:
 o=streams[9][0];r=u64(o+8)
 for i in range(u64(o)):
  p=o+16+i*16;size=u64(p+8);memory.append((u64(p),size,r));r+=size
def symbol(a):
 for base,size,name in modules:
  if base<=a<base+size:return name+'+0x%x'%(a-base)
 return '0x%x'%a
def read(a,n):
 for start,size,r in memory:
  if start<=a and a+n<=start+size:return b[r+a-start:r+a-start+n]
 return b''
o=streams[6][0];c=u32(o+164);regs={name:u32(c+off) for name,off in [('EDI',156),('ESI',160),('EBX',164),('EDX',168),('ECX',172),('EAX',176),('EBP',180),('EIP',184),('ESP',196)]}
result={'code':hex(u32(o+8)),'address':symbol(u64(o+24)),'parameters':[hex(u64(o+40+i*8)) for i in range(min(15,u32(o+32)))],'registers':{k:hex(v) for k,v in regs.items()},'instructionBytes':read(regs['EIP'],24).hex()}
stack=read(regs['ESP'],256);result['stackPointers']=[symbol(struct.unpack_from('<I',stack,i)[0]) for i in range(0,len(stack),4) if any(m[0]<=struct.unpack_from('<I',stack,i)[0]<m[0]+m[1] for m in modules)]
print(json.dumps(result,indent=2))
print('context',u32(o+160),hex(c),b[c:c+48].hex())
print('mainModules',[(hex(base),hex(size),name) for base,size,name in modules if 'foxmail' in name.lower()])
if u32(o+8)==0xeedfade:
 obj=u64(o+48);raw=read(obj,16);print('Delphi exception object',hex(obj),raw.hex())
 if len(raw)>=8:
  ptr=struct.unpack_from('<I',raw,4)[0];length=read(ptr-4,4)
  if length:
   count=struct.unpack('<I',length)[0]
   if 0<count<2048:print('Exception message',read(ptr,min(count,512)*2).decode('utf-16le',errors='replace'))
