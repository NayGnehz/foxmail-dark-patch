using System;using System.Collections.Generic;using System.Runtime.InteropServices;
// Only reads the bounded .fxdark diagnostics section described by local build metadata.
public sealed class EraseDiagnosticReader {
 [StructLayout(LayoutKind.Sequential)]struct MBI{public IntPtr BaseAddress,AllocationBase;public uint AllocationProtect;public UIntPtr RegionSize;public uint State,Protect,Type;}
 [DllImport("kernel32")]static extern UIntPtr VirtualQueryEx(IntPtr p,IntPtr a,out MBI m,UIntPtr size);
 [DllImport("kernel32")]static extern bool ReadProcessMemory(IntPtr p,IntPtr a,byte[] data,int size,out IntPtr read);
 static readonly string[] Fields={"sequence","site","selfVmtRva","self","reason","technology","hdcType","bitsPerPixel","mapMode","rop2","graphicsMode","layout","clipType","fillResult","hdc","messageId"};
 readonly uint header,counters,ring,sectionStart,sectionSize;readonly object schemaReasons;
 readonly HashSet<uint> seen=new HashSet<uint>();readonly Queue<object> records=new Queue<object>();
 public bool connected;public string error;public object latest;public int dropped;
 public EraseDiagnosticReader(Dictionary<string,object> meta,uint start,uint size){
  sectionStart=start;sectionSize=size;header=U(meta["headerRva"]);counters=U(meta["countersRva"]);ring=U(meta["ringRva"]);
  schemaReasons=meta.ContainsKey("reasons")?meta["reasons"]:null;
  if(!Range(header,32)||!Range(counters,512)||!Range(ring,16384)||U(meta["capacity"])!=256||U(meta["recordBytes"])!=64)throw new ArgumentException("Diagnostics outside .fxdark or unsupported layout");
 }
 static uint U(object n){return Convert.ToUInt32(n);}
 bool Range(uint r,int n){return r>=sectionStart&&(ulong)r+(uint)n<=(ulong)sectionStart+sectionSize;}
 byte[] Read(IntPtr p,uint image,uint r,int size){
  if(!Range(r,size)||(ulong)image+r+(uint)size>0x100000000UL)return null;
  uint a=image+r;MBI m;IntPtr at=new IntPtr(unchecked((int)a));
  if(VirtualQueryEx(p,at,out m,(UIntPtr)Marshal.SizeOf(typeof(MBI)))==UIntPtr.Zero||m.State!=0x1000||(m.Protect&0x101)!=0||(ulong)a+(uint)size>unchecked((uint)m.BaseAddress.ToInt32())+m.RegionSize.ToUInt64())return null;
  var b=new byte[size];IntPtr got;return ReadProcessMemory(p,at,b,size,out got)&&got.ToInt32()==size?b:null;
 }
 static uint Word(byte[] b,int offset){return BitConverter.ToUInt32(b,offset);}
 public void Sample(IntPtr p,uint image){try{
  var h=Read(p,image,header,32);if(h==null||Word(h,0)!=0x58444645||Word(h,4)!=1||Word(h,8)!=256||Word(h,12)!=64||Word(h,24)!=4||Word(h,28)!=32){error="Diagnostic header unavailable or wrong build";return;}
  connected=true;error=null;var c=Read(p,image,counters,512);var totals=new List<object>();
  if(c!=null)for(int site=0;site<4;site++){var counts=new uint[32];ulong sum=0;for(int reason=0;reason<32;reason++){counts[reason]=Word(c,(site*32+reason)*4);sum+=counts[reason];}totals.Add(new{site=site,total=sum,reasons=counts});}
  latest=new{nextSequence=Word(h,16),committed=Word(h,20),counters=totals};
  // Every slot is read twice; committed sequence is last-written by the producer.
  // Deduplicate by sequence rather than assuming concurrent commits are ordered.
  var a=Read(p,image,ring,16384);var b=Read(p,image,ring,16384);var end=Read(p,image,header,32);if(a==null||b==null||end==null)return;uint newest=Word(end,16);
  for(int slot=0;slot<256;slot++){int at=64*slot;uint seq=Word(a,at);if(seq==0||seq>newest||newest-seq>=256||seen.Contains(seq))continue;bool same=true;for(int i=0;i<64;i++)if(a[at+i]!=b[at+i]){same=false;break;}if(!same)continue;
   var row=new Dictionary<string,object>();for(int i=0;i<16;i++){uint v=Word(a,at+4*i);row[Fields[i]]=v==0xffffffff?(object)null:v;}
   seen.Add(seq);records.Enqueue(row);if(records.Count>5000){records.Dequeue();dropped++;}
  }
 }catch(Exception ex){error=ex.GetType().Name;}}
 public object Export(){return new{connected=connected,error=error,latest=latest,reasons=schemaReasons,records=records.ToArray(),dropped=dropped};}
}
