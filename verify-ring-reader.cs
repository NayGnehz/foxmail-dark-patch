using System;using System.Collections;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Web.Script.Serialization;
class VerifyRingReader {
 [DllImport("kernel32")]static extern IntPtr GetCurrentProcess();
 static int checks;
 static void Check(bool ok,string msg){checks++;if(!ok)throw new Exception(msg);}
 static Dictionary<string,object> Export(RingDiagnosticReader r){var j=new JavaScriptSerializer();return j.Deserialize<Dictionary<string,object>>(j.Serialize(r.Export()));}
 static ArrayList Records(RingDiagnosticReader r){return (ArrayList)Export(r)["records"];}
 static void Test(int recordBytes){IntPtr mem=Marshal.AllocHGlobal(40000);try{
  uint addr=unchecked((uint)mem.ToInt32());const uint start=4096;uint image=addr-start;
  var data=new byte[40000];Action<int,uint> put=(at,n)=>Array.Copy(BitConverter.GetBytes(n),0,data,at,4);
  var m=new Dictionary<string,object>{{"headerRva",start},{"ringRva",start+32},{"magic",0x58445050},{"schemaVersion",1},{"capacity",256},{"recordBytes",recordBytes},{"fields",new string[]{"sequence","site","bkColor"}}};
  Action publish=()=>Marshal.Copy(data,0,mem,data.Length);
  put(0,0x58445050);put(4,1);put(8,256);put(12,(uint)recordBytes);put(16,1);put(20,1);
  put(32,1);put(36,0);put(40,0xffffffff);publish();
  var r=new RingDiagnosticReader(m,start,40000);r.Sample(GetCurrentProcess(),image);
  Check(r.connected&&r.error==null,"valid header");Check(Records(r).Count==1,"first event");
  var row=(Dictionary<string,object>)Records(r)[0];Check(Convert.ToInt32(row["sequence"])==1,"sequence");Check(row["bkColor"]==null,"unknown color");
  r.Sample(GetCurrentProcess(),image);Check(Records(r).Count==1,"deduplicate");
  put(32+recordBytes,2);put(40+recordBytes,0x202020);put(16,2);publish();r.Sample(GetCurrentProcess(),image);Check(Records(r).Count==2,"second committed slot");
  Check(Convert.ToInt32(((Dictionary<string,object>)Records(r)[1])["bkColor"])==0x202020,"numeric color");
  put(32,257);put(16,257);publish();r.Sample(GetCurrentProcess(),image);Check(Records(r).Count==3,"ring wrap");
  put(32+2*recordBytes,0);publish();r.Sample(GetCurrentProcess(),image);Check(Records(r).Count==3,"uncommitted ignored");
  put(32+3*recordBytes,300);publish();r.Sample(GetCurrentProcess(),image);Check(Records(r).Count==3,"future sequence ignored");
  put(0,0);publish();r.Sample(GetCurrentProcess(),image);Check(!r.connected&&r.error!=null,"wrong header");
  bool rejected=false;try{new RingDiagnosticReader(m,start,100);}catch(ArgumentException){rejected=true;}Check(rejected,"out-of-bounds ring");
  m["fields"]=new string[]{"sequence","sequence"};rejected=false;try{new RingDiagnosticReader(m,start,40000);}catch(ArgumentException){rejected=true;}Check(rejected,"duplicate fields");
 }finally{Marshal.FreeHGlobal(mem);}}
 static void Main(){Test(64);Test(128);Console.WriteLine("PASS "+checks+" bounded paint-ring reader checks; synthetic memory only");}
}
