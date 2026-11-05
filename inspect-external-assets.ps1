$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
public static class AssetColors {
 public static object[] Inspect(string path) {
  using(var b=new Bitmap(path)) {
   long visible=0,bright=0; int step=Math.Max(1,(int)Math.Sqrt((double)b.Width*b.Height/400000));
   for(int y=0;y<b.Height;y+=step)for(int x=0;x<b.Width;x+=step){var c=b.GetPixel(x,y);if(c.A<200 || (c.R>200&&c.B>200&&c.G<100))continue;visible++;int low=Math.Min(c.R,Math.Min(c.G,c.B)),high=Math.Max(c.R,Math.Max(c.G,c.B));if(low>=180&&high-low<=70)bright++;}
   return new object[]{b.Width,b.Height,visible,bright,visible>0?(double)bright/visible:0};
  }
 }
}
'@
$base = 'D:\Users\Public\Downloads\Foxmail\7.2.25.563'
$rows = @()
foreach ($dir in @('Skin','PngImages')) {
 foreach($file in Get-ChildItem -LiteralPath (Join-Path $base $dir) -Recurse -File) {
  if($file.Extension -notmatch '^\.(png|bmp|jpg|jpeg|gif)$'){continue}
  try {
   $s=[AssetColors]::Inspect($file.FullName)
   $rows += [pscustomobject]@{path=$file.FullName;relative=$file.FullName.Substring($base.Length+1);width=$s[0];height=$s[1];visible=$s[2];bright=$s[3];brightRatio=[math]::Round($s[4],3);sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLower()}
  }catch { $rows += [pscustomobject]@{path=$file.FullName;error=$_.Exception.Message} }
 }
}
$rows | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'resource-inventory\external-assets.json') -Encoding UTF8
Write-Output ('Images: '+$rows.Count)
$rows | Where-Object {$_.relative -like 'Skin\Controls\*' -and $_.brightRatio -gt 0.5} | Select-Object relative,width,height,brightRatio | Format-Table -AutoSize
