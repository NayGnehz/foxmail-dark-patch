function Assert-FoxmailClosed([string]$Root) {
    $prefix = $Root.TrimEnd('\', '/') + '\'
    foreach ($process in Get-Process -Name 'Foxmail*' -ErrorAction SilentlyContinue) {
        try {
            try { $image = $process.MainModule.FileName }
            catch {
                if ($process.HasExited) { continue }
                throw 'Cannot verify the path of a running Foxmail process. Close it before continuing.'
            }
            if (!$image -and !$process.HasExited) {
                throw 'Cannot verify the path of a running Foxmail process. Close it before continuing.'
            }
            if ($image -and $image.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
                throw 'Exit Foxmail in this directory, including its tray icon, and run the CMD again.'
            }
        } finally {
            $process.Dispose()
        }
    }
}

function Get-PatchFileHash([string]$Path) {
    $plain = Get-PlainPath $Path
    if ([IO.Directory]::Exists($plain)) { throw ('Expected a software file ' + $plain) }
    if ([IO.File]::Exists($plain)) { Get-SoftwareHash $plain }
}

function Write-PatchWorkFile([string]$Path, [byte[]]$Bytes) {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $stream.Write($Bytes, 0, $Bytes.Length)
        $stream.Flush($true)
    } finally {
        $stream.Dispose()
    }
}

function Remove-PatchWork([string]$Path, [string]$Parent) {
    $plain = Get-PlainPath $Path
    if (![IO.Directory]::Exists($plain)) { return }
    if ([IO.Path]::GetDirectoryName($plain) -ne $Parent -or
        [IO.Path]::GetFileName($plain) -notmatch '^(?:\.foxmail-work-[a-f0-9]{32}|\.fmb-[a-f0-9]{8})$') {
        throw 'Temporary patch directory identity changed'
    }
    $items = @(Get-ChildItem -LiteralPath $plain -Recurse -Force)
    if ($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) {
        throw 'Unexpected reparse point in temporary patch directory'
    }
    [IO.Directory]::Delete($plain, $true)
}

function Invoke-FoxmailInstall($Mode, $Root, $OriginalExe, $Manifest, $Report) {
    if (!$Report.executable.matchesOriginal -or $Report.versionFolder -ne $Manifest.baseVersion) {
        $Report | ConvertTo-Json -Depth 6
        return
    }
    if ($Root -eq [IO.Path]::GetPathRoot($Root)) { throw 'Use a Foxmail folder below the drive root' }
    $Root = $Root.TrimEnd('\', '/')
    $originalHash = $Manifest.originalExecutableSHA256
    $backupName = [string][char]0x539f + [char]0x7248 + [char]0x5907 + [char]0x4efd
    $backup = Get-PlainPath (Join-Path $Root $backupName)
    $identity = "FoxmailDarkBackup/1 $originalHash"
    $activeName = 'patch-active'
    $markerName = 'backup-identity.txt'
    $darkExe = 'Foxmail' + [char]0x6df1 + [char]0x8272 + '.exe'
    $profiles = @($Manifest.profiles.PSObject.Properties | ForEach-Object { $_.Value })
    $items = @(
        foreach ($asset in $Manifest.assets) {
            if ($asset.originalSHA256 -notmatch '^[0-9a-f]{64}$') { throw 'A resource has no verified original' }
            @{relative=$asset.relative; original=$asset.originalSHA256; patches=@($asset.sha256)}
        }
        @{relative='FoxmailRevealGate.dll'; original=$null; patches=@($profiles | ForEach-Object { $_.helperSHA256 })}
        @{relative=$darkExe; original=$null; patches=@($profiles | ForEach-Object { $_.exeSHA256 })}
    )
    foreach ($item in $items) {
        $item.target = Get-PlainPath (Join-Path $Root $item.relative)
        if ($item.patches.Count -lt 1 -or @($item.patches | Where-Object { $_ -notmatch '^[0-9a-f]{64}$' }).Count) {
            throw 'Invalid software hash in patch manifest'
        }
    }

    $lockId = Get-Sha256 ([Text.Encoding]::UTF8.GetBytes($Root.ToUpperInvariant()))
    $mutex = [Threading.Mutex]::new($false, "Global\FoxmailDarkPatch-$lockId")
    $locked = $false
    $work = $null
    $prepared = $null
    $sourceLock = $null
    try {
        try { $locked = $mutex.WaitOne(0) }
        catch [Threading.AbandonedMutexException] { $locked = $true }
        if (!$locked) { throw 'Another patch operation is running in this Foxmail directory' }

        $haveBackup = [IO.Directory]::Exists($backup)
        if (Test-Path -LiteralPath $backup) {
            $marker = Get-PlainPath (Join-Path $backup $markerName)
            if (!$haveBackup -or ![IO.File]::Exists($marker) -or [IO.File]::ReadAllText($marker) -cne $identity) {
                throw ('Existing backup folder is not recognized: ' + $backup)
            }
        }
        $active = Get-PlainPath (Join-Path $backup $activeName)
        if ([IO.Directory]::Exists($active)) { throw 'Invalid patch transaction marker' }
        $restoreNeeded = $haveBackup -and [IO.File]::Exists($active)
        foreach ($item in $items) {
            $item.current = Get-PatchFileHash $item.target
            if ($item.current -ne $item.original) {
                if (!$haveBackup -or ($item.current -and $item.current -notin $item.patches)) {
                    throw ('Unverified software preimage: ' + $item.relative)
                }
                $restoreNeeded = $true
            }
            if ($haveBackup -and $item.original) {
                $item.saved = Get-PlainPath (Join-Path $backup $item.relative)
                if ((Get-PatchFileHash $item.saved) -ne $item.original) {
                    throw ('Original backup verification failed: ' + $item.relative)
                }
            }
        }

        if ($Mode -eq 'check') {
            $Report.canGenerate = $true
            $Report.blockers = @()
            $Report.backupDirectory = $backup
            $Report.nextAction = if ($restoreNeeded) { 'restore' } else { 'install' }
            $Report | ConvertTo-Json -Depth 6
            return
        }
        if ($Mode -eq 'restore' -and !$haveBackup) { throw 'No verified original backup was found' }
        if ($Mode -eq 'apply' -and $restoreNeeded) { throw 'Run the CMD without arguments or use restore before installing again' }
        $restoring = $Mode -eq 'restore' -or $restoreNeeded
        Assert-FoxmailClosed $Root

        $newFiles = @{}
        if (!$restoring) {
            foreach ($file in Get-FoxmailPatchFiles) { $newFiles[$file.relative] = $file }
            if ($newFiles.Count -ne $items.Count) { throw 'Incomplete patch output' }
        }

        # Hold the stock entry closed. Publish the dark entry last on install
        # and withdraw it first on restore so it cannot open into a partial state.
        $sourceLock = [IO.File]::Open($OriginalExe, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
        if ((Get-Sha256 $sourceLock) -ne $originalHash) { throw 'Original executable changed before installation' }
        Assert-FoxmailClosed $Root
        $workPath = Get-PlainPath (Join-Path $Root ('.foxmail-work-' + [Guid]::NewGuid().ToString('N')))
        if (Test-Path -LiteralPath $workPath) { throw 'Temporary patch directory already exists' }
        [void][IO.Directory]::CreateDirectory($workPath)
        $work = $workPath

        if (!$haveBackup) {
            # Short same-volume staging path for the WinPS 5.1 path limit.
            $backupStage = Get-PlainPath (Join-Path $Root ('.fmb-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)))
            if (Test-Path -LiteralPath $backupStage) { throw 'Temporary backup directory already exists' }
            [void][IO.Directory]::CreateDirectory($backupStage)
            $prepared = $backupStage
            foreach ($item in $items | Where-Object original) {
                $saved = Join-Path $prepared $item.relative
                [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($saved))
                Write-PatchWorkFile $saved ([IO.File]::ReadAllBytes($item.target))
                if ((Get-SoftwareHash $saved) -ne $item.original) {
                    throw ('Could not capture verified original: ' + $item.relative)
                }
            }
            Write-PatchWorkFile (Join-Path $prepared $markerName) ([Text.Encoding]::ASCII.GetBytes($identity))
            [IO.Directory]::Move($prepared, $backup)
        }
        if (![IO.File]::Exists($active)) { Write-PatchWorkFile $active ([byte[]]@(1)) }

        $ordered = @($items)
        if ($restoring) { [array]::Reverse($ordered) }
        $changed = 0
        foreach ($item in $ordered) {
            $current = Get-PatchFileHash $item.target
            if ($current -ne $item.current) { throw ('Software changed during operation: ' + $item.relative) }
            $expected = if ($restoring) { $item.original } else { $newFiles[$item.relative].sha256 }
            if ($current -eq $expected) { continue }
            $previous = Join-Path $work ('previous-' + $changed)
            if (!$expected) {
                [IO.File]::Move($item.target, $previous)
            } else {
                $bytes = if ($restoring) { ,([IO.File]::ReadAllBytes($item.saved)) } else { ,$newFiles[$item.relative].bytes }
                if ((Get-Sha256 $bytes) -ne $expected) { throw ('Replacement bytes changed: ' + $item.relative) }
                $pending = Join-Path $work 'replacement'
                Write-PatchWorkFile $pending $bytes
                if ($current) {
                    [IO.File]::Replace($pending, $item.target, $previous)
                } else {
                    [IO.File]::Move($pending, $item.target)
                }
            }
            if ((Get-PatchFileHash $item.target) -ne $expected) {
                throw ('Could not verify installed bytes: ' + $item.relative)
            }
            $changed++
        }
        if ($restoring) { [IO.File]::Delete($active) }
        [ordered]@{
            action = if ($restoring) { 'restored' } else { 'installed' }
            canGenerate = $true
            profile = $Report.profile
            appRoot = $Root
            backupDirectory = $backup
            backupFileCount = 39
            changedFiles = $changed
            executable = Join-Path $Root $(if ($restoring) { 'Foxmail.exe' } else { $darkExe })
        } | ConvertTo-Json -Depth 3
    } catch {
        if ($work -and [IO.File]::Exists($active)) {
            throw ('Patch operation did not finish. Keep the backup and run the CMD again to restore. ' + $_.Exception.Message)
        }
        throw
    } finally {
        try {
            try {
                if ($prepared) { Remove-PatchWork $prepared $Root }
            } finally {
                if ($work) { Remove-PatchWork $work $Root }
            }
        } finally {
            if ($sourceLock) { $sourceLock.Dispose() }
            if ($locked) { $mutex.ReleaseMutex() }
            $mutex.Dispose()
        }
    }
}
