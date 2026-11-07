param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[a-f0-9]{64}$')]
    [string]$CandidateSHA256
)

$ErrorActionPreference = 'Stop'
$app = 'C:\FoxmailGuardTest'
$inputRoot = 'C:\FoxmailGuestInput'
$toolsRoot = 'C:\FoxmailGuestTools'
$source = Join-Path $inputRoot 'Foxmail'
$entry = Join-Path $source 'Foxmail-Dark-Patch.cmd'
$toolsProbe = Join-Path $toolsRoot 'guest-start.ps1'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
try {
    if ($identity.Name -ne ([Environment]::MachineName + '\WDAGUtilityAccount')) {
        throw 'Run the prepared Windows Sandbox configuration'
    }
} finally { $identity.Dispose() }
if (Test-Path -LiteralPath $app) { throw 'Start a fresh Windows Sandbox session' }

# Opening for write without changing bytes must fail on both readonly mappings.
foreach ($probe in @($entry, $toolsProbe)) {
    if (!(Test-Path -LiteralPath $probe -PathType Leaf)) { throw ('Missing guest input ' + $probe) }
    try {
        $stream = [IO.File]::Open($probe, [IO.FileMode]::Open, [IO.FileAccess]::Write, [IO.FileShare]::ReadWrite)
    } catch [UnauthorizedAccessException] {
        continue
    } catch [IO.IOException] {
        if ($_.Exception.GetBaseException().HResult -eq -2147024877) { continue }  # ERROR_WRITE_PROTECT
        throw
    }
    $stream.Dispose()
    throw ('Guest input must be mapped read-only ' + $probe)
}

Copy-Item -LiteralPath $source -Destination $app -Recurse
& (Join-Path $app 'Foxmail-Dark-Patch.cmd') apply
if ($LASTEXITCODE) { throw ('Guard CMD installation failed ' + $LASTEXITCODE) }
$foxmailExe = Join-Path $app 'Foxmail.exe'
if ((Get-FileHash -LiteralPath $foxmailExe -Algorithm SHA256).Hash -ne $CandidateSHA256) {
    throw 'Unexpected guarded Foxmail executable'
}
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $bytes = [byte[]]::new(32)
    $rng.GetBytes($bytes)
} finally { $rng.Dispose() }
$guestProof = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $app '.sandbox-proof'), $guestProof, [Text.Encoding]::ASCII)

$mailScript = Join-Path $toolsRoot 'guest-mail.ps1'
$listScript = Join-Path $toolsRoot 'guest-list.ps1'
$mailCommand = '-NoLogo -NoProfile -NonInteractive -Command "& ([scriptblock]::Create([IO.File]::ReadAllText(''' + $mailScript + '''))) -DurationSeconds 3600"'
$mailOut = Join-Path $app 'guest-mail.log'
$mailError = Join-Path $app 'guest-mail.err'
$mailProcess = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $mailCommand -WindowStyle Hidden -PassThru -RedirectStandardOutput $mailOut -RedirectStandardError $mailError
$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if ($mailProcess.HasExited) { break }
    if ((Get-Content -LiteralPath $mailOut -Raw -ErrorAction SilentlyContinue) -match '(?m)^READY POP3 127\.0\.0\.1:21110 SMTP 127\.0\.0\.1:21587\r?$') {
        $ready = $true
        break
    }
    Start-Sleep -Milliseconds 250
}
if (!$ready) {
    if (!$mailProcess.HasExited) { $mailProcess.Kill() }
    Get-Content -LiteralPath $mailError -ErrorAction SilentlyContinue | Write-Host
    throw 'Synthetic mail server did not start'
}

$candidate = Start-Process -FilePath $foxmailExe -WorkingDirectory $app -WindowStyle Normal -PassThru

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class FoxmailGuestWindow {
    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
}
'@

function Confirm-GuardMailList {
    if ($candidate.HasExited) { throw 'The guest Foxmail process exited' }
    $probeName = 'guest-list-' + [Guid]::NewGuid().ToString('N')
    $out = Join-Path $app ($probeName + '.json')
    $err = Join-Path $app ($probeName + '.err')
    $command = '-NoLogo -NoProfile -NonInteractive -Command "& ([scriptblock]::Create([IO.File]::ReadAllText(''' + $listScript + '''))) -GuestProof ' + $guestProof + ' -CandidatePid ' + $candidate.Id + ' -CandidateSHA256 ' + $CandidateSHA256 + '"'
    $probe = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $command -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
    try {
        if (!$probe.WaitForExit(30000)) {
            $probe.Kill()
            $probe.WaitForExit()
            throw 'The isolated list probe timed out'
        }
        if ($probe.ExitCode -ne 0) {
            Get-Content -LiteralPath $err -ErrorAction SilentlyContinue | Write-Host
            throw 'The isolated list probe failed'
        }
        $json = Get-Content -LiteralPath $out -Raw
        $result = $json | ConvertFrom-Json
        Write-Output $json
        if (!$result.passed -or $result.candidatePid -ne $candidate.Id -or
            $result.candidateSHA256 -ne $CandidateSHA256 -or $result.syntheticSubjectsRecovered -ne 3) {
            throw 'The isolated list did not expose all three synthetic subjects'
        }
    } finally { $probe.Dispose() }
}

function Measure-GuardTray {
    param(
        [ValidateRange(1, 10)][int]$Cycles = 3,
        [ValidateRange(10, 90)][int]$Seconds = 45
    )

    $candidate.Refresh()
    if ($candidate.HasExited -or $candidate.MainWindowHandle -eq [IntPtr]::Zero) {
        throw 'Show the synthetic Inbox before starting the tray measurement'
    }
    $window = $candidate.MainWindowHandle
    function Wait-WindowVisibility([bool]$Visible) {
        $watch = [Diagnostics.Stopwatch]::StartNew()
        while ($watch.Elapsed.TotalSeconds -lt $Seconds) {
            if ($candidate.HasExited -or ![FoxmailGuestWindow]::IsWindow($window)) {
                throw 'The guest Foxmail process or original main window exited'
            }
            [uint32]$windowPid = 0
            [void][FoxmailGuestWindow]::GetWindowThreadProcessId($window, [ref]$windowPid)
            if ($windowPid -ne $candidate.Id) { throw 'The guest main window changed ownership' }
            $shown = [FoxmailGuestWindow]::IsWindowVisible($window)
            if ($shown -eq $Visible -and (!$Visible -or ![FoxmailGuestWindow]::IsIconic($window))) { return }
            Start-Sleep -Milliseconds 150
        }
        throw ('The expected guest window visibility was not observed ' + $Visible)
    }

    Wait-WindowVisibility $true
    Confirm-GuardMailList
    for ($cycle = 1; $cycle -le $Cycles; $cycle++) {
        Write-Host ('Cycle ' + $cycle + ' close the Foxmail main window to the notification area')
        Wait-WindowVisibility $false
        Write-Host 'Click the Foxmail notification area icon to restore the same window'
        Wait-WindowVisibility $true
        Confirm-GuardMailList
    }
    [ordered]@{
        trayCycles = $Cycles
        candidatePid = $candidate.Id
        candidateSHA256 = $CandidateSHA256
        processSurvived = !$candidate.HasExited
    } | ConvertTo-Json -Compress
}

Write-Host 'Create a POP3 account with these synthetic settings'
Write-Host 'Email guard@example.invalid, user guard, password fixture-only'
Write-Host 'Incoming 127.0.0.1 port 21110, outgoing 127.0.0.1 port 21587, both without SSL'
Write-Host 'Open Inbox and fetch the three test messages, then run Confirm-GuardMailList'
Write-Host 'Run Measure-GuardTray to observe three hide and restore cycles on the same window'
