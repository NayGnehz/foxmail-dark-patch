[CmdletBinding()]
param([ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$')][string]$InstanceId='version587-20261105')

$ErrorActionPreference = 'Stop'
$project = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$verifier = $PSCommandPath
$adapter = Join-Path $project 'Invoke-FoxmailPortable.ps1'
$context = & $adapter -Action Resolve -InstanceId $InstanceId
$environment = & $adapter -Action Environment -InstanceId $InstanceId
$zig = & $adapter -Action Tool -Tool zig -InstanceId $InstanceId
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')

Invoke-PortableInstance -ProjectId foxmail -InstanceId $InstanceId -Mode Prepare -Body {
    param($instance)
    $stage = Join-Path $instance.instanceRoot 'temp\version587-msaa-tray-guard'
    $header = Join-Path $stage 'guard-fixture.h'
    $metadata = Join-Path $stage 'build.json'
    $candidate = Join-Path $stage 'Foxmail.exe'
    $source = Join-Path $PSScriptRoot 'verify.c'
    $work = Join-Path $stage 'fixture'
    $obj = Join-Path $work 'verify.obj'
    $exe = Join-Path $work 'verify.exe'
    $report = Join-Path $stage 'abi-validation.json'
    $log = Join-Path $work 'verify.log'
    $stderr = Join-Path $work 'verify.stderr.log'
    foreach ($file in @($stage,$header,$metadata,$candidate,$source,$work,$obj,$exe,$report,$log,$stderr)) {
        $null = Assert-PortablePlainPath $file
    }
    function Hash([string]$file) { (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() }
    $plan = Get-Content -LiteralPath $metadata -Raw | ConvertFrom-Json
    $digest = Hash $candidate
    $headerText = Get-Content -LiteralPath $header -Raw
    if ($plan.candidateSHA256 -ne $digest -or $headerText -notmatch ('(?m)^#define FX_CANDIDATE_SHA "'+$digest+'"\s*$')) {
        throw 'Generated header and manifest must bind the exact candidate EXE'
    }
    $inputs = @{}
    foreach ($file in @($header,$metadata,$candidate,$source,$verifier)) { $inputs[$file] = Hash $file }
    [void][IO.Directory]::CreateDirectory($work)
    $previous = @{}
    try {
        foreach ($property in $environment.PSObject.Properties) {
            $previous[$property.Name] = [Environment]::GetEnvironmentVariable($property.Name,'Process')
            [Environment]::SetEnvironmentVariable($property.Name,[string]$property.Value,'Process')
        }
        [void][IO.Directory]::CreateDirectory($env:TEMP)
        Push-Location -LiteralPath $work
        try {
            function Invoke-Zig([string[]]$Arguments) {
                & $zig @Arguments
                if ($LASTEXITCODE -ne 0) { throw "MSAA fixture Zig failed ($LASTEXITCODE)" }
            }
            $definitions = @{
                kernel32 = @('VirtualAlloc@16','VirtualFree@12','VirtualProtect@16','VirtualQuery@12','FlushInstructionCache@12',
                    'GetModuleHandleA@4','GetProcAddress@8','GetCurrentProcess@0','GetLastError@0','SetLastError@4',
                    'GetSystemInfo@4','SetErrorMode@4','ExitProcess@4')
                msvcrt = @('printf','fflush')
            }
            foreach ($name in $definitions.Keys) {
                $def = Join-Path $work ($name+'.def')
                $lib = Join-Path $work ($name+'.lib')
                $null = Assert-PortablePlainPath $def
                $null = Assert-PortablePlainPath $lib
                @("LIBRARY $name.dll",'EXPORTS')+$definitions[$name] | Set-Content -LiteralPath $def -Encoding Ascii
                Invoke-Zig @('dlltool','-m','i386','-k','-d',$def,'-l',$lib)
            }
            Invoke-Zig @('cc','-target','x86-windows-msvc','-nostdinc','-nostdlib','-fms-extensions',
                '-fno-stack-protector','-fno-builtin','-O0','-I',$stage,'-c',$source,'-o',$obj)
            Invoke-Zig @('build-exe','-target','x86-windows-msvc','-fno-compiler-rt','-fentry=FxMsaaTrayGuardFixtureEntry',
                '--subsystem','console',"-femit-bin=$exe",$obj,(Join-Path $work 'kernel32.lib'),(Join-Path $work 'msvcrt.lib'))

            $fixtureHash = Hash $exe
            $run = Start-Process -FilePath $exe -WorkingDirectory $work -WindowStyle Hidden -PassThru -RedirectStandardOutput $log -RedirectStandardError $stderr
            try {
                if (!$run.WaitForExit(45000)) {
                    $run.Kill()
                    $run.WaitForExit()
                    throw 'Own MSAA fixture exceeded 45 seconds'
                }
                $code = $run.ExitCode
            } finally { $run.Dispose() }
            $output = Get-Content -LiteralPath $log -Raw
            Write-Output $output
            if ($code -ne 0 -or $output -notmatch '(?m)^PASS msaa tray guard: 6656 cases;') {
                Get-Content -LiteralPath $stderr
                throw "Emitted MSAA site/stub fixture failed ($code)"
            }
            foreach ($file in $inputs.Keys) {
                if ((Hash $file) -ne $inputs[$file]) { throw "MSAA fixture input changed during verification: $file" }
            }
            if ((Hash $exe) -ne $fixtureHash) { throw 'MSAA fixture executable changed during verification' }
            [ordered]@{
                passed=$true; candidateSHA256=$digest; cases=6656; imageBases=2; scenarios=26; flagPatterns=128
                fixture=$exe; fixtureSHA256=$fixtureHash; inputs=$inputs; log=$log
                scope='Actual emitted index/link sites and payload, two own allocated images, native ReadProcessMemory via instrumented kernel32 lookups. Original continuations and their Delphi cleanup are synthetic and not executed. No Foxmail process, accessibility call or business data.'
            } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $report -Encoding utf8
        } finally { Pop-Location }
    } finally {
        foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key,$previous[$key],'Process') }
    }
}
