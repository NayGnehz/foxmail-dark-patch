using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
// External, numeric-only editor metadata snapshot. No messages/content/UIA,
// debugging, remote execution or write APIs. Handle access: QUERY_INFORMATION|VM_READ.
class EditorReadyReadOnly {
 [StructLayout(LayoutKind.Sequential)]struct MBI {public IntPtr BaseAddress,AllocationBase;public uint AllocationProtect;public UIntPtr RegionSize;public uint State,Protect,Type;}
 [StructLayout(LayoutKind.Sequential)]struct ModuleInfo {public IntPtr BaseAddress;public uint ImageSize;public IntPtr EntryPoint;}
 [StructLayout(LayoutKind.Sequential)]struct Rect {public int L,T,R,B;}
 delegate bool EnumProc(IntPtr hwnd,IntPtr value);
 [DllImport("kernel32",SetLastError=true)]static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32")]static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32",SetLastError=true)]static extern bool ReadProcessMemory(IntPtr process,IntPtr address,byte[] buffer,int size,out IntPtr read);
 [DllImport("kernel32")]static extern UIntPtr VirtualQueryEx(IntPtr process,IntPtr address,out MBI value,UIntPtr size);
 [DllImport("psapi")]static extern bool EnumProcessModules(IntPtr process,IntPtr[] modules,uint size,out uint needed);
 [DllImport("psapi")]static extern bool GetModuleInformation(IntPtr process,IntPtr module,out ModuleInfo info,uint size);
 [DllImport("user32")]static extern bool EnumWindows(EnumProc callback,IntPtr value);
 [DllImport("user32")]static extern bool EnumChildWindows(IntPtr parent,EnumProc callback,IntPtr value);
 [DllImport("user32")]static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
 [DllImport("user32",CharSet=CharSet.Unicode)]static extern int GetClassName(IntPtr hwnd,StringBuilder name,int max);
 [DllImport("user32",EntryPoint="GetPropW")]static extern IntPtr GetProp(IntPtr hwnd,IntPtr atom);
 [DllImport("user32")]static extern IntPtr GetParent(IntPtr hwnd);
 [DllImport("user32")]static extern bool GetWindowRect(IntPtr hwnd,out Rect rect);
 [DllImport("user32")]static extern bool IsWindowVisible(IntPtr hwnd);
 static IntPtr ph;static uint pid,image,imageSize;static long bytesRead,readCalls;
 static uint U(IntPtr p){return unchecked((uint)p.ToInt32());}static IntPtr P(uint p){return new IntPtr(unchecked((int)p));}
 static string H(uint v){return "0x"+v.ToString("X8");}
 static Dictionary<string,object> D(){return new Dictionary<string,object>();}
 static byte[] Read(ulong address,int count){if(address<65536||address>uint.MaxValue||count<1||count>128||address+(uint)count>0x100000000UL)return null;MBI m;if(VirtualQueryEx(ph,P((uint)address),out m,(UIntPtr)Marshal.SizeOf(typeof(MBI)))==UIntPtr.Zero||m.State!=0x1000||(m.Protect&0x101)!=0)return null;if(address+(uint)count>(ulong)U(m.BaseAddress)+m.RegionSize.ToUInt64())return null;var b=new byte[count];IntPtr got;readCalls++;if(!ReadProcessMemory(ph,P((uint)address),b,count,out got)||got.ToInt64()!=count)return null;bytesRead+=count;return b;}
 static uint? R32(ulong a){var b=Read(a,4);return b==null?(uint?)null:BitConverter.ToUInt32(b,0);}static byte? R8(ulong a){var b=Read(a,1);return b==null?(byte?)null:b[0];}
 static bool InImage(uint a,int n){return a>=image&&(ulong)a+(uint)n<=(ulong)image+imageSize;}
 static bool ExactVmt(uint v,uint rva,uint size){return v==image+rva&&InImage(v-76,80)&&R32(v-76)==v&&R32(v-40)==size;}
 static object Window(IntPtr hwnd){uint owner;uint tid=GetWindowThreadProcessId(hwnd,out owner);Rect r;var d=D();d["hwnd"]=H(U(hwnd));d["pid"]=owner;d["tid"]=tid;d["parent"]=H(U(GetParent(hwnd)));d["visible"]=IsWindowVisible(hwnd);d["rect"]=GetWindowRect(hwnd,out r)?new int[]{r.L,r.T,r.R,r.B}:null;return d;}
 static object Editor(IntPtr hwnd){var result=D();result["window"]=Window(hwnd);result["status"]="no-valid-fixed-atom-object";
  foreach(uint arva in new uint[]{0xEF91B6,0xEF91B4,0xEF5B80,0xEF5B7E}){
   if(!InImage(image+arva,2))continue;var ab=Read((ulong)image+arva,2);if(ab==null)continue;ushort atom=BitConverter.ToUInt16(ab,0);if(atom<0xc000)continue;
   uint self=U(GetProp(hwnd,P(atom)));var v=R32(self);if(!v.HasValue)continue;
   bool exact=ExactVmt(v.Value,0x7946F0,0x3D0)||ExactVmt(v.Value,0x783760,0x370);if(!exact||R32((ulong)self+0x180)!=U(hwnd))continue;
   // Only after exact class/size/HWND checks read the three known numeric fields.
   var loaded=R8((ulong)self+0x324);var chromium=R32((ulong)self+0x304);var host=R32((ulong)self+0x300);
   if(!loaded.HasValue||loaded.Value>1||!chromium.HasValue||!host.HasValue)continue;
   var d=D();d["self"]=H(self);d["vmtRva"]=H(v.Value-image);d["atomRva"]=H(arva);d["atom"]=atom;d["loadEnd324"]=loaded.Value;d["chromium304"]=H(chromium.Value);d["host300"]=H(host.Value);
   bool chromiumValid=chromium.Value!=0&&ExactVmt(R32(chromium.Value).GetValueOrDefault(),0x776AE0,0x79C);d["exactChromiumVmt"]=chromium.Value==0?(object)null:chromiumValid;
   if(host.Value!=0&&ExactVmt(R32(host.Value).GetValueOrDefault(),0x766E08,0x224)){
    var handle=R32((ulong)host.Value+0x180);if(handle.HasValue&&handle.Value!=0){uint owner;GetWindowThreadProcessId(P(handle.Value),out owner);if(owner==pid)d["hostWindow"]=Window(P(handle.Value));}
   }
   // Fail closed if the window/property/object changed during this non-atomic read.
   if(U(GetProp(hwnd,P(atom)))!=self||R32(self)!=v||R32((ulong)self+0x180)!=U(hwnd)||R8((ulong)self+0x324)!=loaded||R32((ulong)self+0x304)!=chromium||R32((ulong)self+0x300)!=host){result["status"]="raced-or-destroyed";return result;}
   result["status"]="exact-vmt-fields-read";result["editor"]=d;return result;
  }return result;
 }
 static void Main(string[] args){try{
  if(IntPtr.Size!=4)throw new Exception("x86-required");if(args.Length!=2||!uint.TryParse(args[0],out pid))throw new Exception("usage-pid-output-json");
  ph=OpenProcess(0x410,false,pid);if(ph==IntPtr.Zero)throw new Exception("read-query-open-failed-"+Marshal.GetLastWin32Error());
  var mods=new IntPtr[1];uint needed;if(!EnumProcessModules(ph,mods,4,out needed)||mods[0]==IntPtr.Zero)throw new Exception("main-module-query-failed");ModuleInfo mi;if(!GetModuleInformation(ph,mods[0],out mi,(uint)Marshal.SizeOf(typeof(ModuleInfo))))throw new Exception("module-info-failed");image=U(mi.BaseAddress);imageSize=mi.ImageSize;
  var dos=Read(image,64);if(dos==null||dos[0]!=77||dos[1]!=90)throw new Exception("dos-guard");uint peoff=BitConverter.ToUInt32(dos,60);if(peoff<64||peoff>0x100000)throw new Exception("pe-offset-guard");var pe=Read((ulong)image+peoff,88);if(pe==null||BitConverter.ToUInt32(pe,0)!=0x4550||BitConverter.ToUInt16(pe,4)!=0x14c||BitConverter.ToUInt16(pe,24)!=0x10b||BitConverter.ToUInt32(pe,80)!=imageSize)throw new Exception("x86-pe-guard");
  if(!ExactVmt(image+0x7946F0,0x7946F0,0x3D0)||!ExactVmt(image+0x783760,0x783760,0x370))throw new Exception("editor-layout-build-guard");
  var editors=new List<object>();var seen=new HashSet<uint>();EnumProc each=delegate(IntPtr hwnd,IntPtr ignored){if(!seen.Add(U(hwnd)))return true;uint owner;GetWindowThreadProcessId(hwnd,out owner);if(owner!=pid)return true;var name=new StringBuilder(80);GetClassName(hwnd,name,name.Capacity);if(name.ToString()=="TFoxHTMLEditor"||name.ToString()=="TFoxHTMLEditorBase")editors.Add(Editor(hwnd));return true;};
  EnumWindows(delegate(IntPtr top,IntPtr ignored){each(top,IntPtr.Zero);EnumChildWindows(top,each,IntPtr.Zero);return true;},IntPtr.Zero);
  var report=D();report["readOnly"]=true;report["noTextNoAccessibility"]=true;report["pid"]=pid;report["utc"]=DateTime.UtcNow.ToString("o");report["imageBase"]=H(image);report["imageSize"]=imageSize;report["editorCount"]=editors.Count;report["editors"]=editors;report["readCalls"]=readCalls;report["bytesRead"]=bytesRead;report["notFirstFrameProof"]=true;File.WriteAllText(args[1],new JavaScriptSerializer().Serialize(report),new UTF8Encoding(false));Console.WriteLine("Read-only snapshot saved: "+editors.Count+" editor HWNDs; "+bytesRead+" numeric/PE metadata bytes read.");
 }catch(Exception e){Console.Error.WriteLine(e.Message);Environment.ExitCode=2;}finally{if(ph!=IntPtr.Zero)CloseHandle(ph);}}
}
