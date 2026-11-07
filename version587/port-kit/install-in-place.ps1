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
    if (Test-PatchFile $Path) { Get-SoftwareHash $Path }
}

function Test-PatchFile([string]$Path) {
    if ([IO.Directory]::Exists($Path)) { throw ('Expected a software file ' + $Path) }
    [IO.File]::Exists($Path)
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
        [IO.Path]::GetFileName($plain) -notmatch '^\.fmb-[a-f0-9]{8}$') {
        throw 'Temporary patch directory identity changed'
    }
    $items = @(Get-ChildItem -LiteralPath $plain -Recurse -Force)
    if ($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) {
        throw 'Unexpected reparse point in temporary patch directory'
    }
    [IO.Directory]::Delete($plain, $true)
}

function Get-PatchBackup([string]$Root, [string]$OriginalHash) {
    $name = [string][char]0x539f + [char]0x7248 + [char]0x5907 + [char]0x4efd
    $backup = Get-PlainPath (Join-Path $Root $name)
    if (!(Test-Path -LiteralPath $backup)) { return @{path=$backup; version=0} }
    $marker = Get-PlainPath (Join-Path $backup 'backup-identity.txt')
    if ([IO.File]::Exists($marker)) {
        $identity = [IO.File]::ReadAllText($marker)
        foreach ($version in 1, 2) {
            if ($identity -ceq "FoxmailDarkBackup/$version $OriginalHash") {
                return @{path=$backup; version=$version}
            }
        }
    }
    throw ('Existing backup folder is not recognized: ' + $backup)
}

function Get-PatchParents([string]$Relative) {
    for ($dir = [IO.Path]::GetDirectoryName($Relative.Replace('/', '\')); $dir; $dir = [IO.Path]::GetDirectoryName($dir)) {
        $dir
    }
    '.'
}

function Get-PatchDirectory([string]$Root, [string]$Relative) {
    if ($Relative -eq '.') { Get-PlainPath $Root }
    else { Get-PlainPath (Join-Path $Root $Relative) }
}

function Read-PatchTimes($Item) {
    @{
        CreationTimeUtc=$Item.CreationTimeUtc.Ticks.ToString()
        LastWriteTimeUtc=$Item.LastWriteTimeUtc.Ticks.ToString()
    }
}

function Save-PatchTimes([string]$Root, [string]$Relative, $Snapshot) {
    $path = Get-PlainPath (Join-Path $Root $Relative)
    $Snapshot.files[$Relative] = Read-PatchTimes ([IO.FileInfo]::new($path))
    foreach ($dir in Get-PatchParents $Relative) {
        if (!$Snapshot.directories.ContainsKey($dir)) {
            $path = Get-PatchDirectory $Root $dir
            $Snapshot.directories[$dir] = Read-PatchTimes ([IO.DirectoryInfo]::new($path))
        }
    }
}

function Get-RestoreTimes($Saved, $Names) {
    $map = @{}
    foreach ($name in $Names) {
        $record = $Saved.PSObject.Properties[$name].Value
        $map[$name] = @{}
        foreach ($field in 'CreationTimeUtc', 'LastWriteTimeUtc') {
            $ticks = Read-Integer $record.$field "saved timestamp for $name"
            $map[$name][$field] = [DateTime]::new($ticks, [DateTimeKind]::Utc)
        }
    }
    return $map
}

function Set-RestoredTimes($Item, $Times) {
    foreach ($field in 'CreationTimeUtc', 'LastWriteTimeUtc') {
        if ($Item.$field -ne $Times[$field]) { $Item.$field = $Times[$field] }
    }
}

function Clear-RestoredBackup($State, $Items, [string]$Root) {
    $files = @('backup-identity.txt')
    if ($State.version -eq 2) {
        $files += 'timestamps.json', 'patch-pending.bin'
    } else {
        $files += @($Items | Where-Object cleanupOriginal | ForEach-Object { $_.relative })
        $active = Get-PlainPath (Join-Path $State.path 'patch-active')
        if ([IO.File]::Exists($active) -and (Get-Item -LiteralPath $active).Length -eq 1 -and
            [IO.File]::ReadAllBytes($active)[0] -eq 1) { $files += 'patch-active' }
    }
    $directories = @($Items | ForEach-Object { Get-PatchParents $_.relative } | Sort-Object -Unique)
    $allowed = @{}
    foreach ($name in $files) { $allowed[(Get-PlainPath (Join-Path $State.path $name))] = 'file' }
    foreach ($name in $directories) { $allowed[(Get-PatchDirectory $State.path $name)] = 'directory' }
    foreach ($name in $directories) {
        $dir = Get-PatchDirectory $State.path $name
        if (![IO.Directory]::Exists($dir)) { continue }
        foreach ($child in Get-ChildItem -LiteralPath $dir -Force) {
            $kind = if ($child.PSIsContainer) { 'directory' } else { 'file' }
            if ($allowed[$child.FullName] -ne $kind -or ($child.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                return @{removed=$false; remaining=$State.path; warning='Extra items in the backup were kept. Move them elsewhere and run restore again.'}
            }
        }
    }

    $retired = Get-PlainPath (Join-Path $Root ('.fmc-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)))
    [IO.Directory]::Move($State.path, $retired)
    try {
        foreach ($name in $files) {
            [IO.File]::Delete((Get-PlainPath (Join-Path $retired $name)))
        }
        foreach ($name in $directories | Sort-Object { $_.Length } -Descending) {
            $dir = Get-PatchDirectory $retired $name
            if ([IO.Directory]::Exists($dir)) { [IO.Directory]::Delete($dir) }
        }
        return @{removed=$true; remaining=$null}
    } catch {
        return @{removed=$false; remaining=$retired; warning=$_.Exception.Message}
    }
}

function Invoke-FoxmailInstall($Mode, $Root, $Manifest, $Report, [int]$BackupVersion) {
    if ($Report -and (!$Report.executable.matchesOriginal -or $Report.versionFolder -ne $Manifest.baseVersion)) {
        $Report | ConvertTo-Json -Depth 6
        return
    }
    if ($Root -eq [IO.Path]::GetPathRoot($Root)) { throw 'Use a Foxmail folder below the drive root' }
    $Root = $Root.TrimEnd('\', '/')
    $originalHash = $Manifest.originalExecutableSHA256
    $legacyName = 'Foxmail' + [char]0x6df1 + [char]0x8272 + '.exe'
    $profile = if ($Report) { $Report.profile } else { '5.0' }

    $lockId = Get-Sha256 ([Text.Encoding]::UTF8.GetBytes($Root.ToUpperInvariant()))
    $mutex = [Threading.Mutex]::new($false, "Global\FoxmailDarkPatch-$lockId")
    $locked = $false
    $started = $false
    $prepared = $null
    $stockLock = $null
    try {
        try { $locked = $mutex.WaitOne(0) }
        catch [Threading.AbandonedMutexException] { $locked = $true }
        if (!$locked) { throw 'Another patch operation is running in this Foxmail directory' }
        $state = Get-PatchBackup $Root $originalHash
        if ($state.version -ne $BackupVersion) { throw 'The backup changed. Run the CMD again.' }
        $restoring = $state.version -ne 0
        $legacy = $state.version -eq 1
        if ($Mode -eq 'restore' -and !$restoring) { throw 'No recognized original backup was found' }
        if ($Mode -eq 'apply' -and $restoring) { throw 'Run the CMD without arguments or use restore before installing again' }

        $stock = Get-PlainPath (Join-Path $Root 'Foxmail.exe')
        $oldDark = Get-PlainPath (Join-Path $Root $legacyName)
        $helper = Get-PlainPath (Join-Path $Root 'FoxmailRevealGate.dll')
        if (!$restoring -and (Test-PatchFile $oldDark)) {
            throw 'An older dark executable exists. Restore it using its own backup before installing.'
        }
        $items = @(
            foreach ($asset in $Manifest.assets) {
                @{relative=$asset.relative; original=$asset.originalSHA256; patch=$asset.sha256}
            }
            if (!$legacy) { @{relative='Foxmail.exe'; original=$originalHash} }
        )
        $directories = @($items | ForEach-Object { Get-PatchParents $_.relative } | Sort-Object -Unique)
        foreach ($item in $items) {
            if (!$item.original) { throw 'A resource has no known original' }
            $item.target = Get-PlainPath (Join-Path $Root $item.relative)
            $item.saved = Get-PlainPath (Join-Path $state.path $item.relative)
            $item.live = Test-PatchFile $item.target
            $item.inBackup = Test-PatchFile $item.saved
            if (!$item.live -and !$item.inBackup) { throw ('Original file is missing: ' + $item.relative) }
        }
        $hasHelper = Test-PatchFile $helper
        if (!$restoring -and ($hasHelper -or @($Report.assets | Where-Object { $_.status -ne 'matchesOriginal' }).Count)) {
            throw 'An existing helper or resource differs from the original installation.'
        }
        if ($legacy) {
            # Old backups contain copies. Keep files that were already restored.
            foreach ($item in $items) {
                $current = Get-PatchFileHash $item.target
                $item.cleanupOriginal = (Get-PatchFileHash $item.saved) -eq $item.original
                if ($current -eq $item.original) { $item.inBackup = $false; continue }
                if (($current -and $current -ne $item.patch) -or !$item.cleanupOriginal) {
                    throw ('Cannot identify the original in the older backup: ' + $item.relative)
                }
            }
            $profiles = @($Manifest.profiles.PSObject.Properties | ForEach-Object { $_.Value })
            if (((Test-PatchFile $oldDark) -and (Get-PatchFileHash $oldDark) -notin $profiles.exeSHA256) -or
                ($hasHelper -and (Get-PatchFileHash $helper) -notin $profiles.helperSHA256)) {
                throw 'Unrecognized files in an older patch installation'
            }
        }
        if ($state.version -eq 2) {
            $timestamps = Read-Json (Join-Path $state.path 'timestamps.json')
            $fileTimes = Get-RestoreTimes $timestamps.files @($items | ForEach-Object { $_.relative })
            $dirTimes = Get-RestoreTimes $timestamps.directories $directories
        }

        if ($Mode -eq 'check') {
            if (!$Report) { $Report = [ordered]@{schema=1; appRoot=$Root; supportedVersion=$Manifest.baseVersion} }
            $Report.canGenerate = $true
            $Report.blockers = @()
            $Report.backupDirectory = $state.path
            $Report.nextAction = if ($restoring) { 'restore' } else { 'install' }
            $Report | ConvertTo-Json -Depth 6
            return
        }
        Assert-FoxmailClosed $Root
        $changed = 0
        $cleanup = @{removed=$false; remaining=$state.path}
        if (!$restoring) {
            $newFiles = @(Get-FoxmailPatchFiles -ExecutableName 'Foxmail.exe')
            $times = @{files=@{}; directories=@{}}
            foreach ($item in $items) { Save-PatchTimes $Root $item.relative $times }

            # Publish the recovery plan before moving the launch entry or resources.
            $stage = Get-PlainPath (Join-Path $Root ('.fmb-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)))
            if (Test-Path -LiteralPath $stage) { throw 'Temporary backup directory already exists' }
            [void][IO.Directory]::CreateDirectory($stage)
            $prepared = $stage
            foreach ($dir in $directories) { [void][IO.Directory]::CreateDirectory((Get-PatchDirectory $stage $dir)) }
            Write-PatchWorkFile (Join-Path $stage 'backup-identity.txt') ([Text.Encoding]::ASCII.GetBytes("FoxmailDarkBackup/2 $originalHash"))
            Write-PatchWorkFile (Join-Path $stage 'timestamps.json') ([Text.Encoding]::UTF8.GetBytes(($times | ConvertTo-Json -Depth 6)))
            [IO.Directory]::Move($stage, $state.path)
            $prepared = $null
            $started = $true

            Assert-FoxmailClosed $Root
            for ($i = $items.Count - 1; $i -ge 0; $i--) {
                [IO.File]::Move($items[$i].target, $items[$i].saved)
            }
            $pending = Join-Path $state.path 'patch-pending.bin'
            # Publish the launch entry last.
            foreach ($file in @($newFiles | Where-Object relative -ne 'Foxmail.exe') + @($newFiles | Where-Object relative -eq 'Foxmail.exe')) {
                $target = Get-PlainPath (Join-Path $Root $file.relative)
                Write-PatchWorkFile $pending $file.bytes
                [IO.File]::Move($pending, $target)
                $changed++
            }
        } else {
            if ($legacy -or !$items[-1].inBackup) {
                $stockLock = [IO.File]::Open($stock, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
                if ($legacy -and (Get-Sha256 $stockLock) -ne $originalHash) { throw 'The original executable changed' }
            }
            $started = $true
            if ($legacy) {
                if (Test-PatchFile $oldDark) { [IO.File]::Delete($oldDark); $changed++ }
            } elseif ($items[-1].inBackup) {
                [IO.File]::Delete($stock)
            }
            if ($hasHelper) { [IO.File]::Delete($helper); $changed++ }

            foreach ($item in $items | Where-Object inBackup) {
                if ($item.target -ne $stock) { [IO.File]::Delete($item.target) }
                [IO.File]::Move($item.saved, $item.target)
                $changed++
            }
            if ($stockLock) { $stockLock.Dispose(); $stockLock = $null }
            if (!$legacy) {
                foreach ($item in $items) { Set-RestoredTimes ([IO.FileInfo]::new($item.target)) $fileTimes[$item.relative] }
                foreach ($dir in $directories | Where-Object { $_ -ne '.' } | Sort-Object { $_.Length } -Descending) {
                    $path = Get-PatchDirectory $Root $dir
                    Set-RestoredTimes ([IO.DirectoryInfo]::new($path)) $dirTimes[$dir]
                }
            }
            $cleanup = Clear-RestoredBackup $state $items $Root
            if (!$legacy) { Set-RestoredTimes ([IO.DirectoryInfo]::new($Root)) $dirTimes['.'] }
        }

        [ordered]@{
            action = if ($restoring) { 'restored' } else { 'installed' }
            canGenerate = $true
            profile = $profile
            appRoot = $Root
            backupDirectory = $cleanup.remaining
            backupRemoved = $cleanup.removed
            backupFileCount = if ($restoring) { 0 } else { $items.Count }
            metadataRestored = $restoring -and !$legacy
            changedFiles = $changed
            executable = $stock
            warning = $cleanup.warning
        } | ConvertTo-Json -Depth 3
    } catch {
        if ($started -and [IO.Directory]::Exists($state.path)) {
            throw ('Patch operation did not finish. Keep the backup and run the CMD again to restore. ' + $_.Exception.Message)
        }
        throw
    } finally {
        try {
            if ($prepared) { Remove-PatchWork $prepared $Root }
        } finally {
            if ($stockLock) { $stockLock.Dispose() }
            if ($locked) { $mutex.ReleaseMutex() }
            $mutex.Dispose()
        }
    }
}
