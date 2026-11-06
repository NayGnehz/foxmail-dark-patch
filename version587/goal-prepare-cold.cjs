'use strict';
// Generate a narrow experimental source copy; never overwrites the user's C edits.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const stage=paths.output('version587-goal-cold-source'),original=path.join(paths.project,'secondary-windows/compose-native-gate');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
let c=fs.readFileSync(path.join(original,'foxmail_reveal_gate.c'),'utf8');const sourceSHA256=sha(c);
const signature='int kind, int allow_visible, int route) {';assert.equal(c.split(signature).length,2);c=c.replace(signature,'int kind, int allow_visible, int route, int cold_restore) {');
let calls=0;c=c.replace(/return gate_run\(([^;\n]+)\);/g,(_,args)=>{calls++;return 'return gate_run('+args+', 0);';});assert.equal(calls,5);
const before='if (!identity && (kind == KIND_SETTINGS || kind == KIND_PRINT || kind == KIND_COMPOSE) && !IsWindowVisible(hwnd)) {';
assert.equal(c.split(before).length,2);
c=c.replace(before,'if (!identity && (((kind == KIND_SETTINGS || kind == KIND_PRINT || kind == KIND_COMPOSE) && !IsWindowVisible(hwnd)) || (cold_restore && kind == KIND_MAIN && (!IsWindowVisible(hwnd) || IsIconic(hwnd))))) {');
c+='\n/* New main-restore export; original exports retain their original cold policy. */\n#pragma comment(linker, "/export:FxColdRun=_FxColdRun@12")\nFXG_EXPORT FXG_DWORD __stdcall FxColdRun(FXG_HWND hwnd, FXG_INVOKE invoke, void *context) {\n FXG_DWORD incoming=GetLastError(); RINC(main_calls); SetLastError(incoming);\n return gate_run(hwnd,invoke,context,KIND_MAIN,0,ROUTE_MAIN,1);\n}\n';
fs.writeFileSync(path.join(stage,'foxmail_reveal_gate.c'),c);
for(const name of ['foxmail_reveal_gate.h','verify_reveal_gate.c'])fs.copyFileSync(path.join(original,name),path.join(stage,name));
let test=fs.readFileSync(path.join(original,'verify_production_dll.c'),'utf8');
const old='L"D:\\\\Workspace\\\\Foxmail\\\\secondary-windows\\\\compose-native-gate\\\\FoxmailRevealGate.dll"';assert.equal(test.split(old).length,2);
test=test.replace(old,'L'+JSON.stringify(path.join(paths.output('version587-goal-native'),'FoxmailRevealGate.dll')));
const marker=' CHECK(DestroyWindow(settings_hwnd)); CHECK(DestroyWindow(proxy_hwnd));';assert.equal(test.split(marker).length,2);
const extra=`
 /* New export is tested only after all legacy assertions passed. */
 {
  RUN cold=(RUN)GetProcAddress(module,"FxColdRun"); CHECK(cold);
  FXG_STATS before,after; FXG_HWND p; int mode;
  for(mode=0;mode<3;mode++){
   p=CreateWindowExW(0,CLASS_NAME,(const WCH *)L"Cold main own fixture",0x00cf0000UL,-24000,-24000,220,160,0,0,instance,0); CHECK(p);
   if(mode==1)ShowWindow(p,6);if(mode==2)ShowWindow(p,4);
   CHECK(!GetPropW(p,(const WCH *)L"FxRevealGate.Identity.43E5CD38.v2"));
   CHECK(get_stats(&before,sizeof(before)));c.hwnd=p;c.fault=0;c.expected_cloak=mode==2?0:1;normal(cold,&c);
   CHECK(get_stats(&after,sizeof(after)));CHECK(after.invocations==before.invocations+1);CHECK(after.acquired==before.acquired+(mode==2?0:1));CHECK(after.released==before.released+(mode==2?0:1));CHECK(after.pending_recovery==0);CHECK(DestroyWindow(p));
  }
  p=CreateWindowExW(0,(const WCH *)L"TOptionForm.UnicodeClass",(const WCH *)L"Cold wrong class",0x00cf0000UL,-24000,-24000,220,160,0,0,instance,0);CHECK(p);c.hwnd=p;c.fault=0;c.expected_cloak=0;normal(cold,&c);CHECK(DestroyWindow(p));
  p=CreateWindowExW(0,CLASS_NAME,(const WCH *)L"Cold exception",0x00cf0000UL,-24000,-24000,220,160,0,0,instance,0);CHECK(p);c.hwnd=p;c.fault=1;c.expected_cloak=1;caught=0;error=0;SetLastError(IN_ERR);__try{cold(p,callback,&c);CHECK(0);}__except((caught=_exception_code()),1){error=GetLastError();}CHECK(caught==TEST_EXCEPTION&&error==OUT_ERR&&cloak(p)==0);CHECK(!GetPropW(p,(const WCH *)L"FxRevealGate.Owner.43E5CD38.v2"));CHECK(get_stats(&after,sizeof(after))&&after.pending_recovery==0);CHECK(DestroyWindow(p));
  printf("New cold route: hidden, iconic, visible bypass, wrong class and SEH checked.\\n");
 }
`;
test=test.replace(marker,extra+marker);fs.writeFileSync(path.join(stage,'verify_production_dll.c'),test);
fs.writeFileSync(path.join(stage,'source-audit.json'),JSON.stringify({sourceSHA256,modifiedSHA256:sha(c),originalExportsUnchangedColdPolicy:true,newExport:'FxColdRun',newStartupActions:false,newTimingOrMessageLoop:false,scope:'Only opt-in exact main hidden/iconic cold arming; ABI/unwind/release engine retained. Main EXE export name will change Gate to Cold, same byte length.'},null,2));
console.log(JSON.stringify({sourceDirectory:stage,sourceSHA256,modifiedSHA256:sha(c)}));
