#requires -Version 5.1
[CmdletBinding()]
param([ValidateRange(1, 3600)][int]$DurationSeconds = 3600)

$ErrorActionPreference = 'Stop'
$ascii = [Text.Encoding]::ASCII
$newLine = "`r`n"
$user = 'guard'
$address = 'guard@example.invalid'
$password = 'fixture-only'
$messages = @(1..3 | ForEach-Object {
    $number = '{0:00}' -f $_
    $headers = @(
        "From: Fixture Sender $number <sender$number@example.invalid>"
        "To: <$address>"
        "Subject: Foxmail Guard Test $number"
        "Date: Tue, 07 Jan 2025 12:$($number):00 +0000"
        "Message-ID: <foxmail-guard-$number@fixture.example.invalid>"
        'MIME-Version: 1.0'
        'Content-Type: text/plain; charset=us-ascii'
    ) -join $newLine
    $body = "Synthetic fixture body $number."
    [pscustomobject]@{
        Number = $_
        Uid = "foxmail-guard-$number"
        Headers = $headers
        Body = $body
        Size = $ascii.GetByteCount($headers + $newLine + $newLine + $body + $newLine)
    }
})

function Send-Reply($Client, [string[]]$Lines) {
    $bytes = $ascii.GetBytes(($Lines -join $newLine) + $newLine)
    $Client.Stream.Write($bytes, 0, $bytes.Length)
}

function Test-FixtureUser([string]$Name) {
    $Name -ieq $user -or $Name -ieq $address
}

function Handle-Pop($Client, [string]$Verb, [string]$Argument) {
    switch ($Verb) {
        'CAPA' {
            Send-Reply $Client @('+OK Capability list follows', 'USER', 'UIDL', 'TOP', '.')
            return
        }
        'QUIT' {
            Send-Reply $Client '+OK Goodbye'
            $Client.Closed = $true
            return
        }
        'USER' {
            $Client.UserMatches = Test-FixtureUser $Argument
            $Client.Authorized = $false
            Send-Reply $Client '+OK Send password'
            return
        }
        'PASS' {
            $Client.Authorized = $Client.UserMatches -and $Argument -ceq $password
            if ($Client.Authorized) { Send-Reply $Client '+OK Mailbox ready' }
            else { Send-Reply $Client '-ERR Invalid fixture login' }
            return
        }
    }
    if (!$Client.Authorized) {
        Send-Reply $Client '-ERR Login required'
        return
    }

    $items = @($messages | Where-Object { !$Client.Deleted.Contains($_.Number) })
    if ($Verb -eq 'STAT') {
        $size = ($items | Measure-Object -Property Size -Sum).Sum
        Send-Reply $Client "+OK $($items.Count) $([int]$size)"
        return
    }
    if ($Verb -eq 'RSET') {
        $Client.Deleted.Clear()
        Send-Reply $Client '+OK Reset'
        return
    }
    if ($Verb -eq 'NOOP') {
        Send-Reply $Client '+OK'
        return
    }
    if ($Verb -notin @('LIST', 'UIDL', 'RETR', 'TOP', 'DELE')) {
        Send-Reply $Client '-ERR Unsupported command'
        return
    }

    if ($Verb -in @('LIST', 'UIDL') -and !$Argument) {
        $lines = @($items | ForEach-Object {
            $value = if ($Verb -eq 'LIST') { $_.Size } else { $_.Uid }
            "$($_.Number) $value"
        })
        Send-Reply $Client (@('+OK Scan follows') + $lines + @('.'))
        return
    }
    $arguments = $Argument -split '\s+'
    $argumentCount = if ($Verb -eq 'TOP') { 2 } else { 1 }
    $number = 0
    if ($arguments.Count -ne $argumentCount -or
        ![int]::TryParse($arguments[0], [ref]$number) -or $number -lt 1 -or
        $number -gt $messages.Count -or $Client.Deleted.Contains($number)) {
        Send-Reply $Client '-ERR No such message'
        return
    }
    $message = $messages[$number - 1]
    switch ($Verb) {
        'LIST' { Send-Reply $Client "+OK $number $($message.Size)" }
        'UIDL' { Send-Reply $Client "+OK $number $($message.Uid)" }
        'RETR' { Send-Reply $Client @("+OK $($message.Size) octets", $message.Headers, '', $message.Body, '.') }
        'TOP' {
            $lines = 0
            if (![int]::TryParse($arguments[1], [ref]$lines) -or $lines -lt 0) {
                Send-Reply $Client '-ERR Invalid line count'
                return
            }
            $response = @('+OK Top of message follows', $message.Headers, '')
            if ($lines -gt 0) { $response += $message.Body }
            Send-Reply $Client ($response + @('.'))
        }
        'DELE' {
            # Keep the same fixture mailbox for every connection.
            [void]$Client.Deleted.Add($number)
            Send-Reply $Client '+OK Marked for this session'
        }
    }
}

function Read-AuthValue([string]$Text) {
    try { $ascii.GetString([Convert]::FromBase64String($Text)) }
    catch [FormatException] { '' }
}

function Handle-SmtpAuth($Client, [string]$Line) {
    if ($Line -eq '*') {
        $Client.AuthStep = ''
        Send-Reply $Client '501 Authentication canceled'
        return
    }
    $value = Read-AuthValue $Line
    if ($Client.AuthStep -eq 'username') {
        $Client.UserMatches = Test-FixtureUser $value
        $Client.AuthStep = 'password'
        Send-Reply $Client '334 UGFzc3dvcmQ6'
        return
    }
    if ($Client.AuthStep -eq 'plain') {
        $parts = $value.Split([char]0)
        $valid = $parts.Count -eq 3 -and (Test-FixtureUser $parts[1]) -and $parts[2] -ceq $password
    } else {
        $valid = $Client.UserMatches -and $value -ceq $password
    }
    $Client.AuthStep = ''
    if ($valid) { Send-Reply $Client '235 Authentication successful' }
    else { Send-Reply $Client '535 Invalid fixture login' }
}

function Reset-Envelope($Client) {
    $Client.HasSender = $false
    $Client.HasRecipient = $false
    $Client.DataBytes = 0
}

function Handle-Smtp($Client, [string]$Verb, [string]$Argument) {
    switch ($Verb) {
        'EHLO' {
            Reset-Envelope $Client
            Send-Reply $Client @('250-fixture.example.invalid', '250 AUTH PLAIN LOGIN')
        }
        'HELO' {
            Reset-Envelope $Client
            Send-Reply $Client '250 fixture.example.invalid'
        }
        'AUTH' {
            $parts = $Argument -split '\s+', 2
            switch ($parts[0]) {
                'LOGIN' {
                    $Client.AuthStep = 'username'
                    if ($parts.Count -eq 2) { Handle-SmtpAuth $Client $parts[1] }
                    else { Send-Reply $Client '334 VXNlcm5hbWU6' }
                }
                'PLAIN' {
                    $Client.AuthStep = 'plain'
                    if ($parts.Count -eq 2) { Handle-SmtpAuth $Client $parts[1] }
                    else { Send-Reply $Client '334 ' }
                }
                default { Send-Reply $Client '504 Unsupported authentication mechanism' }
            }
        }
        'MAIL' {
            Reset-Envelope $Client
            $Client.HasSender = $Argument -match '^FROM:\s*<(?:guard@example\.invalid)?>(?:\s.*)?$'
            if ($Client.HasSender) { Send-Reply $Client '250 Fixture sender accepted' }
            else { Send-Reply $Client '553 Use the fixture sender address' }
        }
        'RCPT' {
            if (!$Client.HasSender) { Send-Reply $Client '503 MAIL required' }
            elseif ($Argument -match '^TO:\s*<[A-Za-z0-9_.+-]+@example\.invalid>(?:\s.*)?$') {
                $Client.HasRecipient = $true
                Send-Reply $Client '250 Fixture recipient accepted'
            } else { Send-Reply $Client '550 Only example.invalid recipients are accepted' }
        }
        'DATA' {
            if ($Client.HasRecipient) {
                $Client.InData = $true
                Send-Reply $Client '354 End with a line containing only a dot'
            } else { Send-Reply $Client '503 RCPT required' }
        }
        'RSET' {
            Reset-Envelope $Client
            Send-Reply $Client '250 Reset'
        }
        'NOOP' { Send-Reply $Client '250 OK' }
        'QUIT' {
            Send-Reply $Client '221 Goodbye'
            $Client.Closed = $true
        }
        default { Send-Reply $Client '502 Unsupported command' }
    }
}

function Handle-Line($Client, [string]$Line) {
    if ($Client.InData) {
        if ($Line -ceq '.') {
            $Client.InData = $false
            Reset-Envelope $Client
            Send-Reply $Client '250 Synthetic message discarded'
        } else {
            $Client.DataBytes += $Line.Length + 2
            if ($Client.DataBytes -gt 65536) {
                Send-Reply $Client '552 Fixture message exceeds size limit'
                $Client.Closed = $true
            }
        }
        return
    }
    if ($Client.AuthStep) {
        Handle-SmtpAuth $Client $Line
        return
    }
    $parts = $Line -split '\s+', 2
    $verb = $parts[0].ToUpperInvariant()
    $argument = if ($parts.Count -eq 2) { $parts[1] } else { '' }
    if ($Client.Protocol -eq 'POP3') { Handle-Pop $Client $verb $argument }
    else { Handle-Smtp $Client $verb $argument }
}

$clock = [Diagnostics.Stopwatch]::StartNew()
$endpoints = @(
    @{ Protocol = 'POP3'; Port = 21110; Greeting = '+OK Foxmail fixture POP3' }
    @{ Protocol = 'SMTP'; Port = 21587; Greeting = '220 fixture.example.invalid ESMTP' }
)
$clients = [Collections.Generic.List[object]]::new()
$readBuffer = [byte[]]::new(4096)
try {
    foreach ($endpoint in $endpoints) {
        $endpoint.Listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $endpoint.Port)
        $endpoint.Listener.Server.ExclusiveAddressUse = $true
        $endpoint.Listener.Start(8)
    }
    Write-Output 'READY POP3 127.0.0.1:21110 SMTP 127.0.0.1:21587'

    while ($clock.Elapsed.TotalSeconds -lt $DurationSeconds) {
        $now = $clock.Elapsed.TotalSeconds
        foreach ($endpoint in $endpoints) {
            if (!$endpoint.Listener.Pending()) { continue }
            $socket = $endpoint.Listener.AcceptTcpClient()
            if ($clients.Count -ge 8) {
                $socket.Dispose()
                continue
            }
            try {
                $socket.NoDelay = $true
                $socket.SendTimeout = 1000
                $client = [pscustomobject]@{
                    Socket = $socket; Stream = $socket.GetStream(); Protocol = $endpoint.Protocol
                    Started = $now; LastRead = $now; Pending = ''; Closed = $false
                    UserMatches = $false; Authorized = $false; AuthStep = ''
                    HasSender = $false; HasRecipient = $false; InData = $false; DataBytes = 0
                    Deleted = [Collections.Generic.HashSet[int]]::new()
                }
                Send-Reply $client $endpoint.Greeting
                $clients.Add($client)
            } catch {
                $socket.Dispose()
            }
        }
        for ($i = $clients.Count - 1; $i -ge 0; $i--) {
            $client = $clients[$i]
            try {
                if ($now - $client.LastRead -ge 45 -or $now - $client.Started -ge 120) {
                    $client.Closed = $true
                } elseif ($client.Socket.Available -gt 0) {
                    $count = $client.Stream.Read($readBuffer, 0, $readBuffer.Length)
                    if (!$count) { $client.Closed = $true }
                    else {
                        $client.LastRead = $now
                        $pieces = ($client.Pending + $ascii.GetString($readBuffer, 0, $count)) -split "`n"
                        $client.Pending = $pieces[-1]
                        $client.Closed = $client.Pending.Length -gt 4096
                        for ($line = 0; !$client.Closed -and $line -lt $pieces.Count - 1; $line++) {
                            if ($pieces[$line].Length -gt 4096) { $client.Closed = $true }
                            else { Handle-Line $client ($pieces[$line].TrimEnd([char]13)) }
                        }
                    }
                } elseif ($client.Socket.Client.Poll(0, [Net.Sockets.SelectMode]::SelectRead) -and
                    !$client.Socket.Available) {
                    $client.Closed = $true
                }
            } catch {
                # Disconnect faulty clients without recording commands or payloads.
                $client.Closed = $true
            }
            if ($client.Closed) {
                $client.Socket.Dispose()
                $clients.RemoveAt($i)
            }
        }
        Start-Sleep -Milliseconds 20
    }
} finally {
    foreach ($endpoint in $endpoints) { if ($endpoint.Listener) { $endpoint.Listener.Stop() } }
    foreach ($client in $clients) { $client.Socket.Dispose() }
}
