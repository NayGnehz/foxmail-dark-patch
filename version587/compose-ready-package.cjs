'use strict';
// Bind the independently checked bridge and native helper into one candidate.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const stage=paths.output('version587-compose-ready');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hash=p=>sha(fs.readFileSync(p));
const files=new Map();
function bind(p,wanted){const actual=hash(p);assert.equal(actual,wanted.toLowerCase(),p);files.set(p,actual);}
function report(name){const p=path.join(stage,name),bytes=fs.readFileSync(p);files.set(p,sha(bytes));return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));}
const source=report('source-audit.json'),bridge=report('bridge-validation.json'),abi=report('bridge-abi-validation.json'),native=report('native-validation.json');
const baselineSHA256='4ca3440e7da018de28d3b920f93ba38af3f8500d1a767a7c091430577b6853c3';
const baselineHelperSHA256='29efc7d9ec5b402f6a00a165a586f0762ec51aa2495cdcdc8e0a5fb31bc05515';
assert.equal(bridge.baselineSHA256,baselineSHA256);assert.equal(source.baselineHelperSHA256,baselineHelperSHA256);
assert(source.reversibleTransformVerified&&source.nonComposeRoutingAndOriginalCleanupPreserved&&source.FxColdRunPreserved);
assert(bridge.originalEntryUnchanged&&bridge.oldGatePayloadUnchanged&&bridge.oldNcaPayloadUnchanged&&bridge.allOriginalPayloadsExceptCallUnchanged);
assert.deepEqual(bridge.onlyOriginalCodeSite,[0x7842fc,5]);
bind(bridge.input,baselineSHA256);bind(bridge.dest,bridge.candidateSHA256);
bind(source.helperInput,baselineHelperSHA256);bind(source.sourceInput,source.baselineSourceSHA256);
bind(path.join(source.sourceDir,'foxmail_reveal_gate.c'),source.sourceSHA256);
bind(path.join(__dirname,'compose-ready-source.cjs'),source.generatorSHA256);
bind(path.join(__dirname,'compose-ready-async.h'),source.asyncSHA256);
bind(path.join(__dirname,'compose-ready-api.h'),source.apiSHA256);
bind(source.atomMapPath,source.atomMapSHA256);
bind(path.join(__dirname,'compose-ready-bridge.cjs'),bridge.generatorSHA256);
bind(path.join(paths.output('version587-goal'),'compose-ready-map.json'),bridge.proofSHA256);
assert(abi.passed&&abi.fixtureExitCode===0&&abi.nestedCallsTested&&abi.expectedCases>=3840);
assert.equal(abi.candidateSHA256,bridge.candidateSHA256);
assert.equal(abi.generatorSHA256.toLowerCase(),bridge.generatorSHA256);
bind(path.join(__dirname,'verify-compose-ready-bridge.c'),abi.sourceSHA256);
bind(path.join(stage,'compose-ready-bridge-stub.h'),abi.headerSHA256);
bind(path.join(stage,'verify-compose-ready-bridge.exe'),abi.fixtureSHA256);
assert(native.passed&&native.runs.length===2);
assert.deepEqual(native.runs.map(x=>path.basename(x.file)).sort(),['verify-fixture.exe','verify-production.exe']);
for(const run of native.runs){assert.equal(run.exitCode,0);bind(run.file,run.sha256);}
for(const [p,wanted]of Object.entries(native.sourceHashes))bind(p,wanted);
for(const p of ['verify-compose-ready.c','compose-ready-async.h','compose-ready-api.h'])assert(native.sourceHashes[path.join(__dirname,p)]);
assert.equal(native.sourceHashes[path.join(source.sourceDir,'foxmail_reveal_gate.c')].toLowerCase(),source.sourceSHA256);
assert.equal(path.resolve(native.dll),path.join(stage,'FoxmailRevealGate.dll'));
bind(native.dll,native.dllSHA256);
assert.equal(native.sehAudit.length,3);
for(const item of native.sehAudit){
 assert(item.noSehCleared&&!(item.changedMask&~0x400));
 const b=fs.readFileSync(item.artifact),pe=b.readUInt32LE(60);
 assert.equal(b.readUInt16LE(pe+4),0x14c);assert(!(b.readUInt16LE(pe+24+70)&0x400));
 assert(files.has(item.artifact));
}
for(const name of ['check-compose-ready.ps1','check-compose-ready-bridge.ps1',path.basename(__filename)]){
 const p=path.join(__dirname,name);files.set(p,hash(p));
}
const result={passed:true,input:bridge.input,dest:bridge.dest,baselineSHA256,candidateSHA256:bridge.candidateSHA256,
 helperInput:source.helperInput,helper:native.dll,baselineHelperSHA256,helperSHA256:native.dllSHA256.toLowerCase(),
 bridgeCases:abi.expectedCases,nativeOwnWindowsPassed:true,productionHelperPassed:true,
 originalEntryUnchanged:true,acceptedBorderPayloadsPreserved:true,FxColdRunPreserved:true,
 bridgeExceptionUnwindTested:abi.exceptionUnwindTested,visualAccepted:false,
 validatedFiles:[...files].map(([path,sha256])=>({path,sha256})),
 scope:'Compose-only asynchronous handoff and one main-frame LoadEnd bridge. No presize, arbitrary sleep, UI message pumping or mail-content access. LoadEnd/surface/posted UI boundary remain a candidate readiness condition, not a presentation acknowledgement.'};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({passed:true,candidateSHA256:result.candidateSHA256,helperSHA256:result.helperSHA256,bridgeCases:result.bridgeCases,validatedFiles:files.size}));
