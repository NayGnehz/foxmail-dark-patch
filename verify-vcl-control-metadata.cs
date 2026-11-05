using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// Synthetic test memory and properties belong ONLY to this test process.
class VerifyVclControlMetadata {
 [DllImport("kernel32")]static extern IntPtr VirtualAlloc(IntPtr a,UIntPtr n,uint type,uint protect);
 [DllImport("kernel32")]static extern bool VirtualFree(IntPtr a,UIntPtr n,uint type);
 [DllImport("kernel32")]static extern bool VirtualProtect(IntPtr a,UIntPtr n,uint protect,out uint old);
 [DllImport("kernel32",CharSet=CharSet.Ansi)]static extern ushort GlobalAddAtom(string s);
 [DllImport("kernel32")]static extern ushort GlobalDeleteAtom(ushort atom);
 [DllImport("user32",EntryPoint="SetPropA")]static extern bool SetProp(IntPtr h,IntPtr atom,IntPtr data);
 [DllImport("user32",EntryPoint="RemovePropA")]static extern IntPtr RemoveProp(IntPtr h,IntPtr atom);
 static uint image;static IntPtr allocation,obj;static int checks;
 static IntPtr P(uint r){return new IntPtr(unchecked((int)(image+r)));}
 static void W(uint r,uint v){Marshal.WriteInt32(P(r),unchecked((int)v));}
 static void B(uint r,byte v){Marshal.WriteByte(P(r),v);}
 static void S(uint r,ushort v){Marshal.WriteInt16(P(r),unchecked((short)v));}
 static void Class(uint r,uint len,uint nameRva,string name,uint parentRva){
  W(r-76,image+r);W(r-44,image+nameRva);W(r-40,len);W(r-36,parentRva==0?0:image+0x10000+r%256*4);
  if(parentRva!=0)W(0x10000+r%256*4,image+parentRva);
  B(nameRva,(byte)name.Length);Marshal.Copy(Encoding.ASCII.GetBytes(name),0,P(nameRva+1),name.Length);
 }
 static void Check(bool c,string n){checks++;if(!c)throw new Exception(n);}
 static Dictionary<string,object> D(object x){return (Dictionary<string,object>)x;}
 static object Read(IntPtr process,IntPtr hwnd){return VclControlMetadata.Read(process,image,hwnd);}
 [STAThread]static void Main(){
  allocation=VirtualAlloc(IntPtr.Zero,(UIntPtr)0xF00000,0x3000,4);if(allocation==IntPtr.Zero)throw new Exception("allocation");image=unchecked((uint)allocation.ToInt32());obj=P(0x20000);
  ushort atom=GlobalAddAtom("CodexVclMetadataSynthetic_"+Process.GetCurrentProcess().Id);
  using(var form=new Form())using(var process=Process.GetCurrentProcess())try{
   var hwnd=form.Handle;var ph=process.Handle;
   B(0,77);B(1,90);W(60,0x100);W(0x100,0x4550);S(0x104,0x14c);S(0x118,0x10b);W(0x150,0xF00000);
   Class(0xD25318,0x204,0x11000,"TWinControl",0);
   Class(0x61db24,0x270,0x11100,"TXPanel",0xD25318);
   Class(0x9cd254,0x470,0x11200,"TOptionForm",0xD25318);
   Class(0x30040,16,0x11300,"TList",0);
   S(0xEF91B6,atom);Check(SetProp(hwnd,new IntPtr(atom),obj),"own-window SetProp");
   W(0x20000,image+0x61db24);W(0x20180,unchecked((uint)hwnd.ToInt32()));B(0x20052,4);B(0x20057,1);B(0x201f8,1);W(0x20070,0xff00000f);
   B(0x20230,0);B(0x20231,1);B(0x20264,15);W(0x20228,0x202020);
   var panel=D(Read(ph,hwnd));Check((string)panel["className"]=="TXPanel","panel identity");Check((bool)panel["prefillExactVmtSupported"],"exact VMT support");
   Check((bool)D(panel["common"])["parentBackground"],"parent-background bit");Check((byte)D(panel["common"])["doubleBufferedByte"]==1,"double-buffer byte");
   Check((byte)D(panel["panel"])["eraseBkgndByte"]==0&&(byte)D(panel["panel"])["inheritedPaintByte"]==1&&(byte)D(panel["panel"])["paintBordersBits"]==15,"RTTI panel names");
   string json=new JavaScriptSerializer().Serialize(panel);Check(json.Contains("colorTColor")&&!json.Contains("caption"),"JSON DTO");
   W(0x20000,image+0x9cd254);W(0x2035c,image+0x21000);W(0x21000,image+0x30040);W(0x21008,4);B(0x203d8,1);
   var option=D(Read(ph,hwnd));Check((int)D(option["optionForm"])["list35cCount"]==4,"validated TList count");
   W(0x21008,0xffffffff);Check(D(D(Read(ph,hwnd))["optionForm"])["list35cCount"]==null,"invalid count ignored");
   W(0x2035c,0);Check(D(D(Read(ph,hwnd))["optionForm"])["list35cCount"]==null,"null list ignored");
   W(0x20180,1);Check(Read(ph,hwnd)==null,"HWND mismatch rejected");W(0x20180,unchecked((uint)hwnd.ToInt32()));
   W(0x9cd254-76,0);Check(Read(ph,hwnd)==null,"invalid VMT rejected");W(0x9cd254-76,image+0x9cd254);
   W(0x10150,image+0x9cd254);Check(Read(ph,hwnd)==null,"parent cycle rejected");W(0x10150,image+0xD25318);
   B(0x11201,32);Check(Read(ph,hwnd)==null,"invalid class-name rejected");B(0x11201,(byte)'T');
   S(0x104,0x8664);Check(Read(ph,hwnd)==null,"wrong machine rejected");S(0x104,0x14c);
   S(0xEF91B6,0);Check(Read(ph,hwnd)==null,"missing atom rejected");S(0xEF91B4,atom);Check(Read(ph,hwnd)!=null,"alternate fixed atom");
   uint old;Check(VirtualProtect(obj,(UIntPtr)0x1000,1,out old),"protect synthetic object");Check(Read(ph,hwnd)==null,"PAGE_NOACCESS rejected");VirtualProtect(obj,(UIntPtr)0x1000,old,out old);
   Check(VclControlMetadata.Read(IntPtr.Zero,image,hwnd)==null,"null process");Check(VclControlMetadata.Read(ph,image,IntPtr.Zero)==null,"null hwnd");Check(VclControlMetadata.Read(ph,0,hwnd)==null,"invalid image");
   Console.WriteLine("PASS "+checks+" checks: fixed atom/GetProp lookup, VMT/HWND and layout validation, numeric DTOs, negative/memory guards; no Foxmail access.");
  }finally{RemoveProp(form.Handle,new IntPtr(atom));GlobalDeleteAtom(atom);VirtualFree(allocation,UIntPtr.Zero,0x8000);}
 }
}
