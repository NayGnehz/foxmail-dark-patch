$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;using System.Text;using System.Collections.Generic;using System.Runtime.InteropServices;
public class BorderWindows {
 public delegate bool EnumFn(IntPtr w,IntPtr p);
 [StructLayout(LayoutKind.Sequential)]public struct RECT {public int left,top,right,bottom;}
 [DllImport("user32.dll")]static extern bool EnumChildWindows(IntPtr root,EnumFn cb,IntPtr p);
 [DllImport("user32.dll")]static extern bool EnumWindows(EnumFn cb,IntPtr p);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr w,out uint id);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetClassName(IntPtr w,StringBuilder text,int size);
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr w,out RECT r);
 [DllImport("user32.dll")]static extern int GetWindowLong(IntPtr w,int index);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr w);
 [DllImport("user32.dll")]static extern IntPtr GetParent(IntPtr w);
 public class Row {public string handle,parent,cls,style,exstyle;public int x,y,width,height;}
 static Row Read(IntPtr w){var s=new StringBuilder(256);GetClassName(w,s,256);RECT r;GetWindowRect(w,out r);return new Row{handle=w.ToInt64().ToString("X"),parent=GetParent(w).ToInt64().ToString("X"),cls=s.ToString(),style=unchecked((uint)GetWindowLong(w,-16)).ToString("X8"),exstyle=unchecked((uint)GetWindowLong(w,-20)).ToString("X8"),x=r.left,y=r.top,width=r.right-r.left,height=r.bottom-r.top};}
 public static Row[] ReadTree(IntPtr root){var rows=new List<Row>();rows.Add(Read(root));EnumChildWindows(root,(w,p)=>{if(IsWindowVisible(w))rows.Add(Read(w));return true;},IntPtr.Zero);return rows.ToArray();}
 public static IntPtr FindRoot(int pid){IntPtr best=IntPtr.Zero;long area=0;EnumWindows((w,p)=>{uint owner;GetWindowThreadProcessId(w,out owner);if(owner==pid&&IsWindowVisible(w)){RECT r;GetWindowRect(w,out r);long a=(long)(r.right-r.left)*(r.bottom-r.top);if(a>area){best=w;area=a;}}return true;},IntPtr.Zero);return best;}
}
'@
$copyProcess=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'Foxmail深色.exe' -and $_.ExecutablePath -eq 'D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe' } | ForEach-Object { Get-Process -Id $_.ProcessId } | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if(!$copyProcess){throw 'No running copy window'}
$visibleRoot=[BorderWindows]::FindRoot($copyProcess.Id)
if($visibleRoot -eq [IntPtr]::Zero){throw 'No visible copy window'}
[BorderWindows]::ReadTree($visibleRoot) | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'window-borders.json') -Encoding UTF8
[BorderWindows]::ReadTree($visibleRoot) | Select-Object cls,style,exstyle,x,y,width,height | Format-Table -AutoSize
