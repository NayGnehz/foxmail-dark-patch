"""Selected numeric x86 exception registers only; never stack/heap contents."""
import json,os,struct,sys
from pathlib import Path
report=sys.argv[1]if len(sys.argv)>1 else'00000000-0000-0000-0000-000000000000'
assert report in ['00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000']
path=Path(r'D:\Users\Public\Downloads\Foxmail\Global\Bugly\reports')/(report+'.dmp')
size=path.stat().st_size;assert 32<=size<=128*1024*1024
count=0
with path.open('rb')as f:
    def read(at,n):
        global count
        assert 0<=at<=size-n and 0<n<=8192 and count+n<=8192
        f.seek(at);data=f.read(n);assert len(data)==n;count+=n;return data
    h=read(0,32);assert h[:4]==b'MDMP'
    streams,at=struct.unpack_from('<II',h,8);assert 0<streams<=256
    rows=[struct.unpack('<III',read(at+12*i,12))for i in range(streams)]
    e,=[(n,rva)for kind,n,rva in rows if kind==6]
    system,=[(n,rva)for kind,n,rva in rows if kind==7]
    assert struct.unpack('<H',read(system[1],2))[0]==0  # PROCESSOR_ARCHITECTURE_INTEL
    assert e[0]>=168
    context_size,context=struct.unpack('<II',read(e[1]+160,8))
    assert 204<=context_size<=4096
    flags=struct.unpack('<I',read(context,4))[0];assert flags&0x10000
    registers={name:hex(struct.unpack('<I',read(context+offset,4))[0])for name,offset in [('EAX',0xb0),('EBP',0xb4),('EIP',0xb8),('ESP',0xc4)]}
    result=dict(reportId=report,selectedX86RegistersOnly=True,contextFlags=hex(flags),registers=registers,bytesRead=count,
                noStackNoHeapNoMailNoFloatingPointRegisters=True)
out=Path(os.environ['PORTABLE_INSTANCE_ROOT'])/'temp/version587-fault'/('registers-'+report+'.json')
out.parent.mkdir(parents=True,exist_ok=True)
with out.open('x',encoding='utf8')as target:json.dump(result,target,indent=2)
print(json.dumps(dict(saved=str(out),**result)))
