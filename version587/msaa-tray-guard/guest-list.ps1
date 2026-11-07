#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('(?-i)\A[0-9a-f]{64}\z')][string]$GuestProof,
    [Parameter(Mandatory)][ValidateRange(1,2147483647)][int]$CandidatePid,
    [Parameter(Mandatory)][ValidatePattern('(?-i)\A[0-9a-f]{64}\z')][string]$CandidateSHA256
)

$ErrorActionPreference = 'Stop'
$root = 'C:\FoxmailGuardTest'
$proof = Join-Path $root '.sandbox-proof'
$exe = Join-Path $root 'Foxmail.exe'
$comparison = [StringComparison]::OrdinalIgnoreCase

function Assert-PlainItem([string]$Path, [bool]$Directory) {
    $item = Get-Item -LiteralPath $Path -Force
    if (!$item.FullName.Equals($Path, $comparison) -or
        $item.PSIsContainer -ne $Directory -or
        ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Guest test path must be an exact local path without reparse points'
    }
    return $item
}

# The sandbox LogonCommand creates the random marker inside the clean guest.
# The host-side mapped input directory and the production installation are
# outside this script's fixed local path model.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
try {
    $expectedIdentity = [Environment]::MachineName + '\WDAGUtilityAccount'
    if (!$identity.Name.Equals($expectedIdentity, $comparison) -or
        ![Environment]::UserName.Equals('WDAGUtilityAccount', $comparison) -or
        ([IO.DriveInfo]::new('C')).DriveType -ne [IO.DriveType]::Fixed) {
        throw 'Run this check only in the isolated Windows Sandbox guest'
    }
} finally { $identity.Dispose() }
$null = Assert-PlainItem 'C:\' $true
$null = Assert-PlainItem $root $true
$proofFile = Assert-PlainItem $proof $false
if ($proofFile.Length -ne 64 -or [IO.File]::ReadAllText($proof, [Text.Encoding]::ASCII) -cne $GuestProof) {
    throw 'Guest isolation proof mismatch'
}
$null = Assert-PlainItem $exe $false

$process = [Diagnostics.Process]::GetProcessById($CandidatePid)
$image = $null
try {
    $null = $process.Handle
    $startTime = $process.StartTime.ToFileTimeUtc()
    if ($process.HasExited -or !$process.MainModule.FileName.Equals($exe, $comparison)) {
        throw 'Candidate process path mismatch'
    }
    # Keep the verified image open without permitting writes or replacement
    # until the probes finish.
    $image = [IO.File]::Open($exe, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $digest = [BitConverter]::ToString($sha.ComputeHash($image)).Replace('-', '').ToLowerInvariant()
    } finally { $sha.Dispose() }
    if ($digest -cne $CandidateSHA256) { throw 'Candidate executable SHA256 mismatch' }

    function Test-CandidateAlive {
        $process.Refresh()
        return !$process.HasExited -and $process.StartTime.ToFileTimeUtc() -eq $startTime
    }

    if (!('FoxmailGuardGuest.ListWindow' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

namespace FoxmailGuardGuest {
    public static class ListWindow {
        private delegate bool EnumChild(IntPtr hwnd, IntPtr parameter);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetClassName(IntPtr hwnd, StringBuilder name, int size);
        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hwnd);
        [DllImport("user32.dll")]
        private static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
        [DllImport("user32.dll")]
        private static extern bool EnumChildWindows(IntPtr hwnd, EnumChild callback, IntPtr parameter);

        private static bool Owned(IntPtr hwnd, uint expected) {
            uint actual;
            return GetWindowThreadProcessId(hwnd, out actual) != 0 && actual == expected;
        }

        private static bool ClassIs(IntPtr hwnd, string expected) {
            var name = new StringBuilder(128);
            if (GetClassName(hwnd, name, name.Capacity) <= 0) return false;
            var actual = name.ToString();
            return actual == expected || actual == expected + ".UnicodeClass";
        }

        private static bool InMailList(IntPtr hwnd, IntPtr main, uint pid) {
            bool listFrame = false;
            var parent = GetAncestor(hwnd, 1); // GA_PARENT
            for (int hop = 0; hop < 16 && parent != IntPtr.Zero && parent != main; hop++) {
                if (!Owned(parent, pid)) return false;
                if (ClassIs(parent, "TMailListFrameEx")) listFrame = true;
                if (ClassIs(parent, "TMailAppFrame")) return listFrame && GetAncestor(parent, 2) == main;
                parent = GetAncestor(parent, 1);
            }
            return false;
        }

        public static bool Matches(IntPtr list, IntPtr main, uint pid) {
            return Owned(main, pid) && ClassIs(main, "TFoxMainFrm") && IsWindowVisible(main) &&
                Owned(list, pid) && ClassIs(list, "TVirtualDrawTree") && IsWindowVisible(list) &&
                InMailList(list, main, pid);
        }

        public static IntPtr Find(IntPtr main, uint pid) {
            if (!Owned(main, pid) || !ClassIs(main, "TFoxMainFrm") || !IsWindowVisible(main))
                return IntPtr.Zero;
            IntPtr found = IntPtr.Zero;
            int visited = 0, matches = 0;
            EnumChildWindows(main, delegate(IntPtr hwnd, IntPtr ignored) {
                if (++visited > 2048) return false;
                if (!Owned(hwnd, pid) || !ClassIs(hwnd, "TVirtualDrawTree") ||
                    !IsWindowVisible(hwnd) || !InMailList(hwnd, main, pid)) return true;
                found = hwnd;
                return ++matches < 2;
            }, IntPtr.Zero);
            return visited <= 2048 && matches == 1 && Matches(found, main, pid) ? found : IntPtr.Zero;
        }
    }
}
'@
    }
    $queried = $recovered = 0
    $scopeMatched = $false
    $failure = $null
    $mainWindow = $process.MainWindowHandle
    $listWindow = [FoxmailGuardGuest.ListWindow]::Find($mainWindow, [uint32]$CandidatePid)
    $survived = Test-CandidateAlive
    if (!$survived) {
        $failure = 'candidate-exited'
    } elseif ($listWindow -eq [IntPtr]::Zero) {
        $failure = 'expected-inbox-list-not-unique-and-visible'
    } else {
        try {
            # The native class and ancestor chain are established before the
            # first UIA call. Only the Inbox list provider is queried.
            Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
            $list = [System.Windows.Automation.AutomationElement]::FromHandle($listWindow)
            $pidProperty = [System.Windows.Automation.AutomationElement]::ProcessIdProperty
            if (!$list -or $list.GetCurrentPropertyValue($pidProperty) -ne $CandidatePid) {
                $failure = 'list-provider-process-mismatch'
            } else {
                $scopeMatched = $true
                $owner = [System.Windows.Automation.PropertyCondition]::new($pidProperty, $CandidatePid)
                foreach ($subject in 'Foxmail Guard Test 01', 'Foxmail Guard Test 02', 'Foxmail Guard Test 03') {
                    if (!(Test-CandidateAlive) -or
                        ![FoxmailGuardGuest.ListWindow]::Matches($listWindow, $mainWindow, [uint32]$CandidatePid)) {
                        $failure = 'list-window-changed'
                        break
                    }
                    $name = [System.Windows.Automation.PropertyCondition]::new(
                        [System.Windows.Automation.AutomationElement]::NameProperty, $subject)
                    $match = [System.Windows.Automation.AndCondition]::new($owner, $name)
                    $queried++
                    if ($list.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $match)) {
                        $recovered++
                    }
                }
            }
        } catch {
            # Provider error messages may contain element text. Report only
            # the stable failure category and counts.
            $failure = 'scoped-uia-query-failed'
        }
    }
    $survived = Test-CandidateAlive
    if (!$survived) { $failure = 'candidate-exited' }
    if (!$failure -and ![FoxmailGuardGuest.ListWindow]::Matches($listWindow, $mainWindow, [uint32]$CandidatePid)) {
        $failure = 'list-window-changed'
    }
    if (!$failure -and $recovered -ne 3) { $failure = 'synthetic-subjects-not-all-exposed' }
    [ordered]@{
        passed = !$failure
        candidateSHA256 = $digest
        candidatePid = $CandidatePid
        processSurvived = $survived
        listProviderMatched = $scopeMatched
        syntheticSubjectsQueried = $queried
        syntheticSubjectsRecovered = $recovered
        failure = $failure
    } | ConvertTo-Json -Compress
} finally {
    if ($image) { $image.Dispose() }
    $process.Dispose()
}
