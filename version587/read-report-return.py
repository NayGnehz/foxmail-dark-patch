"""One saved return code address from the verified x86 frame; no stack scan."""
import json,os,struct
from pathlib import Path
report='00000000-0000-0000-0000-000000000000'
path=Path(r'D:\Users\Public\Downloads\Foxmail\Global\Bugly\reports')/(report+'.dmp')
size=path.stat().st_size;used=0
with path.open('rb')as f:
    def read(at,n):
        global used
        assert 0<=at<=size-n and 0<n<=4096 and used+n<=16384
        f.seek(at);data=f.read(n);assert len(data)==n;used+=n;return data
    h=read(0,32);assert h[:4]==b'MDMP'
    n,at=struct.unpack_from('<II',h,8);assert 0<n<=256
    streams=[struct.unpack('<III',read(at+12*i,12))for i in range(n)]
    def stream(kind):
        row,=[(length,rva)for k,length,rva in streams if k==kind];return row
    _,exc=stream(6);tid=struct.unpack('<I',read(exc,4))[0]
    context_size,context=struct.unpack('<II',read(exc+160,8));assert context_size>=204
    ebp,eip=struct.unpack('<II',read(context+0xb4,8));assert eip==0x966374 and ebp%4==0
    _,threads=stream(3);num=struct.unpack('<I',read(threads,4))[0];assert 0<num<=256
    matches=[]
    for i in range(num):
        record=read(threads+4+48*i,40)
        if struct.unpack_from('<I',record)[0]==tid:matches.append(struct.unpack_from('<QII',record,24))
    (base,length,rva),=matches
    assert base<=ebp+4<=base+length-4
    return_address=struct.unpack('<I',read(rva+ebp+4-base,4))[0]
    _,modules=stream(4);num=struct.unpack('<I',read(modules,4))[0];assert 0<num<=1024
    caller=[]
    for i in range(num):
        record=read(modules+4+108*i,24)
        base,length,_,stamp,name_at=struct.unpack('<Q4I',record)
        if not base<=return_address<base+length:continue
        count=struct.unpack('<I',read(name_at,4))[0];assert count%2==0 and 0<count<=4096
        caller.append(dict(path=read(name_at+4,count).decode('utf-16le'),moduleBase=hex(base),returnRva=hex(return_address-base)))
    result=dict(reportId=report,frameEbp=hex(ebp),instructionAddress=hex(eip),savedReturnAddress=hex(return_address),caller=caller,
                stackBytesRead=4,noStackScanNoLocalsNoMailBuffer=True,totalBytesRead=used)
out=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-fault'/('return-'+report+'.json')
out.parent.mkdir(parents=True,exist_ok=True)
with out.open('x',encoding='utf8')as target:json.dump(result,target,indent=2)
print(json.dumps(dict(saved=str(out),**result)))
