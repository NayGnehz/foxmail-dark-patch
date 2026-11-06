"""One potential code-return DWORD at saved ESP for the user's null-IP report.
No stack scan, locals, heap or message buffers. Module-name metadata only.
"""
import json,os,struct
from pathlib import Path
report='00000000-0000-0000-0000-000000000000'
path=Path(r'D:\Users\Public\Downloads\Foxmail\Global\Bugly\reports')/(report+'.dmp')
size=path.stat().st_size;assert 32<=size<=128*1024*1024
used=0
with path.open('rb')as f:
 def read(at,n):
  global used
  assert 0<=at<=size-n and 0<n<=4096 and used+n<=16384
  f.seek(at);data=f.read(n);assert len(data)==n;used+=n;return data
 h=read(0,32);assert h[:4]==b'MDMP'
 n,at=struct.unpack_from('<II',h,8);assert 0<n<=256
 rows=[struct.unpack('<III',read(at+12*i,12))for i in range(n)]
 def stream(kind):
  row,=[(length,rva)for k,length,rva in rows if k==kind];return row
 _,exc=stream(6);tid=struct.unpack('<I',read(exc,4))[0]
 cs,ctx=struct.unpack('<II',read(exc+160,8));assert cs>=204
 eip=struct.unpack('<I',read(ctx+0xb8,4))[0];esp=struct.unpack('<I',read(ctx+0xc4,4))[0]
 assert eip==0 and esp==0x218d9cc
 _,threads=stream(3);num=struct.unpack('<I',read(threads,4))[0];assert 0<num<=256
 stacks=[]
 for i in range(num):
  row=read(threads+4+48*i,40)
  if struct.unpack_from('<I',row)[0]==tid:stacks.append(struct.unpack_from('<QII',row,24))
 (base,length,rva),=stacks;assert base<=esp<=base+length-4
 value=struct.unpack('<I',read(rva+esp-base,4))[0]
 _,modules=stream(4);num=struct.unpack('<I',read(modules,4))[0];assert 0<num<=1024
 caller=[]
 for i in range(num):
  row=read(modules+4+108*i,24);base,length,_,stamp,name_at=struct.unpack('<Q4I',row)
  if not base<=value<base+length:continue
  count=struct.unpack('<I',read(name_at,4))[0];assert count%2==0 and 0<count<=4096
  caller.append(dict(path=read(name_at+4,count).decode('utf-16le'),base=hex(base),rva=hex(value-base)))
 result=dict(reportId=report,instructionAddress=hex(eip),savedEsp=hex(esp),possibleCodeReturn=hex(value),module=caller,stackBytesRead=4,noStackScanNoLocalsNoMail=True,totalBytesRead=used)
out=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-fault'/('close-return-'+report+'.json')
with out.open('x',encoding='utf8')as target:json.dump(result,target,indent=2)
print(json.dumps(result))
