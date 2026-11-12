[CmdletBinding()]
param([ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$')][string]$InstanceId = 'version587-20261105',
    [ValidateSet('version587-compose-recipient-contrast','version587-compose-recipient-msaa')][string]$OutputGroup = 'version587-compose-recipient-contrast')

$ErrorActionPreference = 'Stop'
$adapter = Join-Path (Split-Path $PSScriptRoot -Parent) 'Invoke-FoxmailPortable.ps1'
$context = & $adapter -Action Resolve -InstanceId $InstanceId
$environment = & $adapter -Action Environment -InstanceId $InstanceId
$zig = & $adapter -Action Tool -Tool zig -InstanceId $InstanceId
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')

Invoke-PortableInstance -ProjectId foxmail -InstanceId $InstanceId -Mode Prepare -Body {
    param($instance)
    function Hash([string]$file) {
        $null = Assert-PortablePlainPath $file
        (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    }

    $stage = Join-Path $instance.instanceRoot ('temp\' + $OutputGroup)
    $generator = Join-Path $PSScriptRoot 'compose-recipient-contrast.cjs'
    $source = Join-Path $PSScriptRoot 'verify-compose-recipient-contrast.c'
    $validationFile = Join-Path $stage 'validation.json'
    $header = Join-Path $stage 'recipient-contrast-fixture.h'
    $candidate = Join-Path $stage 'Foxmail深色.exe'
    $fixtureSourceSHA256 = Hash $source
    $validationSHA256 = Hash $validationFile
    $validation = Get-Content -LiteralPath $validationFile -Raw | ConvertFrom-Json
    $generatorSHA256 = Hash $generator
    if ($validation.generatorSHA256 -ne $generatorSHA256 -or
        (Hash $candidate) -ne $validation.candidateSHA256 -or
        (Hash $header) -ne $validation.fixtureHeaderSHA256 -or !$validation.reverseRestoresExactInput) {
        throw 'Compose recipient candidate or fixture inputs changed'
    }
    $libs = Assert-PortablePlainPath (Join-Path $stage 'abi-import-libs')
    [void][IO.Directory]::CreateDirectory($libs)
    $previous = @{}
    try {
        foreach ($property in $environment.PSObject.Properties) {
            $previous[$property.Name] = [Environment]::GetEnvironmentVariable($property.Name, 'Process')
            [Environment]::SetEnvironmentVariable($property.Name, [string]$property.Value, 'Process')
        }
        [void][IO.Directory]::CreateDirectory($env:TEMP)
        Push-Location -LiteralPath $stage
        try {
            function Invoke-Zig([string[]]$arguments) {
                & $zig @arguments
                if ($LASTEXITCODE -ne 0) { throw "Recipient fixture Zig failed ($LASTEXITCODE)" }
            }
            $imports = @{
                kernel32 = @('VirtualAlloc@16', 'VirtualFree@12', 'FlushInstructionCache@12', 'ExitProcess@4')
                msvcrt = @('printf', 'fflush')
            }
            foreach ($name in $imports.Keys) {
                $def = Join-Path $libs ($name + '.def')
                @("LIBRARY $name.dll", 'EXPORTS') + $imports[$name] | Set-Content -LiteralPath $def -Encoding Ascii
                Invoke-Zig @('dlltool', '-m', 'i386', '-k', '-d', $def, '-l', (Join-Path $libs ($name + '.lib')))
            }
            $object = Join-Path $stage 'verify-compose-recipient-contrast.obj'
            $fixture = Join-Path $stage 'verify-compose-recipient-contrast.exe'
            Invoke-Zig @('cc', '-target', 'x86-windows-msvc', '-nostdinc', '-nostdlib', '-fms-extensions',
                '-fno-stack-protector', '-fno-builtin', '-O0', '-I', $stage, '-c', $source, '-o', $object)
            Invoke-Zig @('build-exe', '-target', 'x86-windows-msvc', '-fno-compiler-rt', '-fentry=FxRecipientFixtureEntry',
                '--subsystem', 'console', "-femit-bin=$fixture", $object, (Join-Path $libs 'kernel32.lib'), (Join-Path $libs 'msvcrt.lib'))
            if ((Hash $source) -ne $fixtureSourceSHA256 -or (Hash $header) -ne $validation.fixtureHeaderSHA256 -or
                (Hash $validationFile) -ne $validationSHA256 -or (Hash $candidate) -ne $validation.candidateSHA256 -or
                (Hash $generator) -ne $generatorSHA256) {
                throw 'Compose recipient fixture inputs changed during compilation'
            }
            $output = & $fixture
            $output
            if ($LASTEXITCODE -ne 0 -or $output -ne "PASS compose recipient ABI: 1280 cases; candidate=$($validation.candidateSHA256)") {
                throw 'Actual emitted compose recipient ABI fixture failed'
            }
            [pscustomobject]@{
                passed = $true
                cases = 1280
                candidateSHA256 = $validation.candidateSHA256
                fixtureSHA256 = Hash $fixture
                fixtureSourceSHA256 = $fixtureSourceSHA256
                generatorSHA256 = $generatorSHA256
                validationSHA256 = $validationSHA256
                scope = 'Five actual call sites and wrapper, two x86 image bases. Synthetic native callees only.'
            } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stage 'abi-validation.json') -Encoding utf8
        } finally {
            Pop-Location
        }
    } finally {
        foreach ($key in $previous.Keys) {
            [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process')
        }
    }
}
