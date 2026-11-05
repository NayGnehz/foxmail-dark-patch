using System;
using System.IO;
using System.Collections.Generic;
using System.Runtime.InteropServices;
// Executes the exact old/new 36-byte x86 blocks in this isolated process.
// No Foxmail process is opened. Original BSTR runtime is relocated and calls
// the real oleaut32 SysReAllocStringLen/SysFreeString, not a mock assignment.
class EditorCanvasCheck {
 [DllImport("kernel32",SetLastError=true)]static extern IntPtr VirtualAlloc(IntPtr a,UIntPtr n,uint kind,uint protect);
 [DllImport("kernel32")]static extern bool VirtualFree(IntPtr a,UIntPtr n,uint kind);
 [DllImport("kernel32",CharSet=CharSet.Unicode)]static extern IntPtr LoadLibrary(string s);
 [DllImport("kernel32",CharSet=CharSet.Ansi)]static extern IntPtr GetProcAddress(IntPtr m,string s);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate void Run(IntPtr obj);
 static IntPtr mem;static byte[] exe;static int codeRaw,codeRva;static int total;
 static int A(int r){return unchecked(mem.ToInt32()+r);}
 static IntPtr P(int r){return new IntPtr(A(r));}
 static byte[] Hex(string h){byte[] b=new byte[h.Length/2];for(int i=0;i<b.Length;i++)b[i]=Convert.ToByte(h.Substring(i*2,2),16);return b;}
 static void Put(int r,byte[] b){Marshal.Copy(b,0,P(r),b.Length);}
 static int Read(int r){return Marshal.ReadInt32(P(r));}
 static void I32(int r,int v){Marshal.WriteInt32(P(r),v);}
 static byte[] Source(int va,int n){var b=new byte[n];Buffer.BlockCopy(exe,codeRaw+va-0x400000-codeRva,b,0,n);return b;}
 static void Check(bool v,string m){if(!v){Console.WriteLine("FAIL "+m);Environment.Exit(2);}total++;}
 static void AddI(List<byte> b,int v){b.AddRange(BitConverter.GetBytes(v));}
 static void Abs(List<byte>b,byte[] op,int r){b.AddRange(op);AddI(b,A(r));}
 static void Jmp(List<byte>b,int codeRvaHere,int target){b.Add(0xe9);AddI(b,target-(codeRvaHere+b.Count+4));}
 static void Reloc(byte[] b,int offset,int originalVA,int newRva,int targetVA){Buffer.BlockCopy(BitConverter.GetBytes((targetVA-0x400000)-(newRva+offset+4)),0,b,offset,4);}
 static int AddFlags(int value){uint x=unchecked((uint)value),y=20,z=unchecked(x+y);int f=0;if(z<x)f|=1;if(z==0)f|=0x40;if((z&0x80000000)!=0)f|=0x80;if(((x^y^z)&16)!=0)f|=16;if(((~(x^y)&(x^z))&0x80000000)!=0)f|=0x800;int parity=0;for(int i=0;i<8;i++)parity^=(int)(z>>i)&1;if(parity==0)f|=4;return f;}
 static void Build(){
  var ole=LoadLibrary("oleaut32.dll");Check(ole!=IntPtr.Zero,"oleaut load");
  I32(0xefa5c4,GetProcAddress(ole,"SysReAllocStringLen").ToInt32());I32(0xefa5c0,GetProcAddress(ole,"SysFreeString").ToInt32());
  foreach(int r in new[]{0x14f0,0x14f8}){var thunk=Source(r+0x400000,6);I32(0,0);Buffer.BlockCopy(BitConverter.GetBytes(A(r==0x14f0?0xefa5c4:0xefa5c0)),0,thunk,2,4);Put(r,thunk);}
  // Runtime's empty-string and failure branches are preserved. Successful cases
  // use the exact original 4058C4 bytes, with only PC-relative relocation.
  Put(0x5888,Source(0x405888,21));Put(0x5858,Hex("cc"));
  var rt=Source(0x4058c4,36);Reloc(rt,4,0x4058c4,0x11000,0x405888);Reloc(rt,15,0x4058c4,0x11000,0x405888);Reloc(rt,23,0x4058c4,0x11000,0x4014f0);Reloc(rt,31,0x4058c4,0x11000,0x405858);Put(0x11000,rt);
  Put(0x77b658,Source(0xb7b658,16));
  // Spy at the original assignment target captures all entry registers without
  // changing them or EFLAGS, then jumps to the relocated original routine.
  var spy=new List<byte>();
  Abs(spy,Hex("a3"),0x20000);Abs(spy,Hex("8915"),0x20004);Abs(spy,Hex("890d"),0x20008);Abs(spy,Hex("8925"),0x2000c);
  Abs(spy,Hex("891d"),0x20010);Abs(spy,Hex("8935"),0x20014);Abs(spy,Hex("893d"),0x20018);Abs(spy,Hex("892d"),0x2001c);
  spy.AddRange(Hex("9c58"));Abs(spy,Hex("a3"),0x20020);Abs(spy,Hex("a1"),0x20000);Jmp(spy,0x58c4,0x11000);Put(0x58c4,spy.ToArray());
  var pre=new List<byte>(Hex("558bec83ec045356578b45088945fcbb44332211be88776655bfccbbaa99b9df9b5713"));
  Abs(pre,Hex("8925"),0x20024);Abs(pre,Hex("892d"),0x20028);Jmp(pre,0x12000,0x77b626);Put(0x12000,pre.ToArray());
  var post=new List<byte>();Abs(post,Hex("8925"),0x2002c);Abs(post,Hex("891d"),0x20030);Abs(post,Hex("8935"),0x20034);Abs(post,Hex("893d"),0x20038);Abs(post,Hex("892d"),0x2003c);post.AddRange(Hex("5f5e5b8be55dc20400"));Put(0x12100,post.ToArray());
  var cont=new List<byte>();Jmp(cont,0x77b64a,0x12100);Put(0x77b64a,cont.ToArray());
 }
 static int[] Execute(string block,string prior,int fill){
  var bytes=Hex(block);Check(bytes.Length==36,"block length");
  // Only image relocation: charset imm32. Original CALL displacement untouched.
  Check(BitConverter.ToInt32(bytes,32)==unchecked((int)0xff88a27a),"original CALL displacement");
  Buffer.BlockCopy(BitConverter.GetBytes(A(0x77b65c)),0,bytes,27,4);Put(0x77b626,bytes);
  IntPtr obj=Marshal.AllocHGlobal(32);IntPtr bs=IntPtr.Zero;
  try{
   for(int i=0;i<32;i++)Marshal.WriteByte(obj,i,(byte)fill);
   if(prior!=null)bs=Marshal.StringToBSTR(prior);Marshal.WriteIntPtr(obj,20,bs);
   byte[] before=new byte[32];Marshal.Copy(obj,before,0,32);
   for(int i=0;i<64;i+=4)I32(0x20000+i,0);
   var run=(Run)Marshal.GetDelegateForFunctionPointer(P(0x12000),typeof(Run));run(obj);bs=Marshal.ReadIntPtr(obj,20);
   Check(Marshal.ReadInt32(obj,4)==1&&Marshal.ReadInt32(obj,8)==5,"pool sizing fields");
   Check(Marshal.PtrToStringBSTR(bs)=="utf-8","real BSTR assignment result");Check(Marshal.ReadInt32(bs,-4)==10,"BSTR byte length");
   Check(Read(0x20000)==obj.ToInt32()+20,"assignment destination argument");Check(Read(0x20004)==A(0x77b65c),"assignment UTF-8 literal argument");Check(Read(0x20008)==0x13579bdf,"ECX not clobbered before call");
   Check(Read(0x2000c)==Read(0x20024)-4,"assignment call stack includes return address");Check(Read(0x20024)==Read(0x2002c),"balanced stack after call");
   Check(Read(0x2001c)==Read(0x20028)&&Read(0x2003c)==Read(0x20028),"EBP preserved");
   Check(Read(0x20010)==0x11223344&&Read(0x20030)==0x11223344,"EBX preserved");Check(Read(0x20014)==0x55667788&&Read(0x20034)==0x55667788,"ESI preserved");Check(Read(0x20018)==unchecked((int)0x99aabbcc)&&Read(0x20038)==unchecked((int)0x99aabbcc),"EDI preserved");
   Check(Read(0x77b658)==10&&Marshal.PtrToStringUni(P(0x77b65c))=="utf-8","original source BSTR header and chars untouched");
   byte[] after=new byte[32];Marshal.Copy(obj,after,0,32);
   for(int i=0;i<32;i++)if(!((i>=4&&i<12)||(i>=20&&i<28)))Check(before[i]==after[i],"unrelated object byte "+i);
   int bg=Marshal.ReadInt32(obj,24);Check(bg==(block==Old?BitConverter.ToInt32(before,24):unchecked((int)0xff202020)),"background field only extra effect");
   Check((Read(0x20020)&0x8d5)==AddFlags(obj.ToInt32()),"exact ADD EFLAGS from actual object address");
   return new[]{Marshal.ReadInt32(obj,4),Marshal.ReadInt32(obj,8),Read(0x20008)};
  }finally{if(bs!=IntPtr.Zero)Marshal.FreeBSTR(bs);Marshal.FreeHGlobal(obj);}
 }
 const string Old="8b45fcc74004010000008b45fcc74008050000008b45fc83c014ba5cb6b700e87aa288ff";
 const string New="8b45fc6a015a895004c7400805000000c74018202020ff83c014ba5cb6b700e87aa288ff";
 static void Main(string[] args){
  Check(IntPtr.Size==4,"must execute x86");exe=File.ReadAllBytes(args[0]);int pe=BitConverter.ToInt32(exe,60),op=pe+24,so=op+BitConverter.ToUInt16(exe,pe+20);for(int i=0;i<BitConverter.ToUInt16(exe,pe+6);i++){int q=so+40*i;if(BitConverter.ToInt32(exe,q+12)==0x1000){codeRva=0x1000;codeRaw=BitConverter.ToInt32(exe,q+20);}}
  Check(codeRaw!=0,"source .text mapping");Check(BitConverter.ToString(Source(0xb7b626,36)).Replace("-","").ToLowerInvariant()==Old,"source block guard");
  mem=VirtualAlloc(IntPtr.Zero,(UIntPtr)0xf00000,0x3000,0x40);Check(mem!=IntPtr.Zero,"isolated executable mapping");
  try{Build();int cases=0;foreach(string prior in new string[]{null,"","utf-8","previous charset longer than utf-8","\u7b7e\u540d\u6d4b\u8bd5"})foreach(int fill in new[]{0,0x5a,0xff}){var a=Execute(Old,prior,fill);var b=Execute(New,prior,fill);for(int i=0;i<a.Length;i++)Check(a[i]==b[i],"old/new state equivalence "+i);cases++;}Console.WriteLine("PASS "+cases+" paired actual-x86 executions; "+total+" assertions; original OleAut32 BSTR assignment, fields, call inputs, stack, nonvolatile registers and flags preserved. Only new background field differs. No Foxmail process opened.");}finally{VirtualFree(mem,UIntPtr.Zero,0x8000);}
 }
}
