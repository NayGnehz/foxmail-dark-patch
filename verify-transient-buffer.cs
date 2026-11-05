using System;using System.IO;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Text;
class TransientTest{
 [DllImport("kernel32")]static extern IntPtr VirtualAlloc(IntPtr p,UIntPtr size,uint type,uint protect);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int Show(int w,int cmd);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int One(int w);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int Two(int w,int index);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int Three(int w,int index,int value);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int ClassName(int w,IntPtr b,int n);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int Redraw(int w,int rect,int region,int flags);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int GetError();
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate void SetError(int value);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int Module(IntPtr name);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate IntPtr Proc(int module,IntPtr name);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate void Entry();
 static Dictionary<string,int> m=new Dictionary<string,int>();static List<Delegate> roots=new List<Delegate>();static IntPtr image;static Show hook,probe;static int error,style,ex,cls,calls,sets,redraws,visible,exists,result,returnError,entryError,seenEx,failedClear,readbackMode,expectedCommand=5;static string className;static bool reenter,hideAfter,destroyAfter,mutate,enableFail;static int cases;
 static int C=0x2000000;
 static void Check(bool value,string text){if(!value)throw new Exception(text);}
 static void Put(string name,Delegate d){roots.Add(d);Marshal.WriteIntPtr(IntPtr.Add(image,m[name]),Marshal.GetFunctionPointerForDelegate(d));}
 static void Reset(){error=0x1357;style=0;ex=0;cls=0;calls=sets=redraws=0;visible=0;exists=1;result=0;returnError=0x2468;entryError=-1;seenEx=-1;failedClear=0;readbackMode=0;className="TFoxMainFrm.UnicodeClass";expectedCommand=5;reenter=hideAfter=destroyAfter=mutate=enableFail=false;Marshal.WriteInt32(IntPtr.Add(image,m["busyRva"]),0);Marshal.WriteInt32(IntPtr.Add(image,m["restoreFailuresRva"]),0);}
 static void Run(int command,bool owned){expectedCommand=command;int before=ex;int r=probe(0x1234,command);Check(r==result,"BOOL forwarding");Check(error==returnError,"LastError forwarding");Check(calls==1,"one original call");Check(entryError==0x1357,"entry LastError");Check(sets==(owned?2:0),"style call count "+sets);Check(redraws==(owned?1:0),"redraw count");Check(ex==before,"style restoration");Check(Marshal.ReadInt32(IntPtr.Add(image,m["busyRva"]))==0,"guard reset");Check(Marshal.ReadInt32(IntPtr.Add(image,0x204))==0x12345678&&Marshal.ReadInt32(IntPtr.Add(image,0x208))==0x23456789&&Marshal.ReadInt32(IntPtr.Add(image,0x20c))==0x3456789a,"nonvolatile registers");Check(Marshal.ReadInt32(IntPtr.Add(image,0x210))==0,"stack balance");if(owned)Check(Marshal.ReadInt32(IntPtr.Add(image,0x214))==0x456789ab,"saved EDX");cases++;}
 static void Main(string[] args){Check(IntPtr.Size==4,"requires x86");foreach(string line in File.ReadAllLines(args[1])){var p=line.Split(',');m[p[0]]=int.Parse(p[1]);}var bytes=File.ReadAllBytes(args[0]);image=VirtualAlloc(IntPtr.Zero,(UIntPtr)bytes.Length,0x3000,0x40);Marshal.Copy(bytes,0,image,bytes.Length);
 Put("GetLastError",new GetError(delegate{return error;}));Put("SetLastError",new SetError(delegate(int v){error=v;}));
 Put("IsWindow",new One(delegate(int w){Check(w==0x1234,"IsWindow hwnd");return exists;}));Put("IsWindowVisible",new One(delegate(int w){return visible;}));
 Put("GetClassNameA",new ClassName(delegate(int w,IntPtr b,int n){byte[] z=Encoding.ASCII.GetBytes(className+"\0");Marshal.Copy(z,0,b,Math.Min(z.Length,n));error=91;return z.Length-1;}));
 Put("GetWindowLongW",new Two(delegate(int w,int index){error=92;return index==-16?style:ex;}));
 Put("SetWindowLongW",new Three(delegate(int w,int index,int value){Check(index==-20,"set index");sets++;int prev=ex;if((value&C)!=0&&enableFail){error=5;if(readbackMode==1)ex=value;return 0;}if((value&C)==0&&failedClear>0){failedClear--;error=5;return 0;}ex=value;error=0;return prev;}));
 Two getClass=new Two(delegate(int w,int index){Check(index==-26,"class index");error=93;return cls;});roots.Add(getClass);IntPtr classPtr=Marshal.GetFunctionPointerForDelegate(getClass);
 Put("GetModuleHandleA",new Module(delegate(IntPtr n){Check(Marshal.PtrToStringAnsi(n)=="user32.dll","resolver dll");return 17;}));Put("GetProcAddress",new Proc(delegate(int h,IntPtr n){Check(h==17&&Marshal.PtrToStringAnsi(n)=="GetClassLongA","resolver name");return classPtr;}));
 Put("RedrawWindow",new Redraw(delegate(int w,int rect,int region,int flags){Check((ex&C)!=0,"repaint must own composited");Check(w==0x1234&&rect==0&&region==0&&flags==0x181,"redraw arguments");redraws++;if(mutate)ex|=0x40000;error=94;if(reenter){reenter=false;int savedCalls=calls;hook(0x1234,5);Check(calls==savedCalls+1,"reentrant original");}return 1;}));
 Put("original",new Show(delegate(int w,int cmd){Check(w==0x1234,"original hwnd");Check(cmd==expectedCommand,"original command");calls++;entryError=error;seenEx=ex;visible=hideAfter?0:1;if(destroyAfter)exists=0;error=returnError;return result;}));
 ((Entry)Marshal.GetDelegateForFunctionPointer(IntPtr.Add(image,m["init"]),typeof(Entry)))();Check(Marshal.ReadIntPtr(IntPtr.Add(image,m["slotRva"]))==classPtr,"dynamic init");
 hook=(Show)Marshal.GetDelegateForFunctionPointer(IntPtr.Add(image,m["hook"]),typeof(Show));probe=(Show)Marshal.GetDelegateForFunctionPointer(IntPtr.Add(image,m["probe"]),typeof(Show));
 foreach(int cmd in new[]{1,3,4,5,9})foreach(int ret in new[]{0,1,-7}){Reset();result=ret;Run(cmd,true);Check((seenEx&C)!=0,"enabled before original");}
 foreach(int cmd in new[]{0,2,6,7,8,10,11,-1,200}){Reset();Run(cmd,false);}
 foreach(string name in new[]{"TApplication","TFoxMainFrm","TFoxMainFrm.UnicodeClassX","tFoxMainFrm.UnicodeClass","TSettingsFrm.UnicodeClass",""}){Reset();className=name;Run(5,false);}
 foreach(int bits in new[]{C,0x80000,0x200000,C|0x40000}){Reset();ex=bits;Run(5,false);}
 foreach(int bits in new[]{0x20,0x40,0x80,0xe0}){Reset();cls=bits;Run(5,false);}
 Reset();style=0x40000000;Run(5,false);Reset();visible=1;Run(5,false);Reset();exists=0;Run(5,false);
 Reset();Marshal.WriteInt32(IntPtr.Add(image,m["slotRva"]),0);Run(5,false);Marshal.WriteIntPtr(IntPtr.Add(image,m["slotRva"]),classPtr);
 Reset();ex=0x40000;Run(5,true);
 Reset();mutate=true;probe(0x1234,5);Check(ex==0x40000&&redraws==1&&error==returnError,"unrelated bits updated during repaint");cases++;
 Reset();enableFail=true;probe(0x1234,5);Check(sets==1&&ex==0&&redraws==0&&calls==1&&error==returnError,"enable failure fallback");cases++;
 Reset();enableFail=true;readbackMode=1;probe(0x1234,5);Check(sets==2&&ex==0&&redraws==0&&calls==1&&error==returnError,"failed enable with observed bit rollback");cases++;
 Reset();failedClear=1;probe(0x1234,5);Check(sets==3&&ex==0&&error==returnError,"clear readback retries");cases++;
 Reset();failedClear=2;probe(0x1234,5);Check(sets==3&&ex==C&&Marshal.ReadInt32(IntPtr.Add(image,m["restoreFailuresRva"]))==1&&error==returnError,"irrecoverable clear is reported");cases++;
 Reset();hideAfter=true;probe(0x1234,5);Check(sets==2&&redraws==0&&ex==0&&error==returnError,"hidden after original no redraw");cases++;
 Reset();destroyAfter=true;probe(0x1234,5);Check(sets==1&&redraws==0&&error==returnError,"destroyed window no cleanup APIs");cases++;
 Reset();reenter=true;probe(0x1234,5);Check(calls==2&&sets==2&&redraws==1&&ex==0&&error==returnError,"reentrancy bypass");cases++;
 Reset();Marshal.WriteInt32(IntPtr.Add(image,m["busyRva"]),1);probe(0x1234,5);Check(calls==1&&sets==0&&redraws==0&&error==returnError&&Marshal.ReadInt32(IntPtr.Add(image,m["busyRva"]))==1,"preexisting guard bypass");cases++;
 Console.WriteLine("PASS "+cases+" isolated x86 cases: gates, resolver, ABI, original arguments/BOOL/LastError, readback/rollback, repaint, reentry, unrelated style bits; unrecoverable restore explicitly counted.");GC.KeepAlive(roots);
 }
}

