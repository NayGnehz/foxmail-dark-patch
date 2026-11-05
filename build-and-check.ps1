# Historical whole-chain build entry. Source preserved in earlier SourceBackup snapshots.
# Current native compiler entry (fixed shared Zig + canonical cache/lease):
# secondary-windows/compose-native-gate/build-native-v2.ps1
# Print-only native entry: secondary-windows/print-native-gate/build-native-v2.ps1
# Bridge/staging source: secondary-windows/compose-native-gate/build-compose-bridge.cjs
# and secondary-windows/compose-candidate/stage.cjs (research writer owns these).
# These are explicit pipeline steps, not a claim of an end-to-end portable release entry.
throw 'Retired historical whole-chain build (Framework csc / 7-Zip / old UI experiments). Use the current print/compose native entry; see docs/cleanup-report-20261105.md. No build started.'

# Original historical source recovered from this chat's initial read, retained
# in place for source history. Unreachable after the retirement error above.
$ErrorActionPreference='Stop'
$work=$PSScriptRoot
$source='D:\Users\Public\Downloads\Foxmail\Foxmail.exe'
& node (Join-Path $work 'build-dark.cjs') $source (Join-Path $work 'Foxmail-dark.exe')
if($LASTEXITCODE){throw 'PE build failed'}
$meta=Get-Content -LiteralPath (Join-Path $work 'Foxmail-dark.exe.json') -Raw | ConvertFrom-Json
@(('{0},{1},{2},{3},{4},{5}' -f $meta.slots,$meta.entry,$meta.originalEntryRVA,$meta.deviceCapsIAT,$meta.nativeDisplay.slotRva,$meta.nativeDisplay.busyRva); $meta.hooks | ForEach-Object { '{0},{1},{2},{3}' -f $_.dll,$_.name,$_.start,$_.iat }) | Set-Content -LiteralPath (Join-Path $work 'hook-spec.txt')
& node (Join-Path $work 'recolor-background-bitmaps.cjs') (Join-Path $work 'Foxmail-dark.exe') (Join-Path $work 'Foxmail-dark-backgrounds.exe') | Out-Null
if($LASTEXITCODE){throw 'Background bitmap conversion failed'}
& node (Join-Path $work 'recolor-search-scrollbars.cjs') (Join-Path $work 'Foxmail-dark-backgrounds.exe') (Join-Path $work 'Foxmail-dark-final.exe') | Out-Null
if($LASTEXITCODE){throw 'Search/scrollbar conversion failed'}
& node (Join-Path $work 'recolor-numeric-ui-backgrounds.cjs') (Join-Path $work 'Foxmail-dark-final.exe') (Join-Path $work 'Foxmail-dark-static.exe') | Out-Null
if($LASTEXITCODE){throw 'Numeric UI resource conversion failed'}
& node (Join-Path $work 'generate-search-controls.cjs') | Out-Null
if($LASTEXITCODE){throw 'Search icon generation failed'}
& node (Join-Path $work 'recolor-dialog-controls.cjs') (Join-Path $work 'Foxmail-dark-static.exe') (Join-Path $work 'Foxmail-dark-controls.exe') $source
if($LASTEXITCODE){throw 'Dialog controls conversion failed'}
& node (Join-Path $work 'patch-native-header-colors.cjs') (Join-Path $work 'Foxmail-dark-controls.exe') (Join-Path $work 'Foxmail-dark-headers.exe')
if($LASTEXITCODE){throw 'Native header color conversion failed'}
if($env:FOXMAIL_EXPERIMENTAL_CONTROL_BORDERS -eq '1'){
 & node (Join-Path $work 'patch-native-groupbox-borders.cjs') (Join-Path $work 'Foxmail-dark-headers.exe') (Join-Path $work 'Foxmail-dark-borders.exe')
 if($LASTEXITCODE){throw 'Control borders conversion failed'}
}else{
 Copy-Item -LiteralPath (Join-Path $work 'Foxmail-dark-headers.exe') -Destination (Join-Path $work 'Foxmail-dark-borders.exe') -Force
 '{"changed":[],"description":"Experimental control paint branches disabled"}' | Set-Content -LiteralPath (Join-Path $work 'Foxmail-dark-borders.exe.groupbox-borders.json')
}
& node (Join-Path $work 'patch-menu-shadow.cjs') (Join-Path $work 'Foxmail-dark-borders.exe') (Join-Path $work 'Foxmail-dark-shadow.exe') | Out-Null
if($LASTEXITCODE){throw 'Menu shadow conversion failed'}
& node (Join-Path $work 'fix-accessibility-loop.cjs') (Join-Path $work 'Foxmail-dark-shadow.exe') (Join-Path $work 'Foxmail-dark-fixed.exe') | Out-Null
if($LASTEXITCODE){throw 'Accessibility traversal correction failed'}
& node (Join-Path $work 'verify-code-scope.cjs') $source (Join-Path $work 'Foxmail-dark-fixed.exe') (Join-Path $work 'Foxmail-dark.exe.json')
if($LASTEXITCODE){throw 'Unexpected executable code changes'}
& 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /platform:x86 "/out:$work\verify-hooks.exe" (Join-Path $work 'verify-hooks.cs')
if($LASTEXITCODE){throw 'Test harness compilation failed'}
& (Join-Path $work 'verify-hooks.exe') (Join-Path $work 'Foxmail-dark-fixed.exe') (Join-Path $work 'hook-spec.txt')
if($LASTEXITCODE){throw 'Native color checks failed'}
if($meta.nativeTransientBuffer){
 & node (Join-Path $work 'build-transient-buffer-fixture.cjs') (Join-Path $work 'Foxmail-dark-fixed.exe') (Join-Path $work 'Foxmail-dark.exe.json')
 if($LASTEXITCODE){throw 'Integrated transient buffer fixture verification failed'}
 & 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /platform:x86 "/out:$work\verify-transient-buffer.exe" (Join-Path $work 'verify-transient-buffer.cs')
 if($LASTEXITCODE){throw 'Transient buffer test compilation failed'}
 & (Join-Path $work 'verify-transient-buffer.exe') (Join-Path $work 'transient-buffer-integrated-fixture.bin') (Join-Path $work 'transient-buffer-fixture.txt')
 if($LASTEXITCODE){throw 'Transient buffer behavior checks failed'}
}
if($meta.nativeGradient){
 & 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /platform:x86 /r:System.Web.Extensions.dll "/out:$work\verify-gradient.exe" (Join-Path $work 'verify-gradient.cs')
 if($LASTEXITCODE){throw 'Gradient test harness compilation failed'}
 & (Join-Path $work 'verify-gradient.exe') $source (Join-Path $work 'Foxmail-dark-fixed.exe') (Join-Path $work 'Foxmail-dark.exe.json')
 if($LASTEXITCODE){throw 'Native gradient comparison failed'}
}
& 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /platform:x86 /r:System.Web.Extensions.dll "/out:$work\verify-initial-erase.exe" (Join-Path $work 'verify-initial-erase.cs')
if($LASTEXITCODE){throw 'Initial erase test compilation failed'}
& (Join-Path $work 'verify-initial-erase.exe') $source (Join-Path $work 'Foxmail-dark-fixed.exe') (Join-Path $work 'Foxmail-dark.exe.json')
if($LASTEXITCODE){throw 'Initial erase checks failed'}
if($meta.nativeInitialErase.diagnostics){
 & 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /platform:x86 /r:System.Web.Extensions.dll "/out:$work\verify-erase-diagnostic.exe" (Join-Path $work 'verify-erase-diagnostic.cs')
 if($LASTEXITCODE){throw 'Erase diagnostic test compilation failed'}
 & (Join-Path $work 'verify-erase-diagnostic.exe') (Join-Path $work 'Foxmail-dark-fixed.exe') (Join-Path $work 'Foxmail-dark.exe.json')
 if($LASTEXITCODE){throw 'Erase diagnostic counter checks failed'}
}
& node (Join-Path $work 'build-tray-restore-test.cjs')
if($LASTEXITCODE){throw 'Tray restore fixture build failed'}
if($meta.nativePaintPhase){
 & 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /platform:x86 /r:System.Web.Extensions.dll "/out:$work\verify-paint-phase-diagnostic.exe" (Join-Path $work 'verify-paint-phase-diagnostic.cs')
 if($LASTEXITCODE){throw 'Paint phase diagnostic compilation failed'}
 & (Join-Path $work 'verify-paint-phase-diagnostic.exe') (Join-Path $work 'Foxmail-dark-fixed.exe') (Join-Path $work 'Foxmail-dark.exe.json')
 if($LASTEXITCODE){throw 'Paint phase diagnostic checks failed'}
 if($meta.nativePaintPhase.sites.Count -gt 8){
  & 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /platform:x86 /r:System.Web.Extensions.dll "/out:$work\verify-native-paint-diagnostic.exe" (Join-Path $work 'verify-native-paint-diagnostic.cs')
  if($LASTEXITCODE){throw 'Native paint diagnostic compilation failed'}
  & (Join-Path $work 'verify-native-paint-diagnostic.exe') (Join-Path $work 'Foxmail-dark-fixed.exe') (Join-Path $work 'Foxmail-dark.exe.json')
  if($LASTEXITCODE){throw 'Native paint diagnostic checks failed'}
 }
 if($meta.nativePaintPhase.sites.Count -gt 12){
  & 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /platform:x86 /r:System.Web.Extensions.dll "/out:$work\verify-early-paint-diagnostic.exe" (Join-Path $work 'verify-early-paint-diagnostic.cs')
  if($LASTEXITCODE){throw 'Early paint diagnostic compilation failed'}
  & (Join-Path $work 'verify-early-paint-diagnostic.exe') (Join-Path $work 'Foxmail-dark-fixed.exe') (Join-Path $work 'Foxmail-dark.exe.json')
  if($LASTEXITCODE){throw 'Early paint diagnostic checks failed'}
 }
}
& 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /platform:x86 /r:System.Web.Extensions.dll "/out:$work\verify-tray-restore.exe" (Join-Path $work 'verify-tray-restore.cs')
if($LASTEXITCODE){throw 'Tray restore test compilation failed'}
& (Join-Path $work 'verify-tray-restore.exe')
if($LASTEXITCODE){throw 'Tray restore checks failed'}
& node (Join-Path $work 'verify-tray-integration.cjs') (Join-Path $work 'Foxmail-dark-fixed.exe') (Join-Path $work 'Foxmail-dark.exe.json')
if($LASTEXITCODE){throw 'Tray adapter integration check failed'}
& 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /platform:x86 "/out:$work\verify-editor-canvas.exe" (Join-Path $work 'verify-editor-canvas.cs')
if($LASTEXITCODE){throw 'Editor canvas test compilation failed'}
& (Join-Path $work 'verify-editor-canvas.exe') $source
if($LASTEXITCODE){throw 'Editor canvas checks failed'}
& 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /platform:x86 "/out:$work\verify-menu-shadow.exe" (Join-Path $work 'verify-menu-shadow.cs')
if($LASTEXITCODE){throw 'Menu shadow test compilation failed'}
& (Join-Path $work 'verify-menu-shadow.exe')
if($LASTEXITCODE){throw 'Menu shadow checks failed'}
& 'C:\Program Files\7-Zip\7z.exe' t (Join-Path $work 'Foxmail-dark-fixed.exe') | Select-Object -Last 6
if($LASTEXITCODE){throw 'PE resource validation failed'}

