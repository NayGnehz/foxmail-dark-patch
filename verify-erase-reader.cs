using System;using System.Collections;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Web.Script.Serialization;
class VerifyEraseReader {
 [DllImport("kernel32")]static extern IntPtr GetCurrentProcess();
 static int checks;
 static void Assert(bool ok,string msg){checks++;if(!ok)throw new Exception(msg);}
 static Dictionary<string,object> Export(EraseDiagnosticReader r){var j=new JavaScriptSerializer();return j.Deserialize<Dictionary<string,object>>(j.Serialize(r.Export()));}
 static ArrayList Records(EraseDiagnosticReader r){return (ArrayList)Export(r)["records"];}
 static void Main(){IntPtr mem=Marshal.AllocHGlobal(20000);try{
  uint addr=unchecked((uint)mem.ToInt32());const uint start=4096;uint image=addr-start;
  var data=new byte[20000];Action<int,uint> put=(at,n)=>Array.Copy(BitConverter.GetBytes(n),0,data,at,4);
  var m=new Dictionary<string,object>{{"headerRva",start},{"countersRva",start+32},{"ringRva",start+544},{"capacity",256},{"recordBytes",64}};
  Action publish=()=>Marshal.Copy(data,0,mem,data.Length);
  foreach(var p in new[]{new[]{0,unchecked((int)0x58444645)},new[]{4,1},new[]{8,256},new[]{12,64},new[]{24,4},new[]{28,32}})put(p[0],unchecked((uint)p[1]));
  put(16,1);put(20,1);put(32+19*4,1);
  for(int i=0;i<16;i++)put(544+i*4,0xffffffff);
  put(544,1);put(548,0);put(560,19);put(604,20);publish();
  var r=new EraseDiagnosticReader(m,start,20000);r.Sample(GetCurrentProcess(),image);
  Assert(r.connected&&r.error==null,"valid header");Assert(Records(r).Count==1,"first event");
  var row=(Dictionary<string,object>)Records(r)[0];Assert(Convert.ToInt32(row["sequence"])==1,"sequence");Assert(row["hdc"]==null,"unknown field");Assert(Convert.ToInt32(row["messageId"])==20,"message id");
  var latest=(Dictionary<string,object>)Export(r)["latest"];var totals=(ArrayList)latest["counters"];Assert(Convert.ToInt32(((Dictionary<string,object>)totals[0])["total"])==1,"counter");
  r.Sample(GetCurrentProcess(),image);Assert(Records(r).Count==1,"deduplicate");
  put(608,99);put(16,99);publish();r.Sample(GetCurrentProcess(),image);Assert(Records(r).Count==2,"second committed slot");
  put(544,257);put(16,257);publish();r.Sample(GetCurrentProcess(),image);Assert(Records(r).Count==3,"ring wrap new sequence");
  put(672,0);put(676,3);publish();r.Sample(GetCurrentProcess(),image);Assert(Records(r).Count==3,"uncommitted ignored");
  put(0,0);publish();r.Sample(GetCurrentProcess(),image);Assert(r.error!=null,"invalid header rejected");
  bool rejected=false;try{new EraseDiagnosticReader(m,start,100);}catch(ArgumentException){rejected=true;}Assert(rejected,"section range rejected");
  var invalid=new EraseDiagnosticReader(m,start,20000);invalid.Sample(GetCurrentProcess(),0);Assert(!invalid.connected&&invalid.error!=null,"unreadable memory rejected");
  Console.WriteLine("PASS "+checks+" external diagnostic-reader checks; synthetic memory only");
 }finally{Marshal.FreeHGlobal(mem);}}
}
