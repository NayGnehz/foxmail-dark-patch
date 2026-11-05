using System;using System.Runtime.InteropServices;using System.IO;
class DllLoadTest {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr LoadLibraryExW(string name,IntPtr file,uint flags);
 [DllImport("kernel32.dll",CharSet=CharSet.Ansi,SetLastError=true)]static extern IntPtr GetProcAddress(IntPtr module,string name);
 [DllImport("kernel32.dll")]static extern bool FreeLibrary(IntPtr module);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int Stats(IntPtr buffer,uint bytes);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate uint Invoke(IntPtr context);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate uint Gate(IntPtr hwnd,Invoke invoke,IntPtr context);
 static int Main(){IntPtr module=IntPtr.Zero,buffer=IntPtr.Zero;try{
  if(IntPtr.Size!=4)throw new Exception("x86 required");
  module=LoadLibraryExW("FoxmailRevealGate.dll",IntPtr.Zero,0xa00);if(module==IntPtr.Zero)throw new Exception("DLL load error "+Marshal.GetLastWin32Error());
  IntPtr gp=GetProcAddress(module,"FxGateRun"),sp=GetProcAddress(module,"FxGateGetStats"),dp=GetProcAddress(module,"FxGateStats");if(gp==IntPtr.Zero||sp==IntPtr.Zero||dp==IntPtr.Zero)throw new Exception("Required undecorated export missing");
  buffer=Marshal.AllocHGlobal(68);var stats=(Stats)Marshal.GetDelegateForFunctionPointer(sp,typeof(Stats));if(stats(buffer,68)!=1||Marshal.ReadInt32(buffer)!=68||Marshal.ReadInt32(buffer,4)!=1)throw new Exception("Stats ABI mismatch");
  if(Marshal.ReadInt32(dp)!=68||Marshal.ReadInt32(dp,4)!=1)throw new Exception("Stats data ABI mismatch");
  int calls=0;Invoke original=delegate(IntPtr p){if(p!=new IntPtr(12345))throw new Exception("Context changed");calls++;return 0x24681357;};
  var gate=(Gate)Marshal.GetDelegateForFunctionPointer(gp,typeof(Gate));uint result=gate(IntPtr.Zero,original,new IntPtr(12345));if(result!=0x24681357||calls!=1)throw new Exception("Bypass forwarding failure");
  stats(buffer,68);if(Marshal.ReadInt32(buffer,8)!=1||Marshal.ReadInt32(buffer,12)!=1||Marshal.ReadInt32(buffer,64)!=0)throw new Exception("Unexpected counters or retained cloak");
  File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"dll-load-audit.json"),"{\"passed\":true,\"x86\":true,\"searchFlags\":2560,\"undecoratedExports\":true,\"oneOriginalBypass\":true,\"statsDataAbi\":true,\"foxmailExecuted\":false}");
  Console.WriteLine("PASS: x86 DLL load, undecorated exports, data ABI and exact-once bypass");GC.KeepAlive(original);return 0;
 }catch(Exception e){Console.WriteLine(e);return 1;}finally{if(buffer!=IntPtr.Zero)Marshal.FreeHGlobal(buffer);if(module!=IntPtr.Zero)FreeLibrary(module);}}
}
