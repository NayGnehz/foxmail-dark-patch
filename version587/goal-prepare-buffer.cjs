'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const prior=paths.output('version587-goal-cold-source'),stage=paths.output('version587-goal-buffer-source'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
let c=fs.readFileSync(path.join(prior,'foxmail_reveal_gate.c'),'utf8');assert.equal(sha(c),'112551b31e0f81adf0fe8b9d74befdfa770c70aef18700bb344a0cea59dcfb77');
c+=`
/* Compose-only lifetime buffering. No global style, delay, layer or startup work. */
IMP FXG_DWORD __stdcall GetClassLongW(FXG_HWND,int);
IMP LONG __stdcall SetWindowLongW(FXG_HWND,int,LONG);
#pragma comment(linker, "/export:FxBufferedGateRun=_FxBufferedGateRun@12")
#pragma comment(linker, "/export:FxBufferStats=_FxBufferStats,DATA")
FXG_EXPORT struct {FXG_DWORD size,version,calls,compose_candidates,applied,already_set,unsupported;} FxBufferStats={28,1};
FXG_EXPORT FXG_DWORD __stdcall FxBufferedGateRun(FXG_HWND hwnd,FXG_INVOKE invoke,void *context){
 FXG_DWORD incoming=GetLastError(),style,class_style;
 InterlockedIncrement((volatile LONG *)&FxBufferStats.calls);
 if(matching_class(hwnd,compose_class)&&!IsWindowVisible(hwnd)){
  InterlockedIncrement((volatile LONG *)&FxBufferStats.compose_candidates);
  style=(FXG_DWORD)GetWindowLongW(hwnd,-20);class_style=GetClassLongW(hwnd,-26);
  if(!(style&0x00080000UL)&&!(class_style&0xE0UL)){
   if(!(style&0x02000000UL)){
    SetWindowLongW(hwnd,-20,(LONG)(style|0x02000000UL));
    if(((FXG_DWORD)GetWindowLongW(hwnd,-20)&0x02000000UL)!=0)InterlockedIncrement((volatile LONG *)&FxBufferStats.applied);
   }else InterlockedIncrement((volatile LONG *)&FxBufferStats.already_set);
  }else InterlockedIncrement((volatile LONG *)&FxBufferStats.unsupported);
 }
 SetLastError(incoming);return FxSettingsGateRun(hwnd,invoke,context);
}
`;
fs.writeFileSync(path.join(stage,'foxmail_reveal_gate.c'),c);
for(const name of ['foxmail_reveal_gate.h','verify_reveal_gate.c'])fs.copyFileSync(path.join(prior,name),path.join(stage,name));
let test=fs.readFileSync(path.join(prior,'verify_production_dll.c'),'utf8');
const old='L'+JSON.stringify(path.join(paths.output('version587-goal-native'),'FoxmailRevealGate.dll'));assert.equal(test.split(old).length,2);test=test.replace(old,'L'+JSON.stringify(path.join(paths.output('version587-goal-buffer-native'),'FoxmailRevealGate.dll')));
const marker=' CHECK(DestroyWindow(settings_hwnd)); CHECK(DestroyWindow(proxy_hwnd));';assert.equal(test.split(marker).length,2);
const extra=`
 {
  RUN buffered=(RUN)GetProcAddress(module,"FxBufferedGateRun");FXG_HWND p;
  FXG_DWORD *bs=(FXG_DWORD *)GetProcAddress(module,"FxBufferStats");CHECK(buffered&&bs&&bs[0]==28&&bs[1]==1);
  wc.name=(const WCH *)L"TFoxComposeForm.UnicodeClass";CHECK(RegisterClassW(&wc));
  p=CreateWindowExW(0,wc.name,(const WCH *)L"Buffered compose own fixture",0x00cf0000UL,-24000,-24000,220,160,0,0,instance,0);CHECK(p);
  c.hwnd=p;c.fault=0;c.expected_cloak=0;normal(buffered,&c);CHECK((GetWindowLongW(p,-20)&0x02000000UL)!=0);CHECK(bs[4]==1);
  ShowWindow(p,0);normal(buffered,&c);CHECK(bs[4]==1&&bs[5]==1);CHECK(DestroyWindow(p));
  p=CreateWindowExW(0x00080000UL,wc.name,(const WCH *)L"Existing layer untouched",0x00cf0000UL,-24000,-24000,220,160,0,0,instance,0);CHECK(p);c.hwnd=p;c.expected_cloak=0;normal(buffered,&c);CHECK((GetWindowLongW(p,-20)&0x02000000UL)==0);CHECK(DestroyWindow(p));
  CHECK(UnregisterClassW(wc.name,instance));wc.style=0x20;CHECK(RegisterClassW(&wc));
  p=CreateWindowExW(0,wc.name,(const WCH *)L"Own DC negative",0x00cf0000UL,-24000,-24000,220,160,0,0,instance,0);CHECK(p);c.hwnd=p;c.expected_cloak=1;normal(buffered,&c);CHECK((GetWindowLongW(p,-20)&0x02000000UL)==0);CHECK(DestroyWindow(p));CHECK(UnregisterClassW(wc.name,instance));wc.style=0;
  p=CreateWindowExW(0,(const WCH *)L"TOptionForm.UnicodeClass",(const WCH *)L"Settings unchanged",0x00cf0000UL,-24000,-24000,220,160,0,0,instance,0);CHECK(p);c.hwnd=p;c.expected_cloak=1;normal(buffered,&c);CHECK((GetWindowLongW(p,-20)&0x02000000UL)==0);CHECK(DestroyWindow(p));
  p=CreateWindowExW(0,CLASS_NAME,(const WCH *)L"Main unchanged",0x00cf0000UL,-24000,-24000,220,160,0,0,instance,0);CHECK(p);c.hwnd=p;c.expected_cloak=0;normal(buffered,&c);CHECK((GetWindowLongW(p,-20)&0x02000000UL)==0);CHECK(DestroyWindow(p));
  CHECK(bs[2]==6&&bs[3]==4&&bs[4]==1&&bs[5]==1&&bs[6]==2);
  printf("Compose buffer checks: lifetime retained; main/settings/layered/own-DC excluded.\\n");
 }
`;
test='IMP long __stdcall GetWindowLongW(FXG_HWND,int);\n'+test; // moved below include next
test=test.replace('IMP long __stdcall GetWindowLongW(FXG_HWND,int);\n','');
const inc='#include "foxmail_reveal_gate.h"';assert(test.includes(inc));test=test.replace(inc,inc+'\n__declspec(dllimport) long __stdcall GetWindowLongW(FXG_HWND,int);');
test=test.replace(marker,extra+marker);fs.writeFileSync(path.join(stage,'verify_production_dll.c'),test);
fs.writeFileSync(path.join(stage,'source-audit.json'),JSON.stringify({sourceSHA256:sha(fs.readFileSync(path.join(prior,'foxmail_reveal_gate.c'))),modifiedSHA256:sha(c),export:'FxBufferedGateRun',scope:'Exact hidden compose window only. WS_EX_COMPOSITED kept for HWND lifetime; CS_OWNDC/CLASSDC/PARENTDC and layered windows excluded. Original exports and first-tray export preserved. No global buffering, time delays, message pump, style removal, font/DPI/HTML change.',visualAccepted:false},null,2));
console.log(JSON.stringify({sourceDirectory:stage,sha:sha(c)}));
