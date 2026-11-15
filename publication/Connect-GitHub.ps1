[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ExpectedLogin,
 [Parameter(Mandatory=$true)][string]$CredentialManager,
 [Parameter(Mandatory=$true)][string]$StateFile)
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$headers=@{Accept='application/json';'User-Agent'='foxmail-dark-patch-publication'}
# Public client identifier of the installed Git Credential Manager OAuth app.
$clientId='0120e057bd645470c1ed'
$device=Invoke-RestMethod -Method Post -Uri 'https://github.com/login/device/code' -Headers $headers -Body @{client_id=$clientId;scope='public_repo'} -TimeoutSec 20 -DisableKeepAlive
if(!$device.device_code -or !$device.user_code){throw 'GitHub device authorization did not start'}
# Keep only an encrypted, short-lived device-flow state for connection recovery.
$stateJson=@{device=$device;started=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Depth 4 -Compress
$stateJson | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $StateFile -Encoding Ascii
@{verificationUri=$device.verification_uri;userCode=$device.user_code;expiresIn=$device.expires_in} | ConvertTo-Json -Compress | Write-Output
$deadline=[DateTime]::UtcNow.AddSeconds($device.expires_in)
$interval=[Math]::Max(5,[int]$device.interval)
while([DateTime]::UtcNow -lt $deadline){
 Start-Sleep -Seconds $interval
 try{$result=Invoke-RestMethod -Method Post -Uri 'https://github.com/login/oauth/access_token' -Headers $headers -Body @{client_id=$clientId;device_code=$device.device_code;grant_type='urn:ietf:params:oauth:grant-type:device_code'} -TimeoutSec 20 -DisableKeepAlive}
 catch{Write-Output 'Retrying GitHub authorization after a connection timeout';continue}
 if($result.error -eq 'authorization_pending'){continue}
 if($result.error -eq 'slow_down'){$interval+=5;continue}
 if(!$result.access_token){throw ('GitHub authorization failed: '+$result.error)}
 $auth=@{Authorization='Bearer '+$result.access_token;Accept='application/vnd.github+json';'User-Agent'='foxmail-dark-patch-publication'}
 $identity=$null
 for($attempt=0;$attempt -lt 3 -and !$identity;$attempt++){try{$identity=Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $auth -TimeoutSec 20 -DisableKeepAlive}catch{Start-Sleep -Seconds 2}}
 if(!$identity){throw 'GitHub identity verification is temporarily unavailable'}
 if($identity.login -ne $ExpectedLogin){throw 'Authorized GitHub account differs from the selected account'}
 # Keep the credential in the existing Windows credential store, never a file.
 $inputText="protocol=https`nhost=github.com`nusername=$($identity.login)`npassword=$($result.access_token)`n`n"
 $null=$inputText | & $CredentialManager store
 if($LASTEXITCODE){throw 'Credential Manager could not save the authorization'}
 Remove-Item -LiteralPath $StateFile
 Write-Output ('GitHub authorization complete for '+$identity.login)
 exit 0
}
throw 'GitHub device authorization expired'
