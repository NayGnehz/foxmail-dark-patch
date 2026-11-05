$ErrorActionPreference = 'Stop'
$compiler = 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
Push-Location $PSScriptRoot
try {
    & $compiler /nologo /platform:x86 /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll /out:ComposeFrames.exe ComposeFrames.cs
    if ($LASTEXITCODE -ne 0) { throw 'Recorder compilation failed' }
    & '.\ComposeFrames.exe' --self-test
    if ($LASTEXITCODE -ne 0) { throw 'Recorder self-test failed' }
} finally { Pop-Location }
