using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

// Foxmail 7.x x86 build-specific, external READ-ONLY metadata inspection.
// No messages, UIA, remote execution, GetDC, memory writes, names/captions or mail.
// GetProp returns a pointer value; only guarded ReadProcessMemory dereferences it.
// Call with a PROCESS_VM_READ | PROCESS_QUERY_INFORMATION handle. Compile /platform:x86.
public static class VclControlMetadata {
    const uint WinControlRva = 0xD25318;
    static readonly uint[] AtomRvas = {0xEF91B6, 0xEF91B4, 0xEF5B80, 0xEF5B7E};
    [StructLayout(LayoutKind.Sequential)]
    struct MBI {
        public IntPtr BaseAddress, AllocationBase;
        public uint AllocationProtect;
        public UIntPtr RegionSize;
        public uint State, Protect, Type;
    }
    [DllImport("kernel32", SetLastError=true)]
    static extern bool ReadProcessMemory(IntPtr p, IntPtr a, byte[] b, int n, out IntPtr read);
    [DllImport("kernel32")]
    static extern UIntPtr VirtualQueryEx(IntPtr p, IntPtr a, out MBI m, UIntPtr n);
    [DllImport("kernel32")]
    static extern uint GetProcessId(IntPtr process);
    [DllImport("user32")]
    static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
    [DllImport("user32", EntryPoint="GetPropA")]
    static extern IntPtr GetProp(IntPtr hwnd, IntPtr atom);

    static string Hex(uint n) { return "0x" + n.ToString("X8"); }
    static byte[] Bytes(IntPtr p, ulong a, int n) {
        // Bound every read; do not cross a VM region or read guard/no-access pages.
        if(a < 65536 || a > UInt32.MaxValue || n < 1 || n > 256 || a+(uint)n > 0x100000000UL) return null;
        MBI m; IntPtr address = new IntPtr(unchecked((int)(uint)a));
        if(VirtualQueryEx(p,address,out m,(UIntPtr)Marshal.SizeOf(typeof(MBI)))==UIntPtr.Zero ||
           m.State!=0x1000 || (m.Protect&0x101)!=0) return null;
        ulong end=unchecked((uint)m.BaseAddress.ToInt32())+m.RegionSize.ToUInt64();
        if(a+(uint)n>end) return null;
        byte[] b=new byte[n]; IntPtr got;
        return ReadProcessMemory(p,address,b,n,out got) && got.ToInt64()==n ? b : null;
    }
    static uint? U32(IntPtr p, ulong a) { byte[] b=Bytes(p,a,4);return b==null?(uint?)null:BitConverter.ToUInt32(b,0); }
    static byte? U8(IntPtr p, ulong a) { byte[] b=Bytes(p,a,1);return b==null?(byte?)null:b[0]; }
    static bool InImage(uint image,uint size,uint a,int n) { return a>=image && (ulong)a+(uint)n<=(ulong)image+size; }
    static Dictionary<string,object> Map() { return new Dictionary<string,object>(); }
    static object Color(uint? value) { return value.HasValue ? (object)Hex(value.Value) : null; }

    static uint ImageSize(IntPtr p,uint image) {
        byte[] dos=Bytes(p,image,64);if(dos==null||dos[0]!=77||dos[1]!=90)return 0;
        uint peOffset=BitConverter.ToUInt32(dos,60);if(peOffset<64||peOffset>0x100000)return 0;
        byte[] pe=Bytes(p,(ulong)image+peOffset,88);
        if(pe==null||BitConverter.ToUInt32(pe,0)!=0x4550||BitConverter.ToUInt16(pe,4)!=0x14c||
           BitConverter.ToUInt16(pe,24)!=0x10b)return 0;
        uint size=BitConverter.ToUInt32(pe,80);
        return size>0xEF91B8&&size<=0x10000000&&(ulong)image+size<=0x100000000UL?size:0;
    }
    // Delphi VMT -76 self, -44 class ShortString pointer, -40 instance size,
    // -36 pointer-to-parent-VMT. Class names are executable metadata, never captions.
    static string ClassInfo(IntPtr p,uint image,uint size,uint vmt,out uint instanceSize,out uint parent) {
        instanceSize=0;parent=0;
        if(vmt<76||!InImage(image,size,vmt-76,80))return null;
        byte[] b=Bytes(p,vmt-76,80);if(b==null||BitConverter.ToUInt32(b,0)!=vmt)return null;
        uint name=BitConverter.ToUInt32(b,32);instanceSize=BitConverter.ToUInt32(b,36);
        if(instanceSize<4||instanceSize>0x100000||!InImage(image,size,name,1))return null;
        byte? len=U8(p,name);if(!len.HasValue||len.Value<1||len.Value>80||!InImage(image,size,name,1+len.Value))return null;
        byte[] chars=Bytes(p,(ulong)name+1,len.Value);if(chars==null)return null;
        for(int i=0;i<chars.Length;i++)if(!((chars[i]>=65&&chars[i]<=90)||(chars[i]>=97&&chars[i]<=122)||(chars[i]>=48&&chars[i]<=57)||chars[i]==95))return null;
        uint parentRef=BitConverter.ToUInt32(b,40);
        if(parentRef!=0) { if(!InImage(image,size,parentRef,4))return null;uint? pv=U32(p,parentRef);if(!pv.HasValue)return null;parent=pv.Value; }
        return Encoding.ASCII.GetString(chars);
    }
    static bool IsWinControl(IntPtr p,uint image,uint size,uint vmt) {
        var seen=new HashSet<uint>();
        for(int i=0;i<32&&vmt!=0&&seen.Add(vmt);i++) {
            uint instanceSize,parent;string name=ClassInfo(p,image,size,vmt,out instanceSize,out parent);
            if(name==null)return false;
            if(vmt-image==WinControlRva)return name=="TWinControl"&&instanceSize==0x204;
            vmt=parent;
        }
        return false;
    }
    static object Panel(IntPtr p,uint obj) {
        // Exact TXPanel only. Property names/offsets come from its published RTTI.
        var d=Map();d["borderWidth"]=U32(p,(ulong)obj+0x218);
        d["borderColor"]=Color(U32(p,(ulong)obj+0x228));d["borderColor2"]=Color(U32(p,(ulong)obj+0x22c));
        d["eraseBkgndByte"]=U8(p,(ulong)obj+0x230);d["inheritedPaintByte"]=U8(p,(ulong)obj+0x231);
        uint? custom=U32(p,(ulong)obj+0x238);d["hasCustomPaintHandler"]=custom.HasValue?(object)(custom.Value!=0):null;
        d["gradientBorderByte"]=U8(p,(ulong)obj+0x250);d["innerBorderColor"]=Color(U32(p,(ulong)obj+0x254));
        d["gradientByte"]=U8(p,(ulong)obj+0x258);d["paintBordersBits"]=U8(p,(ulong)obj+0x264);
        return d;
    }
    static object OptionForm(IntPtr p,uint image,uint size,uint obj) {
        var d=Map();uint? list=U32(p,(ulong)obj+0x35c);int? count=null;
        if(list.HasValue&&list.Value!=0) {
            uint? lvmt=U32(p,list.Value);uint bytes,parent;
            // Only TList instances are decoded; an unknown/destroying list stays null.
            if(lvmt.HasValue&&ClassInfo(p,image,size,lvmt.Value,out bytes,out parent)=="TList"&&bytes>=12) {
                uint? c=U32(p,(ulong)list.Value+8);if(c.HasValue&&c.Value<=100000)count=(int)c.Value;
            }
        }
        d["hasList35c"]=list.HasValue?(object)(list.Value!=0):null;d["list35cCount"]=count;
        // Semantics intentionally left at branch/offset level; these are not settings.
        d["compositionBranchByte3d8"]=U8(p,(ulong)obj+0x3d8);
        d["compositionPaintByte3d9"]=U8(p,(ulong)obj+0x3d9);
        d["globalCompositionGateEd3e94"]=U8(p,(ulong)image+0xED3E94);
        return d;
    }

    public static object Read(IntPtr process,uint image,IntPtr hwnd) {
        try {
            if(IntPtr.Size!=4||process==IntPtr.Zero||hwnd==IntPtr.Zero)return null;
            uint windowPid;GetWindowThreadProcessId(hwnd,out windowPid);
            if(windowPid==0||windowPid!=GetProcessId(process))return null;
            uint size=ImageSize(process,image);if(size==0)return null;
            uint anchorSize,anchorParent;
            if(ClassInfo(process,image,size,image+WinControlRva,out anchorSize,out anchorParent)!="TWinControl"||anchorSize!=0x204)return null;
            uint hwnd32=unchecked((uint)hwnd.ToInt32());
            foreach(uint atomRva in AtomRvas) {
                byte[] atomBytes=Bytes(process,(ulong)image+atomRva,2);if(atomBytes==null)continue;
                ushort atom=BitConverter.ToUInt16(atomBytes,0);if(atom<0xc000)continue;
                uint obj=unchecked((uint)GetProp(hwnd,new IntPtr(atom)).ToInt32());
                uint? vmt=U32(process,obj);if(!vmt.HasValue)continue;
                uint instanceSize,parent;string cls=ClassInfo(process,image,size,vmt.Value,out instanceSize,out parent);
                if(cls==null||instanceSize<0x204||!IsWinControl(process,image,size,vmt.Value)||U32(process,(ulong)obj+0x180)!=hwnd32)continue;
                byte[] flags=Bytes(process,(ulong)obj+0x50,12),component=Bytes(process,(ulong)obj+0x1c,2);
                if(flags==null||component==null)continue;
                var common=Map();common["componentStateBits"]=BitConverter.ToUInt16(component,0);
                common["controlStyleBits"]=Hex((uint)(flags[0]|flags[1]<<8|flags[2]<<16));
                common["controlStateBits"]=BitConverter.ToUInt16(flags,4);
                common["parentBackground"]=(flags[2]&4)!=0;common["visibleByte"]=flags[7];common["parentColorByte"]=flags[10];
                common["colorTColor"]=Color(U32(process,(ulong)obj+0x70));common["doubleBufferedByte"]=U8(process,(ulong)obj+0x1f8);
                var d=Map();uint rva=vmt.Value-image;
                d["instanceAddress"]=Hex(obj);d["vmtRva"]=Hex(rva);d["className"]=cls;d["instanceSize"]=instanceSize;
                d["propertyAtomRva"]=Hex(atomRva);d["propertyAtom"]=atom;d["common"]=common;
                d["prefillExactVmtSupported"]=rva==0x56fa20||rva==0x692008||rva==0x690898||rva==0x61db24||rva==0x9cd254;
                if(rva==0x61db24&&cls=="TXPanel"&&instanceSize==0x270)d["panel"]=Panel(process,obj);
                if(rva==0x9cd254&&cls=="TOptionForm"&&instanceSize==0x470)d["optionForm"]=OptionForm(process,image,size,obj);
                // Guard against a destroy/recreate during sampling. No snapshot is atomic.
                if(U32(process,obj)!=vmt||U32(process,(ulong)obj+0x180)!=hwnd32||
                   unchecked((uint)GetProp(hwnd,new IntPtr(atom)).ToInt32())!=obj)return null;
                return d;
            }
            return null;
        } catch { return null; }
    }
}
