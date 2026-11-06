"""Static 563 -> 587 instruction/RTTI mapping. Never touches running Foxmail."""
from pathlib import Path
import os,sys,struct,json,re,hashlib
workspace=Path(os.environ['PORTABLE_WORKSPACE_ROOT'])
sys.path.insert(0,str(workspace/'_开发环境/tools/python-libs/capstone/5.0.9/win-x64'))
from capstone import Cs,CS_ARCH_X86,CS_MODE_32,CS_OP_IMM,CS_OP_REG,CS_OP_MEM
md=Cs(CS_ARCH_X86,CS_MODE_32);md.detail=True
old=(workspace/'_开发环境/feeds/native/foxmail-build-inputs/cosmetic-a3d3700d/Foxmail深色.exe').read_bytes()
assert hashlib.sha256(old).hexdigest()=='a3d3700d0c5e60810c4694fb0a49216da65460050c467e359d322183ac8576fb'
new=Path(r'D:\Users\Public\Downloads\Foxmail\Foxmail.exe').read_bytes()
assert hashlib.sha256(new).hexdigest()=='f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399'
def sections(b):
 p=struct.unpack_from('<I',b,60)[0];so=p+24+struct.unpack_from('<H',b,p+20)[0]
 return [struct.unpack_from('<IIII',b,so+i*40+8)for i in range(struct.unpack_from('<H',b,p+6)[0])]
os_,ns=sections(old),sections(new)
def off(a,ss):
 for vs,r,n,p in ss:
  if 0x400000+r<=a<0x400000+r+n:return p+a-0x400000-r
 raise ValueError(hex(a))
def u(b,a,ss):return struct.unpack_from('<I',b,off(a,ss))[0]
def instructions(b,a,ss,n=768):
 p=off(a,ss);return list(md.disasm(b[p:p+n],a))
def token(i):
 parts=[i.mnemonic]
 for o in i.operands:
  if o.type==CS_OP_REG:parts.append(('r',o.reg))
  elif o.type==CS_OP_IMM:parts.append(('i',))
  elif o.type==CS_OP_MEM:
   m=o.mem;parts.append(('m',m.segment,m.base,m.index,m.scale,'absolute' if not m.base and not m.index else m.disp))
  else:parts.append(('other',o.type))
 return tuple(parts)
def masked(i):
 data=bytearray(i.bytes);mask=[True]*len(data)
 if i.imm_size:
  for j in range(i.imm_offset,i.imm_offset+i.imm_size):mask[j]=False
 if i.disp_size and any(o.type==CS_OP_MEM and not o.mem.base and not o.mem.index for o in i.operands):
  for j in range(i.disp_offset,i.disp_offset+i.disp_size):mask[j]=False
 return b''.join(re.escape(bytes([x]))if keep else b'.'for x,keep in zip(data,mask))
def map_code(address,skip=0):
 a=address+skip;seq=instructions(old,a,os_)
 # Match an instruction-aligned masked byte anchor, then independently compare
 # normalized instructions. Every accepted candidate must be unique in range.
 regex=re.compile(b''.join(masked(i)for i in seq[:6]),re.DOTALL)
 lo=max(0x401000,a-0x20000);hi=min(0x401000+ns[0][2]-1024,a+0x20000)
 raw=off(lo,ns);rawend=off(hi,ns)
 candidates=[lo+m.start()for m in regex.finditer(new[raw:rawend])]
 for count in (48,32,24):
  hits=[]
  for target in candidates:
   other=instructions(new,target,ns)
   if len(other)>=count and [token(i)for i in seq[:count]]==[token(i)for i in other[:count]]:hits.append(target)
  if len(hits)==1:
   target=hits[0]-skip
   other=instructions(new,hits[0],ns)
   return dict(oldVA=address,newVA=target,skip=skip,normalizedInstructions=count,
               instructionMap=[[x.address,y.address]for x,y in zip(seq[:count],other[:count])],
               uniqueInRange=True,newBytes=new[off(target,ns):off(target,ns)+64].hex())
 raise RuntimeError('No unique normalized match '+hex(address)+' candidates='+str(len(candidates)))
def map_vmt(address):
 p=u(old,address-44,os_);q=off(p,os_);name=old[q:q+old[q]+1]
 matches=[];at=0
 while True:
  at=new.find(name,at)
  if at<0:break
  for vs,r,n,raw in ns:
   if raw<=at<raw+n:
    pointer=0x400000+r+at-raw;ref=0
    while True:
     ref=new.find(struct.pack('<I',pointer),ref)
     if ref<0:break
     for _,rr,nn,pp in ns:
      if pp<=ref<pp+nn:
       v=0x400000+rr+ref-pp+44
       try:
        if u(new,v-76,ns)==v and u(new,v-40,ns)==u(old,address-40,os_):matches.append(v)
       except ValueError:pass
     ref+=1
  at+=1
 assert len(set(matches))==1,(name,matches)
 return dict(oldVA=address,newVA=matches[0],className=name[1:].decode(),size=u(new,matches[0]-40,ns))
if __name__=='__main__':
 request=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'));result={'code':[],'vmt':[],'errors':[]}
 for spec in request['code']:
  try:result['code'].append(map_code(spec['va'],spec.get('skip',0)))
  except Exception as ex:result['errors'].append(str(ex))
 for a in request.get('vmt',[]):
  try:result['vmt'].append(map_vmt(a))
  except Exception as ex:result['errors'].append(str(ex))
 dest=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587/native-map.json';dest.write_text(json.dumps(result,indent=2),encoding='utf8')
 print(json.dumps({'code':len(result['code']),'vmt':len(result['vmt']),'errors':result['errors']}))
