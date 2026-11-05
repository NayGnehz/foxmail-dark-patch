using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
class ProbeTransientState {
 const string Exact=@"D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe";
 delegate bool EnumProc(IntPtr h,IntPtr p);
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool QueryFullProcessImageName(IntPtr p,int flags,StringBuilder s,ref int n);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetProcessTimes(IntPtr p,out long created,out long exited,out long kernel,out long user);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool ReadProcessMemory(IntPtr p,IntPtr address,byte[] bytes,int length,out IntPtr read);
 [DllImport("psapi.dll",SetLastError=true)]static extern bool EnumProcessModules(IntPtr p,IntPtr[] modules,int size,out int needed);
 [DllImport("user32.dll")]static extern bool EnumWindows(EnumProc f,IntPtr p);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetClassName(IntPtr h,StringBuilder s,int max);
 [DllImport("user32.dll")]static extern int GetWindowLong(IntPtr h,int index);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")]static extern bool IsZoomed(IntPtr h);
 struct Rect{public int l,t,r,b;}
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out Rect r);
 static uint Read(IntPtr p,IntPtr b,uint rva){byte[] bytes=new byte[4];IntPtr count;if(!ReadProcessMemory(p,new IntPtr(b.ToInt64()+rva),bytes,4,out count)||count.ToInt64()!=4)throw new Exception("ReadProcessMemory failed: "+Marshal.GetLastWin32Error());return BitConverter.ToUInt32(bytes,0);}
 static int Main(string[] args){IntPtr p=IntPtr.Zero;try{uint pid=uint.Parse(args[0]),busy=uint.Parse(args[1]),fail=uint.Parse(args[2]);p=OpenProcess(0x410,false,pid);if(p==IntPtr.Zero)throw new Exception("OpenProcess query+VM_READ failed "+Marshal.GetLastWin32Error());var path=new StringBuilder(32768);int n=path.Capacity;if(!QueryFullProcessImageName(p,0,path,ref n)||!String.Equals(path.ToString(),Exact,StringComparison.OrdinalIgnoreCase))throw new Exception("Exact executable identity mismatch");long created,exited,kernel,user;if(!GetProcessTimes(p,out created,out exited,out kernel,out user)||exited!=0)throw new Exception("Process has exited or identity unavailable");string hash;using(var sha=SHA256.Create())using(var f=File.OpenRead(Exact))hash=BitConverter.ToString(sha.ComputeHash(f)).Replace("-","");if(!String.Equals(hash,args[3],StringComparison.OrdinalIgnoreCase))throw new Exception("Installed hash differs from expected candidate");
 var windows=new List<object>();int mains=0;EnumWindows((h,a)=>{uint id;uint thread=GetWindowThreadProcessId(h,out id);if(id!=pid||(GetWindowLong(h,-16)&0x40000000)!=0)return true;var cls=new StringBuilder(256);GetClassName(h,cls,cls.Capacity);string name=cls.ToString();if(name!="TFoxMainFrm.UnicodeClass"&&name!="TApplication")return true;if(name=="TFoxMainFrm.UnicodeClass")mains++;Rect r;bool rect=GetWindowRect(h,out r);windows.Add(new{hwnd=h.ToInt64().ToString("X"),threadId=thread,className=name,style=(uint)GetWindowLong(h,-16),exStyle=(uint)GetWindowLong(h,-20),visible=IsWindowVisible(h),iconic=IsIconic(h),zoomed=IsZoomed(h),rectSuccess=rect,width=r.r-r.l,height=r.b-r.t});return true;},IntPtr.Zero);if(mains!=1)throw new Exception("Expected exactly one main HWND; found "+mains);
 IntPtr[] modules=new IntPtr[1024];int needed;if(!EnumProcessModules(p,modules,modules.Length*IntPtr.Size,out needed)||needed<IntPtr.Size)throw new Exception("Cannot read module base");uint busyValue=Read(p,modules[0],busy),failValue=Read(p,modules[0],fail);long c2,e2,k2,u2;if(!GetProcessTimes(p,out c2,out e2,out k2,out u2)||c2!=created||e2!=0)throw new Exception("Process identity changed/exited during read");
 string json=new JavaScriptSerializer().Serialize(new{observedAt=DateTimeOffset.Now.ToString("o"),access="PROCESS_QUERY_INFORMATION|PROCESS_VM_READ (0x410)",pid=pid,path=path.ToString(),createdAtUtc=DateTime.FromFileTimeUtc(created).ToString("o"),installedSHA256=hash,moduleBase=modules[0].ToInt64().ToString("X"),busyRva=busy,busy=busyValue,restoreFailuresRva=fail,restoreFailures=failValue,windows=windows});File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"audit-live-transient-state.json"),json,Encoding.UTF8);Console.WriteLine(json);return 0;
 }catch(Exception ex){Console.Error.WriteLine(ex.Message);return 1;}finally{if(p!=IntPtr.Zero)CloseHandle(p);}}
}
