[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ExpectedLogin,
 [Parameter(Mandatory=$true)][string]$Stage,
 [Parameter(Mandatory=$true)][string]$PrivacyReport,
 [Parameter(Mandatory=$true)][string]$ReleaseAudit,
 [string]$RepositoryName='foxmail-dark-patch',
 [string]$InstanceId='version587-20261105')
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$adapter=Join-Path (Split-Path $PSScriptRoot -Parent) 'Invoke-FoxmailPortable.ps1'
$context=& $adapter -Action Resolve -InstanceId $InstanceId
$git=& $adapter -Action Tool -Tool git -InstanceId $InstanceId
$manager=Join-Path (Split-Path (Split-Path $git -Parent) -Parent) 'mingw64\bin\git-credential-manager.exe'
Import-Module (Join-Path $context.environmentRoot 'bin\PortableCache.psm1')
Invoke-PortableInstance -ProjectId foxmail -InstanceId $InstanceId -Mode Prepare -Body {
 param($instance)
 function Assert($value,[string]$message){if(!$value){throw $message}}
 $null=Assert-PortablePlainPath $Stage
 Assert ([IO.Path]::GetFullPath($Stage).StartsWith((Join-Path $instance.instanceRoot 'temp')+'\',[StringComparison]::OrdinalIgnoreCase)) 'Publication must be staged in this instance'
 Assert ($RepositoryName -match '^[a-z0-9-]+$') 'Invalid repository name'
 $ready=Get-Content -Raw -LiteralPath (Join-Path $Stage 'ready.json') | ConvertFrom-Json
 $audit=Get-Content -Raw -LiteralPath $PrivacyReport | ConvertFrom-Json
 $releaseAudit=Get-Content -Raw -LiteralPath $ReleaseAudit | ConvertFrom-Json
 foreach($category in @('personal_marker','email','secret','user_directory','ipv4')){Assert (!$audit.counts.$category) ('Unresolved history privacy finding '+$category)}
 Assert ($releaseAudit.passed -and $releaseAudit.launcherSHA256 -eq $ready.assets.'Foxmail-Dark-Patch.cmd' -and $releaseAudit.archiveSHA256 -eq $ready.assets.'Foxmail-Dark-Port-Kit.zip') 'Release privacy proof mismatch'
 $repo=Assert-PortablePlainPath $ready.repository
 Assert ($repo -eq (Join-Path $Stage 'repository')) 'Unexpected publication repository'
 Assert ((& $git -C $repo rev-parse main).Trim() -eq $ready.head -and [int](& $git -C $repo rev-list --count main) -eq $audit.objects.commit) 'History changed since privacy audit'
 foreach($asset in $ready.assets.PSObject.Properties){$file=Assert-PortablePlainPath (Join-Path $Stage ('assets\'+$asset.Name));Assert ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -eq $asset.Value) ('Asset changed '+$asset.Name)}
 $env:GCM_INTERACTIVE='never';$env:GIT_TERMINAL_PROMPT='0'
 $lines="protocol=https`nhost=github.com`nusername=$ExpectedLogin`n`n" | & $manager get 2>$null
 $credential=@{};foreach($line in $lines){$parts=$line -split '=',2;if($parts.Count -eq 2){$credential[$parts[0]]=$parts[1]}}
 Assert $credential.ContainsKey('password') 'GitHub account must be authorized first'
 $headers=@{Authorization='Bearer '+$credential.password;Accept='application/vnd.github+json';'User-Agent'='foxmail-dark-patch-publication';'X-GitHub-Api-Version'='2022-11-28'}
 function Api([string]$path,[string]$method='Get',$body=$null){
  $options=@{Uri='https://api.github.com'+$path;Headers=$headers;Method=$method;TimeoutSec=30;DisableKeepAlive=$true}
  if($null -ne $body){$options.Body=[Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 8 -Compress));$options.ContentType='application/json; charset=utf-8'}
  Invoke-RestMethod @options
 }
 $identity=Api '/user';Assert ($identity.login -eq $ExpectedLogin) 'GitHub identity changed'
 $fullName=$ExpectedLogin+'/'+$RepositoryName
 $stateFile=Join-Path $Stage 'github-state.json';$state=@{}
 if(Test-Path -LiteralPath $stateFile){$saved=Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json;foreach($p in $saved.PSObject.Properties){$state[$p.Name]=$p.Value}}
 $existing=$null
 try{$existing=Api ('/repos/'+$fullName)}catch{if($_.Exception.Response.StatusCode.value__ -ne 404){throw}}
 if($existing){Assert ($state.repositoryId -and $state.repositoryId -eq $existing.id) 'Repository already exists; refusing to overwrite an unrelated project';$remote=$existing}
 else{
  $remote=Api '/user/repos' 'Post' @{name=$RepositoryName;description='A reversible dark UI patch for Foxmail Windows, with sanitized development history.';private=$false;auto_init=$false;has_issues=$true;has_wiki=$false;has_projects=$false}
  $state.repositoryId=$remote.id;$state.repository=$remote.html_url
  $state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $stateFile -Encoding utf8
 }
 Assert (!$remote.private -and $remote.owner.login -eq $ExpectedLogin) 'Expected a new public repository owned by the selected account'
 $remoteUrl='https://github.com/'+$fullName+'.git'
 $origin=& $git -C $repo remote get-url origin 2>$null
 if($LASTEXITCODE -eq 0){Assert ($origin -eq $remoteUrl) 'Unexpected origin'}else{& $git -C $repo remote add origin $remoteUrl;if($LASTEXITCODE){throw 'Could not add publication origin'}}
 $tag=$ready.version
 $tagHead=& $git -C $repo rev-parse --verify ('refs/tags/'+$tag+'^{}') 2>$null
 if($LASTEXITCODE -eq 0){Assert ($tagHead -eq $ready.head) 'Existing tag points elsewhere'}
 else{
  $previousDate=$env:GIT_COMMITTER_DATE
  try{$env:GIT_COMMITTER_DATE='2026-11-15T04:00:00+0000';& $git -C $repo -c 'user.name=Foxmail Dark Patch' -c user.email=noreply@example.invalid tag -a $tag $ready.head -m ('Foxmail Dark Patch '+$tag);if($LASTEXITCODE){throw 'Could not create anonymous release tag'}}finally{$env:GIT_COMMITTER_DATE=$previousDate}
 }
 & $git -C $repo -c credential.helper= -c credential.helper=manager -c credential.interactive=false push -u origin main ('refs/tags/'+$tag)
 if($LASTEXITCODE){throw 'GitHub push failed'}
 $releases=@(Api ('/repos/'+$fullName+'/releases'))
 $release=$releases | Where-Object {$_.tag_name -eq $tag} | Select-Object -First 1
 $notes=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'release-notes.md')
 if(!$release){$release=Api ('/repos/'+$fullName+'/releases') 'Post' @{tag_name=$tag;target_commitish=$ready.head;name=('Foxmail Dark Patch '+$tag);body=$notes;draft=$true;prerelease=$false}}
 Assert ($release.tag_name -eq $tag -and !$release.prerelease) 'Unexpected release state'
 $state.releaseId=$release.id;$state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $stateFile -Encoding utf8
 $uploadBase=($release.upload_url -split '\{')[0]
 foreach($asset in $ready.assets.PSObject.Properties){
  $list=@(Api ('/repos/'+$fullName+'/releases/'+$release.id+'/assets'))
  $uploaded=$list | Where-Object {$_.name -eq $asset.Name} | Select-Object -First 1
  if(!$uploaded){
   $file=Join-Path $Stage ('assets\'+$asset.Name)
   $type=if($asset.Name.EndsWith('.zip')){'application/zip'}else{'application/octet-stream'}
   $uploaded=Invoke-RestMethod -Method Post -Uri ($uploadBase+'?name='+[uri]::EscapeDataString($asset.Name)) -Headers $headers -InFile $file -ContentType $type -TimeoutSec 60 -DisableKeepAlive
  }
  Assert ($uploaded.size -eq (Get-Item -LiteralPath (Join-Path $Stage ('assets\'+$asset.Name))).Length) ('Upload size mismatch '+$asset.Name)
  if($uploaded.digest){Assert ($uploaded.digest -eq ('sha256:'+$asset.Value)) ('Upload digest mismatch '+$asset.Name)}
 }
 if($release.draft){$release=Api ('/repos/'+$fullName+'/releases/'+$release.id) 'Patch' @{draft=$false;prerelease=$false;make_latest='true'}}
 $latest=Api ('/repos/'+$fullName+'/releases/latest')
 Assert (!$latest.draft -and !$latest.prerelease -and $latest.tag_name -eq $tag -and $latest.assets.Count -eq @($ready.assets.PSObject.Properties).Count) 'Official release was not published completely'
 $downloads=Join-Path $Stage 'download-verification';[void][IO.Directory]::CreateDirectory($downloads)
 foreach($asset in $latest.assets){
  $file=Join-Path $downloads $asset.name
  Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $file -TimeoutSec 60 -DisableKeepAlive
  Assert ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -eq $ready.assets.($asset.name)) ('Published download differs '+$asset.name)
 }
 $remoteHead=& $git -C $repo ls-remote origin refs/heads/main
 Assert ($LASTEXITCODE -eq 0 -and $remoteHead.StartsWith($ready.head)) 'Published main differs'
 $result=@{published=$true;repository=$remote.html_url;release=$latest.html_url;version=$tag;commits=$ready.commits;head=$ready.head;public=$true;draft=$false;prerelease=$false;downloadHashesVerified=$true;assets=$ready.assets}
 $result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Stage 'published.json') -Encoding utf8
 $result | ConvertTo-Json -Depth 5
}
