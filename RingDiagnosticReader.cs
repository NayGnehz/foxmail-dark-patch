using System;using System.Collections;using System.Collections.Generic;using System.Runtime.InteropServices;
// Read-only numeric diagnostic ring, bounded by the loaded .fxdark PE section.
public sealed class RingDiagnosticReader {
 [StructLayout(LayoutKind.Sequential)]struct MBI{public IntPtr BaseAddress,AllocationBase;public uint AllocationProtect;public UIntPtr RegionSize;public uint State,Protect,Type;}
 [DllImport("kernel32")]static extern UIntPtr VirtualQueryEx(IntPtr p,IntPtr a,out MBI m,UIntPtr size);
 [DllImport("kernel32")]static extern bool ReadProcessMemory(IntPtr p,IntPtr a,byte[] data,int size,out IntPtr read);
 readonly uint header,ring,sectionStart,sectionSize,magic,version;readonly int capacity,recordBytes;readonly string[] fields;readonly object sites,coordinateLimit,origins,samplePatterns,aggregateThresholds;
 readonly HashSet<uint> seen=new HashSet<uint>();readonly Queue<object> records=new Queue<object>();
 public bool connected;public string error;public object latest;public int dropped;
 public RingDiagnosticReader(Dictionary<string,object> meta,uint start,uint size){
  sectionStart=start;sectionSize=size;header=U(meta["headerRva"]);ring=U(meta["ringRva"]);magic=U(meta["magic"]);version=U(meta["schemaVersion"]);
  capacity=Convert.ToInt32(meta["capacity"]);recordBytes=Convert.ToInt32(meta["recordBytes"]);
  var list=new List<string>();foreach(object item in (IEnumerable)meta["fields"])list.Add(Convert.ToString(item));fields=list.ToArray();
  sites=meta.ContainsKey("sites")?meta["sites"]:null;
  coordinateLimit=meta.ContainsKey("coordinateLimit")?meta["coordinateLimit"]:null;origins=meta.ContainsKey("origins")?meta["origins"]:null;
  samplePatterns=meta.ContainsKey("samplePatterns")?meta["samplePatterns"]:null;aggregateThresholds=meta.ContainsKey("aggregateThresholds")?meta["aggregateThresholds"]:null;
  if(capacity<1||capacity>4096||recordBytes<16||recordBytes>256||recordBytes%4!=0||fields.Length<1||fields.Length>recordBytes/4||fields[0]!="sequence"||!Range(header,32)||!Range(ring,capacity*recordBytes))throw new ArgumentException("Invalid ring layout or section bounds");
  var names=new HashSet<string>();foreach(string f in fields)if(String.IsNullOrEmpty(f)||!names.Add(f))throw new ArgumentException("Invalid field names");
 }
 static uint U(object n){return Convert.ToUInt32(n);}
 bool Range(uint r,int n){return n>0&&r>=sectionStart&&(ulong)r+(uint)n<=(ulong)sectionStart+sectionSize;}
 byte[] Read(IntPtr p,uint image,uint r,int size){
  if(!Range(r,size)||(ulong)image+r+(uint)size>0x100000000UL)return null;
  uint a=image+r;MBI m;IntPtr at=new IntPtr(unchecked((int)a));
  if(VirtualQueryEx(p,at,out m,(UIntPtr)Marshal.SizeOf(typeof(MBI)))==UIntPtr.Zero||m.State!=0x1000||(m.Protect&0x101)!=0||(ulong)a+(uint)size>unchecked((uint)m.BaseAddress.ToInt32())+m.RegionSize.ToUInt64())return null;
  var b=new byte[size];IntPtr got;return ReadProcessMemory(p,at,b,size,out got)&&got.ToInt32()==size?b:null;
 }
 static uint Word(byte[] b,int at){return BitConverter.ToUInt32(b,at);}
 bool Header(byte[] h){return h!=null&&Word(h,0)==magic&&Word(h,4)==version&&Word(h,8)==capacity&&Word(h,12)==recordBytes;}
 public void Sample(IntPtr process,uint image){try{
  var h=Read(process,image,header,32);if(!Header(h)){connected=false;error="Paint ring unavailable or wrong build";return;}
  connected=true;error=null;latest=new{nextSequence=Word(h,16),committed=Word(h,20)};
  int length=capacity*recordBytes;var a=Read(process,image,ring,length);var b=Read(process,image,ring,length);var end=Read(process,image,header,32);if(a==null||b==null||!Header(end))return;uint newest=Word(end,16);
  for(int slot=0;slot<capacity;slot++){
   int at=slot*recordBytes;uint seq=Word(a,at);if(seq==0||seq>newest||newest-seq>=capacity||seen.Contains(seq))continue;
   bool stable=true;for(int i=0;i<recordBytes;i++)if(a[at+i]!=b[at+i]){stable=false;break;}if(!stable)continue;
   var row=new Dictionary<string,object>();for(int i=0;i<fields.Length;i++){uint v=Word(a,at+i*4);row[fields[i]]=v==0xffffffff?(object)null:v;}
   seen.Add(seq);records.Enqueue(row);if(records.Count>5000){records.Dequeue();dropped++;}
  }
 }catch(Exception e){error=e.GetType().Name;}}
 public object Export(){return new{connected=connected,error=error,latest=latest,sites=sites,fields=fields,coordinateLimit=coordinateLimit,origins=origins,samplePatterns=samplePatterns,aggregateThresholds=aggregateThresholds,records=records.ToArray(),dropped=dropped};}
}
