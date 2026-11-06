[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$context=& (Join-Path $project 'Invoke-FoxmailPortable.ps1') -Action Resolve -InstanceId version587-20261105
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
. (Join-Path $PSScriptRoot 'adapt-fixture.ps1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId version587-20261105 -Mode Prepare -Body {
 param($instance)
 $temp=Join-Path $instance.instanceRoot 'temp'
 $stage=Join-Path $temp 'version587-reveal'
 $maps=Get-Content -LiteralPath (Join-Path $temp 'version587\native-map.json') -Raw|ConvertFrom-Json
 $relocations=@{}
 foreach($old in @(0xdcd254,0xb71e64,0xd0aeb8)){
  $entry=@($maps.vmt|Where-Object oldVA -eq $old)
  if($entry.Count -ne 1){throw 'VMT mapping is not unique'}
  $relocations[[int]($old-0x400000)]=[int]($entry[0].newVA-0x400000)
 }
 # The fixture also checks adjacent invalid VMTs, which must remain adjacent.
 foreach($old in @(0xdcd254,0xd0aeb8)){$relocations[[int]($old-0x400000+1)]=[int]($relocations[[int]($old-0x400000)]+1)}
 $legacy=Join-Path (Split-Path $instance.instanceRoot -Parent) 'cleanup-01a1aba4\temp'
 $fixture=Join-Path $stage 'verify-emitted-bridge-587.exe'
 Convert-FoxmailFixture (Join-Path $legacy 'native-compose-native-gate\verify-emitted-bridge.exe') $fixture $relocations
 & $fixture (Join-Path $stage 'Foxmail深色.exe') (Join-Path $stage 'bridge-tests.json') | Set-Content -LiteralPath (Join-Path $stage 'bridge-tests.log') -Encoding utf8
 if($LASTEXITCODE){throw 'Actual emitted bridge fixture failed'}
 $native=Join-Path $temp 'version587-native'
 $border=Join-Path $temp 'version587-borders\Foxmail深色.exe'
 & (Join-Path $legacy 'legacy-root\verify-hooks.exe') $border (Join-Path $native 'hook-spec.txt') | Set-Content -LiteralPath (Join-Path $stage 'native-api-tests.log') -Encoding utf8
 if($LASTEXITCODE){throw 'Native API fixture failed'}
 & (Join-Path $native 'verify-initial-erase-587.exe') 'D:\Users\Public\Downloads\Foxmail\Foxmail.exe' $border (Join-Path $native 'Foxmail深色.exe.json') | Set-Content -LiteralPath (Join-Path $stage 'initial-erase-tests.log') -Encoding utf8
 if($LASTEXITCODE){throw 'Initial erase fixture failed'}
 foreach($f in @('bridge-tests.log','native-api-tests.log','initial-erase-tests.log')){Get-Content -LiteralPath (Join-Path $stage $f) -Tail 2}
}
