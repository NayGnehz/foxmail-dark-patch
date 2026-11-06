'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const stage=paths.output('version587-goal'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const first=JSON.parse(fs.readFileSync(path.join(stage,'firstrestore-validation.json'),'utf8')),input=fs.readFileSync(first.dest);assert.equal(sha(input),first.candidateSHA256);
const meta=JSON.parse(fs.readFileSync(first.dest+'.json','utf8'));
const pe=input.readUInt32LE(60),op=pe+24,so=op+input.readUInt16LE(pe+20);let pos;
for(let i=0;i<input.readUInt16LE(pe+6);i++){const p=so+40*i,r=input.readUInt32LE(p+12),n=input.readUInt32LE(p+16);if(meta.labels.settings_exportName>=r&&meta.labels.settings_exportName<r+n)pos=input.readUInt32LE(p+20)+meta.labels.settings_exportName-r;}
const before=Buffer.from('FxSettingsGateRun\0'),after=Buffer.from('FxBufferedGateRun\0');assert.equal(before.length,after.length);assert(input.subarray(pos,pos+before.length).equals(before));
const out=Buffer.from(input);after.copy(out,pos);let changed=0;for(let i=0;i<input.length;i++)if(input[i]!==out[i]){assert(i>=pos&&i<pos+after.length);changed++;}
const native=paths.output('version587-goal-buffer-native'),helper=path.join(native,'FoxmailRevealGate.dll'),helperSHA256=sha(fs.readFileSync(helper));
for(const [name,token]of [['verify_reveal_gate','PASS: 1122 checks, 0 failures'],['verify_production_dll','PASS: production DLL 224 checks, 0 failures']])assert(fs.readFileSync(path.join(native,name+'.log'),'utf8').includes(token));
const dest=path.join(stage,'Foxmail深色-buffer.exe');fs.writeFileSync(dest,out);fs.writeFileSync(dest+'.json',JSON.stringify({...meta,baseline:first.dest,baselineSHA256:sha(input),candidateSHA256:sha(out),settingsExportOverride:'FxBufferedGateRun'},null,2));
fs.writeFileSync(path.join(stage,'buffer-validation.json'),JSON.stringify({dest,candidateSHA256:sha(out),baselineExe:first.dest,baselineSHA256:sha(input),helper,helperSHA256,baselineHelper:first.helper,baselineHelperSHA256:first.helperSHA256,changedExeBytes:changed,exportNameOffset:pos,headersResourcesAndInstructionsUnchanged:true,firstTrayFixRetained:true,scope:'Compose-only lifetime double buffering via new show export. Original main/settings/print routes, DPI/fonts/HTML and startup code remain unchanged. Actual CEF paint and speed pending user verification.',visualAccepted:false},null,2));console.log(JSON.stringify({sha:sha(out),helperSHA256,changedExeBytes:changed}));
