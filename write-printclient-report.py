import json
p={
'scope':'Read-only original binary; no Foxmail launch, UI automation, app edit, or build. Only audit helpers and report written.',
'classes':{'TFMCheckBox':{'vmt':'A92008','customWMPaint':'A934C0'},'TFMRadioButton':{'vmt':'A90898','customWMPaint':'A91CFC'}},
'inheritance':'Neither class nor intervening ancestors overrides WM_PRINTCLIENT (318). First handler is TWinControl11345D8. No WM_PRINT317 handler found anywhere in either ancestor chain.',
'printClient':{
'entry':'11345D8 EAX=Self, EDX=Message. Message offsets0=msg,4=HDC,8=flags,C=result.',
'usualBranch':'Result !=1 and (no PRF_CHECKVISIBLE or Visible) =>1134605 call112FF68 PaintHandler.',
'paintHandler':'112FF68 uses incoming HDC (BeginPaint only if incoming null). Calls virtual+B8 at112FFBA or1130080.',
'paintWindow':'Both checkbox/radio inherit virtual+B8=11300D4. 11300E0 constructs WM_PAINT(F),11300EA uses incoming HDC,11300FF calls DefaultHandler virtual-10. This bypasses customA934C0/A91CFC and bitmap paintersA92D10/A9156C.',
'defaultHandler':'Both inherit112FD98. 112FED4 calls thunk408888 ->CallWindowProcA IAT12FA9BC with original window proc self+174 and HWNDself+180.',
'otherBranch':'Original result1 or hidden+PRF_CHECKVISIBLE calls virtual-10 directly with original318; native route remains.'},
'diagnosticBoundary':{
'preferred':'Hook11345D8 with exact VMT match, record original msg/HDC/flags/result and associate per-thread scoped context for the native call. Hook11300D4 for same exact classes to observe rendering to incoming HDC; do not alter painting.',
'iatWarning':'Filtering CallWindowProcA/W solely for317/318 misses the normal318->PaintWindow->WM_PAINT conversion. Include F with nonzero incoming HDC and positive association to exact target HWND/context.',
'iatVA':{'CallWindowProcA':'12FA9BC','CallWindowProcW':'12FA9B8','DefWindowProcA':'12FA960','DefWindowProcW':'12FA95C'},
'minimalEvidence':'Counts of actual318 entry, exact-class VMT/handle, HDC, flags, native-call msg/result, nontext pixel samples before/after native call on valid target DC. No captions or message text.',
'separateTreeEntry':'98962C WM_PRINTCLIENT directly renders99A54C without erase; instrument separately.'},
'conclusion':'A native rendering path demonstrably bypasses the 83 observed custom checkbox/radio paints; existing four dark bitmap stages do not test it. No actual318 occurrence or white pixel producer has yet been demonstrated. This is a narrow diagnostic candidate, not justification for a speculative fix.',
'animation':'Previous audit-tray-restore.json identified only THintWindow AnimateWindow call; PrintWindow ASCII string absent. Do not patch global animation based on this audit.'
}
open('audit-printclient-native-route.json','w',encoding='utf8').write(json.dumps(p,ensure_ascii=False,indent=2))
