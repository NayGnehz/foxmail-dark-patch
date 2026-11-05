using System;using System.IO;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Web.Script.Serialization;
class TrayRestoreCheck{
 [DllImport("kernel32")]static extern IntPtr VirtualAlloc(IntPtr a,UIntPtr n,uint t,uint p);
 [DllImport("user32",CharSet=CharSet.Unicode)]static extern IntPtr CreateWindowEx(uint ex,string cls,string title,uint style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
 [DllImport("user32")]static extern bool SetLayeredWindowAttributes(IntPtr hwnd,uint key,byte alpha,uint flags);
 [DllImport("user32")]static extern bool ShowWindow(IntPtr hwnd,int cmd);
 [DllImport("user32")]static extern bool IsIconic(IntPtr hwnd);
 [DllImport("user32")]static extern bool IsZoomed(IntPtr hwnd);
 [DllImport("user32")]static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32")]static extern bool DestroyWindow(IntPtr hwnd);
 [DllImport("user32")]static extern bool GetWindowPlacement(IntPtr hwnd,ref Placement p);
 [StructLayout(LayoutKind.Sequential)]struct Point{public int x,y;}
 [StructLayout(LayoutKind.Sequential)]struct Rect{public int l,t,r,b;}
 [StructLayout(LayoutKind.Sequential)]struct Placement{public int len,flags,show;public Point min,max;public Rect normal;}
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate bool Show(IntPtr hwnd,int cmd);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate bool Iconic(IntPtr hwnd);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate uint GetError();
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate void SetError(uint error);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int ABI(IntPtr fn,IntPtr hwnd,int cmd,out int returned);
 static int checks,queries,gets,sets,lastCommand;static uint lastError;static IntPtr lastWindow;
 static void Check(bool b,string s){if(!b)throw new Exception(s);checks++;}
 static string State(IntPtr w){var p=new Placement{len=Marshal.SizeOf(typeof(Placement))};GetWindowPlacement(w,ref p);return IsIconic(w)+","+IsZoomed(w)+","+IsWindowVisible(w)+","+p.flags+","+p.show+","+p.normal.l+","+p.normal.t+","+p.normal.r+","+p.normal.b;}
 static IntPtr Window(string start){IntPtr w=CreateWindowEx(0x08080080,"STATIC","",0x00cf0000,-32000,-32000,200,120,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);if(w==IntPtr.Zero)throw new Exception("fixture window");SetLayeredWindowAttributes(w,0,0,2);ShowWindow(w,start.Contains("Maximized")||start=="maximized"?3:4);if(start.StartsWith("minimized"))ShowWindow(w,7);ShowWindow(w,0);return w;}
 static int Num(object v){return Convert.ToInt32(v);}
 static IntPtr Stub(byte[] b){IntPtr p=VirtualAlloc(IntPtr.Zero,(UIntPtr)b.Length,0x3000,0x40);Marshal.Copy(b,0,p,b.Length);return p;}
 static ABI MakeABI(){var c=new List<byte>();Action<byte[]>e=a=>c.AddRange(a);Action<int>d=v=>e(BitConverter.GetBytes(v));
  e(new byte[]{0x55,0x8b,0xec,0x53,0x56,0x57,0x83,0xec,4,0x89,0x2c,0x24,0xbb});d(0x12345678);e(new byte[]{0xbe});d(0x23456789);e(new byte[]{0xbf});d(0x3456789a);e(new byte[]{0xff,0x75,16,0xff,0x75,12,0xff,0x55,8,0x8b,0x55,20,0x89,0x02,0x31,0xc0});
  e(new byte[]{0x81,0xfb});d(0x12345678);e(new byte[]{0x74,3,0x83,0xc8,1,0x81,0xfe});d(0x23456789);e(new byte[]{0x74,3,0x83,0xc8,2,0x81,0xff});d(0x3456789a);e(new byte[]{0x74,3,0x83,0xc8,4,0x3b,0x2c,0x24,0x74,3,0x83,0xc8,8,0x8d,0x4d,0xf0,0x3b,0xe1,0x74,3,0x83,0xc8,16,0x8b,0xe1,0x83,0xc4,4,0x5f,0x5e,0x5b,0x5d,0xc2,16,0});return (ABI)Marshal.GetDelegateForFunctionPointer(Stub(c.ToArray()),typeof(ABI));
 }
 static IntPtr Callsite(IntPtr mem,int returned,int wrapper){int start=returned-13;var c=new List<byte>(new byte[]{0xff,0x74,0x24,8,0xff,0x74,0x24,8,0xe8});c.AddRange(BitConverter.GetBytes(wrapper-returned));c.AddRange(new byte[]{0xc2,8,0});Marshal.Copy(c.ToArray(),0,IntPtr.Add(mem,start),c.Count);return IntPtr.Add(mem,start);}
 static void Main(){var meta=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText("tray-restore-test.json"));int rva=Num(meta["rva"]),expectedReturn=Num(meta["sourceReturnRva"]);var code=File.ReadAllBytes("tray-restore-test.bin");IntPtr mem=VirtualAlloc(IntPtr.Zero,(UIntPtr)(expectedReturn+4096),0x3000,0x40);Marshal.Copy(code,0,IntPtr.Add(mem,rva),code.Length);
  GetError ge=delegate{gets++;return 0x123abc;};SetError se=delegate(uint e){sets++;lastError=e;};Iconic ic=delegate(IntPtr w){queries++;return IsIconic(w);};Show sh=delegate(IntPtr w,int c){lastCommand=c;lastWindow=w;return ShowWindow(w,c);};var funcs=new Dictionary<string,Delegate>{{"GetLastError",ge},{"SetLastError",se},{"IsIconic",ic},{"ShowWindow",sh}};foreach(var x in (System.Collections.IEnumerable)meta["imports"]){var i=(Dictionary<string,object>)x;Marshal.WriteIntPtr(IntPtr.Add(mem,Num(i["iat"])),Marshal.GetFunctionPointerForDelegate(funcs[(string)i["name"]]));}
  var invoke=MakeABI();foreach(bool match in new[]{true,false})foreach(string start in new[]{"normal","maximized","minimizedFromNormal","minimizedFromMaximized"})foreach(int command in new[]{0,4,5,9}){
   IntPtr a=Window(start),b=Window(start),fn=Callsite(mem,expectedReturn+(match?0:64),rva);bool eligible=match&&command==5;int expected=eligible&&IsIconic(a)?9:command;bool native=ShowWindow(a,expected);gets=sets=queries=0;lastError=0;lastCommand=-1;lastWindow=IntPtr.Zero;int result;Check(invoke(fn,b,command,out result)==0,"nonvolatile registers/stack");Check((result!=0)==native,"ShowWindow return");Check(lastCommand==expected&&lastWindow==b,"forwarded args");Check(State(a)==State(b),"window placement/state differs");Check(queries==(eligible?1:0)&&gets==queries&&sets==queries,"scope or error-call count");if(eligible)Check(lastError==0x123abc,"incoming last error not restored");DestroyWindow(a);DestroyWindow(b);
  }
  GC.KeepAlive(funcs);Console.WriteLine("PASS "+checks+" checks across 32 real transparent/no-activate fixture-window pairs: exact caller+command, conditional restoration, maximum/normal placement, native BOOL, register/stack and error preservation. No Foxmail initialization.");
 }
}
