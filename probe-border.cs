using System;using System.Collections.Generic;using System.Runtime.InteropServices;
class ProbeBorder {
 [StructLayout(LayoutKind.Sequential)]struct RECT{public int left,top,right,bottom;public RECT(int a,int b,int c,int d){left=a;top=b;right=c;bottom=d;}public override string ToString(){return left+","+top+","+right+","+bottom;}}
 [DllImport("gdi32")]static extern IntPtr CreateCompatibleDC(IntPtr dc);
 [DllImport("gdi32")]static extern IntPtr CreateDIBSection(IntPtr dc,IntPtr info,uint use,out IntPtr bits,IntPtr section,uint offset);
 [DllImport("gdi32")]static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
 [DllImport("gdi32")]static extern bool DeleteObject(IntPtr obj);
 [DllImport("gdi32")]static extern bool DeleteDC(IntPtr dc);
 [DllImport("gdi32")]static extern bool GdiFlush();
 [DllImport("user32")]static extern bool DrawEdge(IntPtr dc,ref RECT rect,uint edge,uint flags);
 static void Main(){
 IntPtr dc=CreateCompatibleDC(IntPtr.Zero),info=Marshal.AllocHGlobal(40),bits;for(int i=0;i<40;i++)Marshal.WriteByte(info,i,0);Marshal.WriteInt32(info,40);Marshal.WriteInt32(info,4,20);Marshal.WriteInt32(info,8,-20);Marshal.WriteInt16(info,12,1);Marshal.WriteInt16(info,14,32);
 IntPtr bmp=CreateDIBSection(dc,info,0,out bits,IntPtr.Zero,0),old=SelectObject(dc,bmp);
 foreach(uint e in new uint[]{1,2,4,8,5,10,6,9})foreach(uint m in new uint[]{0,0x8000,0x4000})foreach(uint extra in new uint[]{0,0x2000,0x800,0x2800}){
  GdiFlush();for(int i=0;i<400;i++)Marshal.WriteInt32(bits,i*4,0x001e2228);RECT r=new RECT(2,2,18,18);bool ok=DrawEdge(dc,ref r,e,15|m|extra);GdiFlush();var cols=new SortedDictionary<int,int>();for(int i=0;i<400;i++){int c=Marshal.ReadInt32(bits,i*4)&0xffffff;if(c!=0x1e2228){if(!cols.ContainsKey(c))cols[c]=0;cols[c]++;}}
  var list=new List<string>();foreach(var x in cols)list.Add(x.Key.ToString("X6")+":"+x.Value);Console.WriteLine("edge="+e+" mode="+m.ToString("X")+" extra="+extra.ToString("X")+" ok="+ok+" rect="+r+" colors="+string.Join(" ",list.ToArray()));
 }
 SelectObject(dc,old);DeleteObject(bmp);DeleteDC(dc);Marshal.FreeHGlobal(info);
 }
}
