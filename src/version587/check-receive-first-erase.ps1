[CmdletBinding()]
param([string]$InstanceId='version587-20261105')
$ErrorActionPreference='Stop'
$adapter=Join-Path (Split-Path $PSScriptRoot -Parent) 'Invoke-FoxmailPortable.ps1'
$context=& $adapter -Action Resolve -InstanceId $InstanceId
$environment=& $adapter -Action Environment -InstanceId $InstanceId
$zig=& $adapter -Action Tool -Tool zig -InstanceId $InstanceId
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId $InstanceId -Mode Prepare -Body {
 param($instance)
 function Hash([string]$file){$null=Assert-PortablePlainPath $file;(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()}
 $stage=Join-Path $instance.instanceRoot 'temp\version587-receive-first-erase'
 $source=Join-Path $PSScriptRoot 'verify-receive-first-erase.c'
 $generator=Join-Path $PSScriptRoot 'receive-first-erase.cjs'
 $validationFile=Join-Path $stage 'validation.json';$header=Join-Path $stage 'receive-erase-fixture.h';$candidate=Join-Path $stage 'Foxmail.exe'
 $report=Get-Content -LiteralPath $validationFile -Raw | ConvertFrom-Json
 $bindings=@{};foreach($file in @($source,$generator,$validationFile,$header,$candidate)){$bindings[$file]=Hash $file}
 if($bindings[$generator] -ne $report.generatorSHA256 -or $bindings[$candidate] -ne $report.candidateSHA256 -or $bindings[$header] -ne $report.fixtureHeaderSHA256 -or !$report.otherPropertiesAndResourcesUnchanged -or !$report.reverseRestoresExactInput){throw 'Receive erase fixture binding failed'}
 $previous=@{}
 try{
  foreach($property in $environment.PSObject.Properties){$previous[$property.Name]=[Environment]::GetEnvironmentVariable($property.Name,'Process');[Environment]::SetEnvironmentVariable($property.Name,[string]$property.Value,'Process')}
  $libs=Assert-PortablePlainPath (Join-Path $stage 'fixture-import-libs');[void][IO.Directory]::CreateDirectory($libs)
  Push-Location -LiteralPath $stage
  try{
   function Zig([string[]]$arguments){& $zig @arguments;if($LASTEXITCODE){throw ('Receive erase Zig failed '+$LASTEXITCODE)}}
   $imports=@{
    kernel32=@('VirtualAlloc@16','VirtualFree@12','FlushInstructionCache@12','GetLastError@0','SetLastError@4','ExitProcess@4')
    user32=@('FillRect@12')
    gdi32=@('CreateCompatibleDC@4','CreateDIBSection@24','CreateBitmap@20','SelectObject@8','DeleteObject@4','DeleteDC@4','GdiFlush@0','CreateSolidBrush@4','GetCurrentObject@8','GetObjectA@12','GetObjectType@4','GetDeviceCaps@8','GetMapMode@4','GetROP2@4','GetGraphicsMode@4','GetLayout@4','GetBkMode@4','GetTextColor@4','GetBkColor@4','SetMapMode@8','SetROP2@8','SetGraphicsMode@8','SetLayout@8','SetBkMode@8','PatBlt@24','GetPixel@12','CreateRectRgn@16','CombineRgn@16','SelectClipRgn@8','GetClipBox@8','GetCurrentPositionEx@8','MoveToEx@16')
    msvcrt=@('printf','fflush','memcpy')
   }
   foreach($name in $imports.Keys){$def=Join-Path $libs ($name+'.def');@("LIBRARY $name.dll",'EXPORTS')+$imports[$name] | Set-Content -LiteralPath $def -Encoding Ascii;Zig @('dlltool','-m','i386','-k','-d',$def,'-l',(Join-Path $libs ($name+'.lib')))}
   $object=Join-Path $stage 'verify-receive-first-erase.obj';$fixture=Join-Path $stage 'verify-receive-first-erase.exe'
   Zig @('cc','-target','x86-windows-msvc','-nostdinc','-nostdlib','-fms-extensions','-fno-stack-protector','-fno-builtin','-O0','-I',$stage,'-c',$source,'-o',$object)
   $args=@('build-exe','-target','x86-windows-msvc','-fno-compiler-rt','-fentry=FxReceiveEraseFixtureEntry','--subsystem','console',"-femit-bin=$fixture",$object)
   foreach($name in @('kernel32','user32','gdi32','msvcrt')){$args+=Join-Path $libs ($name+'.lib')}
   Zig $args
   foreach($file in $bindings.Keys){if((Hash $file) -ne $bindings[$file]){throw 'Fixture inputs changed during compilation'}}
   $output=& $fixture;$output
   if($LASTEXITCODE -or $output -ne "PASS receive first erase: 1244 cases; candidate=$($report.candidateSHA256)"){throw 'Emitted receive erase fixture failed'}
   @{passed=$true;cases=1244;imageBases=2;oldCandidateDemonstratesMissingFill=$true;candidateSHA256=$report.candidateSHA256;inputs=$bindings;fixtureSHA256=Hash $fixture;scope='Actual entry, prefill and selector with a synthetic VCL continuation. Real memory DC/DIB pixels and state; synthetic dialog objects only.'} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stage 'abi-validation.json') -Encoding utf8
  }finally{Pop-Location}
 }finally{foreach($name in $previous.Keys){[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')}}
}
