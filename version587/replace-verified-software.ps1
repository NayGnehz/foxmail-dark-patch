# Call with the registered Prepare lease held and the exact target stopped.
function Set-FoxmailVerifiedSoftware {
    param(
        [Parameter(Mandatory)][string]$Target,
        [Parameter(Mandatory)][byte[]]$Replacement,
        [Parameter(Mandatory)][string]$Before,
        [Parameter(Mandatory)][string]$After
    )

    function StreamHash([IO.FileStream]$stream) {
        $stream.Position = 0
        [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant()
    }
    function WriteChecked([IO.FileStream]$stream, [byte[]]$bytes, [string]$expected) {
        $stream.Position = 0
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.SetLength($bytes.Length)
        $stream.Flush($true)
        if ((StreamHash $stream) -ne $expected) { throw 'Exclusive-handle software verification failed' }
    }

    $null = Assert-PortablePlainPath $Target
    $stream = $null
    $deadline = [DateTime]::UtcNow.AddSeconds(8)
    do {
        try { $stream = [IO.File]::Open($Target, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
        catch [IO.IOException] {
            if ([DateTime]::UtcNow -ge $deadline) { throw }
            [Threading.Thread]::Sleep(100)
        }
    } while (!$stream)

    try {
        if ((StreamHash $stream) -ne $Before) { throw 'Installed software identity changed before exclusive write' }
        if ((Get-FoxmailBytesHash $Replacement) -ne $After) { throw 'Replacement bytes changed before exclusive write' }
        $stream.Position = 0
        $prior = [byte[]]::new([int]$stream.Length)
        $stream.ReadExactly($prior)
        try { WriteChecked $stream $Replacement $After }
        catch {
            WriteChecked $stream $prior $Before
            throw
        }
    } finally {
        $stream.Dispose()
    }
}

function Get-FoxmailBytesHash([byte[]]$bytes) {
    [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
}
