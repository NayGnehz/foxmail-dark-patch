[CmdletBinding()]
param([ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$')][string]$InstanceId='version587-20261105')
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$adapter=Join-Path $project 'Invoke-FoxmailPortable.ps1'
$context=& $adapter -Action Resolve -InstanceId $InstanceId
$environment=& $adapter -Action Environment -InstanceId $InstanceId
$zig=& $adapter -Action Tool -Tool zig -InstanceId $InstanceId
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId $InstanceId -Mode Prepare -Body {
 param($instance)
 $sourceGate=Join-Path $instance.instanceRoot 'temp\version587-compose-ready-source'
 $stage=Join-Path $instance.instanceRoot 'temp\version587-compose-ready'
 $source=Join-Path $sourceGate 'foxmail_reveal_gate.c'
 $fixture=Join-Path $PSScriptRoot 'verify-compose-ready.c'
 $asyncHeader=Join-Path $PSScriptRoot 'compose-ready-async.h'
 $apiHeader=Join-Path $PSScriptRoot 'compose-ready-api.h'
 $libs=Join-Path $stage 'import-libs'
 foreach($p in @($sourceGate,$stage,$source,$fixture,$asyncHeader,$libs)){$null=Assert-PortablePlainPath $p}
 [void][IO.Directory]::CreateDirectory($libs)
 function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
 $sourceHashes=@{}
 foreach($p in @($source,$fixture,$asyncHeader,$apiHeader,(Join-Path $PSScriptRoot 'check-compose-ready.ps1'),(Join-Path $sourceGate 'foxmail_reveal_gate.h'),(Join-Path $stage 'source-audit.json'))){$sourceHashes[$p]=Hash $p}
 $map=Get-Content -LiteralPath (Join-Path $instance.instanceRoot 'temp\version587-goal\canvas-map.json') -Raw|ConvertFrom-Json
 $apiText=Get-Content -LiteralPath $apiHeader -Raw
 $expectedAtoms=@(0xEFA1B6,0xEFA1B4,0xEF6B80,0xEF6B7E)
 for($i=0;$i -lt 4;$i++){
  $match=[regex]::Match($apiText,('(?m)^#define FX_READY_ATOM'+($i+1)+'_RVA 0x([a-fA-F0-9]+)UL\s*$'))
  if(!$match.Success -or [Convert]::ToUInt32($match.Groups[1].Value,16) -ne $expectedAtoms[$i] -or $map.atoms[$i].newRVA -ne $expectedAtoms[$i]){throw 'Native snapshot atom RVA disagrees with independently mapped 587 metadata'}
 }
 $vmts=@(@('EDITOR','TFoxHTMLEditor',0xB94A54),@('EDITOR_BASE','TFoxHTMLEditorBase',0xB83AC4),@('HOST','TCEFWindowParent',0xB6716C))
 foreach($entry in $vmts){
  $match=[regex]::Match($apiText,('(?m)^#define FX_READY_'+$entry[0]+'_VMT_RVA \(0x([a-fA-F0-9]+)UL-0x400000UL\)\s*$'))
  $mapped=@($map.vmt|Where-Object {$_.className -eq $entry[1]})
  if(!$match.Success -or [Convert]::ToUInt32($match.Groups[1].Value,16) -ne $entry[2] -or $mapped.Count -ne 1 -or $mapped[0].newVA -ne $entry[2]){throw 'Native snapshot VMT disagrees with independently mapped 587 metadata'}
 }
 $previous=@{}
 try {
  foreach($property in $environment.PSObject.Properties){$previous[$property.Name]=[Environment]::GetEnvironmentVariable($property.Name,'Process');[Environment]::SetEnvironmentVariable($property.Name,[string]$property.Value,'Process')}
  [void][IO.Directory]::CreateDirectory($env:TEMP)
  Push-Location -LiteralPath $stage
  try {
   function Zig([string[]]$Arguments){& $zig @Arguments;if($LASTEXITCODE -ne 0){throw "Async fixture Zig failed ($LASTEXITCODE)"}}
   $definitions=@{
    kernel32=@('GetLastError@0','SetLastError@4','GetCurrentProcessId@0','GetCurrentThreadId@0','InterlockedCompareExchange@12','InterlockedExchange@8','InterlockedIncrement@4','GetModuleHandleW@4','GetModuleHandleExW@12','GetModuleFileNameW@12','GetTickCount@0','Sleep@4','RaiseException@16','ExitProcess@4','LoadLibraryExW@12','GetProcAddress@8','FreeLibrary@4','CreateThread@24','WaitForSingleObject@8','CloseHandle@4','VirtualAlloc@16','VirtualFree@12','GlobalAddAtomW@4','GlobalDeleteAtom@4')
    user32=@('IsWindow@4','IsWindowVisible@4','IsIconic@4','GetWindowThreadProcessId@8','GetClassNameW@12','GetWindowLongW@8','GetAncestor@8','GetPropW@8','SetPropW@12','RemovePropW@8','RedrawWindow@16','RegisterClassW@4','UnregisterClassW@8','CreateWindowExW@48','DefWindowProcW@16','ShowWindow@8','DestroyWindow@4','GetClientRect@8','GetWindowRect@8','GetParent@4','EnumChildWindows@12','FindWindowExW@16','IsChild@8','SendMessageW@16','PostMessageW@16','RegisterWindowMessageW@4','SetTimer@16','KillTimer@8','PeekMessageW@20','TranslateMessage@4','DispatchMessageW@4')
    dwmapi=@('DwmGetWindowAttribute@16','DwmSetWindowAttribute@16')
    comctl32=@('SetWindowSubclass@16','RemoveWindowSubclass@12','DefSubclassProc@16')
    msvcrt=@('_except_handler3','_local_unwind2','_abnormal_termination','memcpy','memset','printf','puts','fflush')
   }
   foreach($name in $definitions.Keys){$def=Join-Path $libs ($name+'.def');@("LIBRARY $name.dll",'EXPORTS')+$definitions[$name]|Set-Content -LiteralPath $def -Encoding Ascii;Zig @('dlltool','-m','i386','-k','-d',$def,'-l',(Join-Path $libs ($name+'.lib')))}
   $export=Join-Path $libs 'exports.c'
   $exports=@('FxGateRun@12','FxProxyGateRun@16','FxSettingsGateRun@12','FxPrintGateRun@12','FxComposeGateRun@12','FxColdRun@12','FxGateGetStats@8')|ForEach-Object{$n=$_.Split('@')[0];'#pragma comment(linker, "/export:'+ $n+'=_'+$_+'")'}
   $exports+=@('FxGateStats','FxGateRouteStats','FxPrintGateStats','FxComposeGateStats')|ForEach-Object{'#pragma comment(linker, "/export:'+$_+'=_'+$_+',DATA")'}
   $exports+='int __stdcall _DllMainCRTStartup(void *h,unsigned long r,void *p){return 1;}'
   $exports|Set-Content -LiteralPath $export -Encoding Ascii
   $common=@('cc','-target','x86-windows-msvc','-nostdinc','-nostdlib','-fms-extensions','-fexceptions','-fasync-exceptions','-fno-stack-protector','-O1','-I',$sourceGate,'-I',$PSScriptRoot)
   Zig ($common+@('-c',$export,'-o',(Join-Path $libs 'exports.obj')))
   Zig ($common+@('-c',$source,'-o',(Join-Path $stage 'helper.obj')))
   $libraryFiles=@('kernel32','user32','dwmapi','comctl32','msvcrt')|ForEach-Object{Join-Path $libs ($_.ToString()+'.lib')}
   $dll=Join-Path $stage 'FoxmailRevealGate.dll'
   Zig (@('build-lib','-target','x86-windows-msvc','-dynamic','-fno-compiler-rt','-fno-entry',"-femit-bin=$dll",(Join-Path $stage 'helper.obj'),(Join-Path $libs 'exports.obj'))+$libraryFiles)
   Zig ($common+@('-DFXG_FIXTURE','-c',$source,'-o',(Join-Path $stage 'helper-fixture.obj')))
   $artifacts=@($dll);$exes=@()
   foreach($mode in @('fixture','production')){
    $define=if($mode -eq 'fixture'){'-DFXG_FIXTURE'}else{'-DFXG_PRODUCTION'}
    $obj=Join-Path $stage ('verify-'+$mode+'.obj');$exe=Join-Path $stage ('verify-'+$mode+'.exe')
    Zig ($common+@($define,'-c',$fixture,'-o',$obj))
    $objects=@($obj);if($mode -eq 'fixture'){$objects+=(Join-Path $stage 'helper-fixture.obj')}
    Zig (@('build-exe','-target','x86-windows-msvc','-fno-compiler-rt','-fentry=FxReadyFixtureEntry','--subsystem','console',"-femit-bin=$exe")+$objects+$libraryFiles)
    $artifacts+=$exe;$exes+=$exe
   }
   $seh=@()
   foreach($p in $artifacts){
    $data=[IO.File]::ReadAllBytes($p);$pe=[BitConverter]::ToInt32($data,0x3c)
    if($data.Length -lt 128 -or [BitConverter]::ToUInt16($data,0) -ne 0x5a4d -or [BitConverter]::ToUInt32($data,$pe) -ne 0x4550 -or [BitConverter]::ToUInt16($data,$pe+4) -ne 0x14c -or [BitConverter]::ToUInt16($data,$pe+24) -ne 0x10b){throw 'SEH header target must be own valid PE32 artifact'}
    $at=$pe+24+70;$before=[BitConverter]::ToUInt16($data,$at);$after=[uint16]($before -band 0xfbff)
    [Array]::Copy([BitConverter]::GetBytes($after),0,$data,$at,2);[IO.File]::WriteAllBytes($p,$data)
    $seh+=@{artifact=$p;changedMask=($before -bxor $after);noSehCleared=$true}
   }
   foreach($p in $sourceHashes.Keys){if((Hash $p) -ne $sourceHashes[$p]){throw 'Async source changed during build'}}
   $runs=@()
   foreach($exe in $exes){
    $log=$exe+'.log';$err=$exe+'.stderr.log'
    $run=Start-Process -FilePath $exe -WorkingDirectory $stage -WindowStyle Hidden -PassThru -RedirectStandardOutput $log -RedirectStandardError $err
    if(!$run.WaitForExit(45000)){$run.Kill();$run.WaitForExit();throw 'Own fixture exceeded 45 second limit'}
    $code=$run.ExitCode;$runs+=@{file=$exe;sha256=(Hash $exe);exitCode=$code;log=$log}
    Get-Content -LiteralPath $log
    if($code -ne 0){Get-Content -LiteralPath $err;throw "Async fixture failed: $code"}
   }
   $report=@{passed=$true;sourceHashes=$sourceHashes;dll=$dll;dllSHA256=(Hash $dll);runs=$runs;sehAudit=$seh;productionSnapshotAndSurfaceTested=$true;exceptionUnwindTested=$true;atomMapVerified=$true;vmtMapVerified=$true;scope='Own process native windows and synthetic objects only; seam fault tests and separately loaded production DLL. No Foxmail process/data access.'}
   $report|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $stage 'native-validation.json') -Encoding utf8
  }finally{Pop-Location}
 }finally{foreach($key in $previous.Keys){[Environment]::SetEnvironmentVariable($key,$previous[$key],'Process')}}
}
