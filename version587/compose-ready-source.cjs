'use strict';
// Compose-only asynchronous handoff, generated from the exact accepted cold helper.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert'),paths=require('../foxmail-paths.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceDir=paths.output('version587-compose-ready-source'),stage=paths.output('version587-compose-ready');
const baselineDir=paths.output('version587-goal-cold-source'),sourceInput=path.join(baselineDir,'foxmail_reveal_gate.c');
const sourceBytes=fs.readFileSync(sourceInput),baselineSourceSHA256='112551b31e0f81adf0fe8b9d74befdfa770c70aef18700bb344a0cea59dcfb77';
assert.equal(sha(sourceBytes),baselineSourceSHA256);
const helperInput=path.join(paths.output('version587-goal-native'),'FoxmailRevealGate.dll');
const baselineHelperSHA256='29efc7d9ec5b402f6a00a165a586f0762ec51aa2495cdcdc8e0a5fb31bc05515';
assert.equal(sha(fs.readFileSync(helperInput)),baselineHelperSHA256);
const mapPath=path.join(paths.output('version587-goal'),'canvas-map.json'),map=JSON.parse(fs.readFileSync(mapPath,'utf8').replace(/^\uFEFF/,''));
const atoms=[0xefa1b6,0xefa1b4,0xef6b80,0xef6b7e];
assert.deepEqual(map.atoms.map(x=>x.newRVA),atoms);
const api=fs.readFileSync(path.join(__dirname,'compose-ready-api.h'),'utf8');
for(let i=0;i<4;i++)assert(api.includes(`#define FX_READY_ATOM${i+1}_RVA 0x${atoms[i].toString(16).toUpperCase()}UL`));
let c=sourceBytes.toString('utf8');const changes=[];
function replace(before,after,label){assert.equal(c.split(before).length,2,label);c=c.replace(before,after);changes.push({label,before,after});}
replace('static void mark_completed_lifetime(', '#include "compose-ready-async.h"\nstatic void mark_completed_lifetime(', 'include independent async implementation');
replace('    int yes = 1, eligible = 0, returned = 0, completed = 0;', '    int yes = 1, eligible = 0, returned = 0, completed = 0;\n    FX_READY_SLOT *ready_slot = 0;', 'one local compose handoff token');
replace('            result = call_original(invoke, context, incoming);', '            if (kind == KIND_COMPOSE && eligible && recovery.owned && owns_record()) ready_slot = ready_prepare();\n            result = call_original(invoke, context, incoming);', 'compose-only prepare before original');
replace('            completed = 1;', '            if (ready_slot) ready_adopt(ready_slot);\n            completed = 1;', 'transfer only after original and synchronous redraw return');
replace('            if (!completed) INC(unwinds);\n            release_record();', '            if (!completed) INC(unwinds);\n            ready_cancel_prepared(ready_slot);\n            release_record();', 'prepared state cleanup inside original SEH finally');
// Reverse the five explicit substitutions and require byte-identical baseline source.
let reversed=c;for(const x of [...changes].reverse()){assert.equal(reversed.split(x.after).length,2);reversed=reversed.replace(x.after,x.before);}
assert.equal(sha(Buffer.from(reversed)),baselineSourceSHA256);
assert(c.includes('FxColdRun(FXG_HWND hwnd, FXG_INVOKE invoke, void *context)'));
assert(!c.includes('#define FXG_COMPOSE_SURFACE_EXPERIMENT'));
fs.writeFileSync(path.join(sourceDir,'foxmail_reveal_gate.c'),c);
fs.copyFileSync(path.join(baselineDir,'foxmail_reveal_gate.h'),path.join(sourceDir,'foxmail_reveal_gate.h'));
const report={sourceInput,sourceDir,baselineSourceSHA256,sourceSHA256:sha(c),helperInput,baselineHelperSHA256,
 generatorSHA256:sha(fs.readFileSync(__filename)),apiSHA256:sha(api),asyncSHA256:sha(fs.readFileSync(path.join(__dirname,'compose-ready-async.h'))),
 atomMapPath:mapPath,atomMapSHA256:sha(fs.readFileSync(mapPath)),atomRVA:atoms,
 reversibleTransformVerified:true,nonComposeRoutingAndOriginalCleanupPreserved:true,FxColdRunPreserved:true,
 changes:changes.map(x=>x.label),scope:'Independent compose owner slots; no wait/sleep/message-pump in Show. Fresh entry waits for owner-specific LoadEnd; prior lifetime latch still requires full surface and a posted UI boundary. UI timer deadline is not a wall-clock guarantee.'};
fs.writeFileSync(path.join(stage,'source-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
