"""Read only one user-identified minidump's exception and module metadata.
Never reads memory/thread/stack streams, context registers, annotations or logs.
"""
import json,os,struct
from pathlib import Path

REPORT='00000000-0000-0000-0000-000000000000'
path=Path(r'D:\Users\Public\Downloads\Foxmail\Global\Bugly\reports')/(REPORT+'.dmp')
size=path.stat().st_size
assert 32<=size<=128*1024*1024
total=0
with path.open('rb')as f:
    def read(at,count):
        global total
        assert 0<=at<=size-count and 0<count<=8192 and total+count<=256*1024
        f.seek(at);data=f.read(count);assert len(data)==count;total+=count;return data
    header=read(0,32)
    signature,version,n,dir_at,checksum,timestamp,flags=struct.unpack('<4s5IQ',header)
    assert signature==b'MDMP'and 0<n<=256
    directory=[struct.unpack('<III',read(dir_at+12*i,12))for i in range(n)]
    exceptions=[(length,at)for kind,length,at in directory if kind==6]
    modules=[(length,at)for kind,length,at in directory if kind==4]
    assert len(exceptions)==len(modules)==1
    length,at=exceptions[0];assert length>=168
    e=read(at,168)
    thread_id=struct.unpack_from('<I',e,0)[0]
    code,exc_flags,record,address,count,alignment=struct.unpack_from('<IIQQII',e,8)
    assert count<=15
    params=struct.unpack_from('<15Q',e,40)
    length,at=modules[0];num=struct.unpack('<I',read(at,4))[0]
    assert 0<num<=1024 and length>=4+108*num
    selected=[]
    for i in range(num):
        m=read(at+4+108*i,24)
        base,image_size,_,stamp,name_at=struct.unpack('<Q4I',m)
        if not(base<=address<base+image_size or base==0x400000):continue
        string_size=struct.unpack('<I',read(name_at,4))[0]
        assert string_size%2==0 and 0<string_size<=4096
        name=read(name_at+4,string_size).decode('utf-16le')
        selected.append(dict(path=name,base=hex(base),size=image_size,timestamp=stamp,
                             faulting=base<=address<base+image_size,
                             faultRva=hex(address-base)if base<=address<base+image_size else None))
    result=dict(reportId=REPORT,numericAndModuleMetadataOnly=True,bytesRead=total,
                dumpBytes=size,dumpTimestamp=timestamp,threadId=thread_id,exceptionCode=hex(code),
                exceptionFlags=hex(exc_flags),instructionAddress=hex(address),modules=selected,
                noMemoryNoStackNoContextNoAnnotations=True)
    if code==0xc0000005 and count>=2:
        result['accessViolation']=dict(operation={0:'read',1:'write',8:'execute'}.get(params[0],'other'),address=hex(params[1]))
out=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-fault'/('exception-'+REPORT+'.json')
out.parent.mkdir(parents=True,exist_ok=True)
with out.open('x',encoding='utf8')as target:json.dump(result,target,indent=2)
print(json.dumps(dict(saved=str(out),**result)))
