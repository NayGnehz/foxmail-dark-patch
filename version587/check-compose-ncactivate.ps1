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
 $stage=Join-Path $instance.instanceRoot 'temp\version587-compose-ncactivate'
 $source=Join-Path $PSScriptRoot 'verify-compose-ncactivate.c'
 $header=Join-Path $stage 'compose-ncactivate-stub.h'
 $validation=Join-Path $stage 'validation.json'
 $libs=Join-Path $stage 'abi-import-libs'
 foreach($p in @($stage,$source,$header,$validation,$libs)){$null=Assert-PortablePlainPath $p}
 if(!(Test-Path -LiteralPath $header -PathType Leaf)){throw 'Generate compose-ncactivate-stub.h before ABI verification'}
 if(!(Test-Path -LiteralPath $validation -PathType Leaf)){throw 'Candidate validation.json is missing'}
 $candidate=(Get-Content -LiteralPath $validation -Raw|ConvertFrom-Json).candidateSHA256
 if($candidate -notmatch '^[a-fA-F0-9]{64}$'){throw 'Candidate SHA256 is missing'}
 $headerText=Get-Content -LiteralPath $header -Raw
 if($headerText -notmatch ('(?m)^\s*#define\s+FX_CANDIDATE_SHA\s+"'+[regex]::Escape($candidate)+'"\s*$')){throw 'Header candidate SHA differs from validation.json'}
 $sourceHash=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
 $headerHash=(Get-FileHash -LiteralPath $header -Algorithm SHA256).Hash
 [void][IO.Directory]::CreateDirectory($libs)
 $previous=@{}
 try {
  foreach($property in $environment.PSObject.Properties){$previous[$property.Name]=[Environment]::GetEnvironmentVariable($property.Name,'Process');[Environment]::SetEnvironmentVariable($property.Name,[string]$property.Value,'Process')}
  [void][IO.Directory]::CreateDirectory($env:TEMP)
  Push-Location -LiteralPath $stage
  try {
   function Invoke-Zig([string[]]$Arguments){& $zig @Arguments;if($LASTEXITCODE -ne 0){throw "Compose NC activation fixture Zig failed ($LASTEXITCODE)"}}
   $definitions=@{kernel32=@('VirtualAlloc@16','VirtualFree@12','FlushInstructionCache@12','ExitProcess@4');msvcrt=@('printf','fflush')}
   foreach($name in $definitions.Keys){
    $def=Join-Path $libs ($name+'.def')
    @("LIBRARY $name.dll",'EXPORTS')+$definitions[$name]|Set-Content -LiteralPath $def -Encoding Ascii
    Invoke-Zig @('dlltool','-m','i386','-k','-d',$def,'-l',(Join-Path $libs ($name+'.lib')))
   }
   $obj=Join-Path $stage 'verify-compose-ncactivate.obj'
   $exe=Join-Path $stage 'verify-compose-ncactivate.exe'
   Invoke-Zig @('cc','-target','x86-windows-msvc','-nostdinc','-nostdlib','-fms-extensions','-fno-stack-protector','-fno-builtin','-O0','-I',$stage,'-c',$source,'-o',$obj)
   Invoke-Zig @('build-exe','-target','x86-windows-msvc','-fno-compiler-rt','-fentry=FxNcActivateFixtureEntry','--subsystem','console',"-femit-bin=$exe",$obj,(Join-Path $libs 'kernel32.lib'),(Join-Path $libs 'msvcrt.lib'))
   if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $sourceHash -or (Get-FileHash -LiteralPath $header -Algorithm SHA256).Hash -ne $headerHash){throw 'Fixture inputs changed during compilation'}
   $log=Join-Path $stage 'abi-tests.log'
   [IO.File]::WriteAllText($log,'',[Text.UTF8Encoding]::new($false))
   & $exe | Add-Content -LiteralPath $log -Encoding utf8
   $fixtureExit=$LASTEXITCODE
   [pscustomobject]@{candidateSHA256=$candidate;sourceSHA256=$sourceHash;headerSHA256=$headerHash;fixtureSHA256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash;fixtureExitCode=$fixtureExit;passed=($fixtureExit -eq 0);expectedCases=2048;nestedCallsTested=$true;scope='Own allocated images only; actual emitted compose site, new stub and preserved main stub bytes, synthetic original default handler; no Foxmail execution or data access.'}|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $stage 'abi-validation.json') -Encoding utf8
   Get-Content -LiteralPath $log
   if($fixtureExit -ne 0){throw 'Actual NC activation site and stub ABI fixture failed'}
  } finally {Pop-Location}
 } finally {foreach($key in $previous.Keys){[Environment]::SetEnvironmentVariable($key,$previous[$key],'Process')}}
}


