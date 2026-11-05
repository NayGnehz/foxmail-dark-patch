[CmdletBinding()]
param([ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$')][string]$InstanceId='cleanup-01a1aba4')
$ErrorActionPreference='Stop'
$project=Get-Item -LiteralPath $PSScriptRoot
while($project -and !(Test-Path -LiteralPath (Join-Path $project.FullName 'Invoke-FoxmailPortable.ps1'))){$project=$project.Parent}
if(!$project){throw 'Foxmail portable adapter is missing'}
$base=$project.FullName
$adapter=Join-Path $base 'Invoke-FoxmailPortable.ps1'
$context=& $adapter -Action Resolve -InstanceId $InstanceId
$environment=& $adapter -Action Environment -InstanceId $InstanceId
$zig=& $adapter -Action Tool -Tool zig -InstanceId $InstanceId
$sourceGate=$PSScriptRoot
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId $InstanceId -Mode Prepare -Body {
 param($nativeContext)
 $gate=Join-Path $nativeContext.instanceRoot 'temp\native-print-native-gate'
 $libs=Join-Path $gate 'import-libs'
 $null=Assert-PortablePlainPath $gate
 $null=Assert-PortablePlainPath $libs
 [void][IO.Directory]::CreateDirectory($libs)
 $previous=@{}
 try {
  foreach($property in $environment.PSObject.Properties){$previous[$property.Name]=[Environment]::GetEnvironmentVariable($property.Name,'Process');[Environment]::SetEnvironmentVariable($property.Name,[string]$property.Value,'Process')}
  [void][IO.Directory]::CreateDirectory($env:TEMP)
  Push-Location -LiteralPath $gate
  try {
function Invoke-Zig([string[]]$Arguments) { & $zig @Arguments; if($LASTEXITCODE -ne 0){throw "zig failed ($LASTEXITCODE): $Arguments"} }
# Zig's Windows linker currently emits NO_SEH even for C objects with genuine
# compiler-generated handler3 scopes. Correct ONLY that contradictory bit in our
# two native artifacts; do not modify any Foxmail executable or emitted bridge.
$script:fxgSehAudit = @()
function Enable-NativeSeh([string]$Path) {
 $resolved = [IO.Path]::GetFullPath($Path)
 $allowed = @([IO.Path]::GetFullPath((Join-Path $gate 'FoxmailRevealGate.dll')), [IO.Path]::GetFullPath((Join-Path $gate 'verify_reveal_gate.exe')), [IO.Path]::GetFullPath((Join-Path $gate 'verify_production_dll.exe')))
 if ($resolved -notin $allowed) { throw "SEH correction target is outside the two native build outputs: $resolved" }
 $data = [IO.File]::ReadAllBytes($resolved)
 if ($data.Length -lt 128 -or [BitConverter]::ToUInt16($data,0) -ne 0x5a4d) { throw 'Invalid DOS header in native output' }
 $pe = [BitConverter]::ToInt32($data,0x3c)
 if ($pe -lt 64 -or ($pe + 24 + 224) -gt $data.Length -or [BitConverter]::ToUInt32($data,$pe) -ne 0x4550) { throw 'Invalid PE header in native output' }
 if ([BitConverter]::ToUInt16($data,$pe+4) -ne 0x14c -or [BitConverter]::ToUInt16($data,$pe+24) -ne 0x10b) { throw 'Native SEH output must be PE32/i386' }
 $field = $pe + 24 + 70
 $beforeFlags = [BitConverter]::ToUInt16($data,$field)
 $afterFlags = [uint16]($beforeFlags -band 0xfbff)
 $beforeHash = (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash
 [Array]::Copy([BitConverter]::GetBytes($afterFlags),0,$data,$field,2)
 [IO.File]::WriteAllBytes($resolved,$data)
 $verified = [IO.File]::ReadAllBytes($resolved)
 if ([BitConverter]::ToUInt16($verified,$field) -ne $afterFlags -or ($afterFlags -band 0x0400)) { throw 'Native output still rejects Windows SEH' }
 $script:fxgSehAudit += [pscustomobject]@{
  artifact=$resolved; machine='i386'; fieldOffset=$field;
  beforeDllCharacteristics=('0x{0:X4}' -f $beforeFlags); afterDllCharacteristics=('0x{0:X4}' -f $afterFlags);
  changedMask=('0x{0:X4}' -f ($beforeFlags -bxor $afterFlags));
  beforeSha256=$beforeHash; afterSha256=(Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash;
  scope='Only IMAGE_DLLCHARACTERISTICS_NO_SEH (0x0400) cleared; all other flags retained. No SafeSEH table synthesized. No Foxmail executable or bridge modified.'
 }
}
$definitions=@{
 kernel32=@('GetLastError@0','SetLastError@4','GetCurrentProcessId@0','GetCurrentThreadId@0','InterlockedCompareExchange@12','InterlockedExchange@8','InterlockedIncrement@4','GetModuleHandleW@4','RaiseException@16','ExitProcess@4','LoadLibraryExW@12','GetProcAddress@8','FreeLibrary@4')
 user32=@('IsWindow@4','IsWindowVisible@4','IsIconic@4','GetWindowThreadProcessId@8','GetClassNameW@12','GetWindowLongW@8','GetAncestor@8','GetPropW@8','SetPropW@12','RemovePropW@8','RedrawWindow@16','RegisterClassW@4','UnregisterClassW@8','CreateWindowExW@48','DefWindowProcW@16','ShowWindow@8','DestroyWindow@4')
 dwmapi=@('DwmGetWindowAttribute@16','DwmSetWindowAttribute@16')
 msvcrt=@('_except_handler3','_local_unwind2','_abnormal_termination','memcpy','memset','printf','puts','fflush')
}
foreach($name in $definitions.Keys) {
 $def=Join-Path $libs "$name.def"
 @("LIBRARY $name.dll",'EXPORTS')+$definitions[$name] | Set-Content -LiteralPath $def -Encoding Ascii
 Invoke-Zig @('dlltool','-m','i386','-k','-d',$def,'-l',(Join-Path $libs "$name.lib"))
}
$exportSource=Join-Path $libs 'exports.c'
@('#pragma comment(linker, "/export:FxPrintGateRun=_FxPrintGateRun@12")','#pragma comment(linker, "/export:FxPrintGateStats=_FxPrintGateStats,DATA")','#pragma comment(linker, "/export:FxGateRun=_FxGateRun@12")','#pragma comment(linker, "/export:FxProxyGateRun=_FxProxyGateRun@16")','#pragma comment(linker, "/export:FxSettingsGateRun=_FxSettingsGateRun@12")','#pragma comment(linker, "/export:FxGateRouteStats=_FxGateRouteStats,DATA")','#pragma comment(linker, "/export:FxGateGetStats=_FxGateGetStats@8")','#pragma comment(linker, "/export:FxGateStats=_FxGateStats,DATA")','int __stdcall _DllMainCRTStartup(void *h, unsigned long reason, void *reserved) { return 1; }') | Set-Content $exportSource -Encoding Ascii
Invoke-Zig @('cc','-target','x86-windows-msvc','-nostdinc','-nostdlib','-c',$exportSource,'-o',(Join-Path $libs 'exports.obj'))
Invoke-Zig @('cc','-target','x86-windows-msvc','-nostdinc','-nostdlib','-fms-extensions','-fexceptions','-fasync-exceptions','-O1','-c',(Join-Path $sourceGate 'foxmail_reveal_gate.c'),'-o',(Join-Path $gate 'foxmail_reveal_gate.obj'))
$libFiles=@('kernel32','user32','dwmapi','msvcrt') | ForEach-Object {Join-Path $libs "$_.lib"}
Invoke-Zig (@('build-lib','-target','x86-windows-msvc','-dynamic','-fno-compiler-rt','-fno-entry',"-femit-bin=$gate\FoxmailRevealGate.dll",(Join-Path $gate 'foxmail_reveal_gate.obj'),(Join-Path $libs 'exports.obj'))+$libFiles)

Enable-NativeSeh (Join-Path $gate 'FoxmailRevealGate.dll')
Write-Output 'Built x86 DLL with inert startup, compiler SEH allowed and no CRT initialization.'
# Fixture explicit entry calls main, flushes diagnostics, and exits with its exact status.
Invoke-Zig @('cc','-target','x86-windows-msvc','-nostdinc','-nostdlib','-fms-extensions','-fexceptions','-fasync-exceptions','-DFXG_FIXTURE','-O1','-c',(Join-Path $sourceGate 'foxmail_reveal_gate.c'),'-o',(Join-Path $gate 'foxmail_reveal_gate_fixture.obj'))
Invoke-Zig @('cc','-target','x86-windows-msvc','-nostdinc','-nostdlib','-fms-extensions','-fexceptions','-fasync-exceptions','-O1','-c',(Join-Path $sourceGate 'verify_reveal_gate.c'),'-o',(Join-Path $gate 'verify_reveal_gate.obj'))
Invoke-Zig (@('build-exe','-target','x86-windows-msvc','-fno-compiler-rt','-fentry=FxFixtureEntry','--subsystem','console',"-femit-bin=$gate\verify_reveal_gate.exe",(Join-Path $gate 'foxmail_reveal_gate_fixture.obj'),(Join-Path $gate 'verify_reveal_gate.obj'))+$libFiles)



Enable-NativeSeh (Join-Path $gate 'verify_reveal_gate.exe')
Invoke-Zig @('cc','-target','x86-windows-msvc','-nostdinc','-nostdlib','-fms-extensions','-fexceptions','-fasync-exceptions','-O1','-c',(Join-Path $sourceGate 'verify_production_dll.c'),'-o',(Join-Path $gate 'verify_production_dll.obj'))
Invoke-Zig (@('build-exe','-target','x86-windows-msvc','-fno-compiler-rt','-fentry=ProductionCheckEntry','--subsystem','console',"-femit-bin=$gate\verify_production_dll.exe",(Join-Path $gate 'verify_production_dll.obj'))+$libFiles)
Enable-NativeSeh (Join-Path $gate 'verify_production_dll.exe')
$script:fxgSehAudit | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $gate 'native-seh-header-audit.json') -Encoding utf8
Write-Output 'Built own-window fixture with explicit exit and checked native SEH metadata.'


  } finally {Pop-Location}
 } finally {foreach($key in $previous.Keys){[Environment]::SetEnvironmentVariable($key,$previous[$key],'Process')}}
 Write-Output ('Native artifacts: '+$gate)
}