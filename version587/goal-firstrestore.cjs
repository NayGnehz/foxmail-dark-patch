'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const stage=paths.output('version587-goal'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const baseFile=path.join(paths.output('version587-selection-only'),'Foxmail深色.exe'),input=fs.readFileSync(baseFile);assert.equal(sha(input),'7fca5528dd9d54956d929dc733ba60b049c0db6ded16f226f0a3821376d4a65e');
const meta=JSON.parse(fs.readFileSync(path.join(paths.output('version587-reveal'),'Foxmail深色.exe.json'),'utf8'));
const pe=input.readUInt32LE(60),op=pe+24,so=op+input.readUInt16LE(pe+20);let pos;
for(let i=0;i<input.readUInt16LE(pe+6);i++){const p=so+40*i,r=input.readUInt32LE(p+12),n=input.readUInt32LE(p+16);if(meta.labels.main_exportName>=r&&meta.labels.main_exportName<r+n)pos=input.readUInt32LE(p+20)+meta.labels.main_exportName-r;}
assert(Number.isInteger(pos));assert.equal(input.toString('ascii',pos,pos+10),'FxGateRun\0');
const out=Buffer.from(input);out.write('FxColdRun\0',pos,'ascii');let changed=0;for(let i=0;i<input.length;i++)if(input[i]!==out[i]){assert(i>=pos&&i<pos+10);changed++;}assert.equal(changed,4);
const native=paths.output('version587-goal-native'),dll=path.join(native,'FoxmailRevealGate.dll'),helperSHA256=sha(fs.readFileSync(dll));
for(const [name,token]of [['verify_reveal_gate','PASS: 1122 checks, 0 failures'],['verify_production_dll','PASS: production DLL 171 checks, 0 failures']])assert(fs.readFileSync(path.join(native,name+'.log'),'utf8').includes(token));
const dest=path.join(stage,'Foxmail深色-firstrestore.exe');fs.writeFileSync(dest,out);
fs.writeFileSync(dest+'.json',JSON.stringify({...meta,baseline:baseFile,baselineSHA256:sha(input),candidateSHA256:sha(out),mainExportOverride:'FxColdRun'},null,2));
const report={dest,candidateSHA256:sha(out),baselineSHA256:sha(input),helper:dll,helperSHA256,changedExeBytes:changed,exportNameOffset:pos,codeHeadersAndResourcesUnchanged:true,allOldHelperExportsKeepColdPolicy:true,newMainExport:'FxColdRun',visualAccepted:false};
fs.writeFileSync(path.join(stage,'firstrestore-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
