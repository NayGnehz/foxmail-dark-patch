'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),vm=require('vm'),crypto=require('crypto');
const paths=require('../foxmail-paths.cjs'),stage=paths.output('version587-reveal'),previous=paths.output('version587-borders');
const plan=JSON.parse(fs.readFileSync(path.join(previous,'validation.json'),'utf8'));
const mappings=JSON.parse(fs.readFileSync(path.join(paths.output('version587'),'native-map.json'),'utf8'));
const code=new Map(mappings.code.map(x=>[x.oldVA,x.newVA])),vmt=new Map(mappings.vmt.map(x=>[x.oldVA,x.newVA]));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(sha(fs.readFileSync(plan.dest)),plan.candidateSHA256);
const requireVA=(m,a)=>{assert(m.has(a));return m.get(a)-0x400000;};
let src=fs.readFileSync(path.join(paths.project,'build-reveal-gate-v2.cjs'),'utf8');
src=src.replace("const expected='75d86c85b9d5bc568248626170b776eef58f29e26b2f21c28f48025ade7d7f85'",'const expected='+JSON.stringify(plan.candidateSHA256));
for(const va of [0xfdff2c,0x11214b4,0x111d5a4])src=src.replace(new RegExp('0x'+(va-0x400000).toString(16)+'\\b','g'),'0x'+requireVA(code,va).toString(16));
const match="byte(0x8d,0x93);u32(0x9cd254);byte(0x39,0x10);R([0x0f,0x85],'fallback');";
assert(src.includes(match));
src=src.replace(match,
 `byte(0x8d,0x93);u32(${requireVA(vmt,0xdcd254)});byte(0x39,0x10);R([0x0f,0x84],'kindAccepted');`+
 `byte(0x8d,0x93);u32(${requireVA(vmt,0xb71e64)});byte(0x39,0x10);R([0x0f,0x84],'kindAccepted');`+
 `byte(0x8d,0x93);u32(${requireVA(vmt,0xd0aeb8)});byte(0x39,0x10);R([0x0f,0x85],'fallback');M('kindAccepted');`);
const dest=path.join(stage,'Foxmail深色.exe'),argv=process.argv;
try{process.argv=[process.execPath,'build-reveal-gate-v2.cjs',plan.dest,dest];vm.runInNewContext(src,{require,Buffer,process,console},{filename:'587-reveal-bridge.cjs'});}finally{process.argv=argv;}
const dll=path.join(paths.temp,'..','..','compose-surface-20261105','temp/native-compose-surface/rollback/FoxmailRevealGate.dll');
const helper=fs.readFileSync(dll);assert.equal(sha(helper),'c1821caffcdccc4f52e67f397208de70bb38728c16b447ad3bf159bcff936082');fs.writeFileSync(path.join(stage,'FoxmailRevealGate.dll'),helper);
const meta=JSON.parse(fs.readFileSync(dest+'.json','utf8'));
const audit={sourceVersion:'7.2.25.587',inputSHA256:plan.candidateSHA256,candidateSHA256:sha(fs.readFileSync(dest)),dest,helperSHA256:sha(helper),helper:path.join(stage,'FoxmailRevealGate.dll'),hooks:meta.hooks,settingsAllowlist:mappings.vmt.filter(x=>[0xdcd254,0xb71e64,0xd0aeb8].includes(x.oldVA)),waitBudgetAdded:false,scope:'Original synchronous show gate with new587 guarded method/VMT addresses. Prior48ms experimental wait is excluded. Render completion is not guaranteed.',visualAccepted:false};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(audit,null,2));
