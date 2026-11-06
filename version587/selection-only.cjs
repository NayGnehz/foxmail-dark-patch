'use strict';
// Controlled regression rollback: pre-edge/pre-shell executable plus colors only.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const paths=require('../foxmail-paths.cjs'),stage=paths.output('version587-selection-only');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const base=JSON.parse(fs.readFileSync(path.join(paths.output('version587-reveal'),'validation.json'),'utf8'));
const prior=JSON.parse(fs.readFileSync(path.join(paths.output('version587-next'),'validation.json'),'utf8'));
const input=fs.readFileSync(base.dest);assert.equal(sha(input),'aba62e036d6ba41d46eaf63e3036488143a707458ff20cbefebb567816e3b78d');
const out=Buffer.from(input);let changed=0;
for(const p of prior.palette){assert.equal(input.readUInt32LE(p.offset),p.before);assert.equal(input[p.offset-1],0x68);out.writeUInt32LE(p.after,p.offset);}
for(let i=0;i<input.length;i++)if(input[i]!==out[i]){assert(prior.palette.some(p=>i>=p.offset&&i<p.offset+4));changed++;}
// No PE/header/resource/manifest/startup/drawing hook delta in this candidate.
assert.equal(input.length,out.length);
const pe=input.readUInt32LE(60),op=pe+24,so=op+input.readUInt16LE(pe+20),sections=[];
for(let i=0;i<input.readUInt16LE(pe+6);i++){const p=so+40*i;sections.push({name:input.toString('ascii',p,p+8).replace(/\0/g,''),raw:input.readUInt32LE(p+20),size:input.readUInt32LE(p+16)});}
for(const s of sections.filter(s=>s.name!=='CODE'))assert(input.subarray(s.raw,s.raw+s.size).equals(out.subarray(s.raw,s.raw+s.size)));
assert(input.subarray(0,sections[0].raw).equals(out.subarray(0,sections[0].raw)));
const oldTemplate=path.join(paths.output('version587-next'),'rollback',prior.template.relative),t=fs.readFileSync(oldTemplate);assert.equal(sha(t),prior.template.beforeSHA256);
const dest=path.join(stage,'Foxmail深色.exe');fs.writeFileSync(dest,out);
const report={dest,candidateSHA256:sha(out),baselineSource:base.dest,baselineSHA256:sha(input),changedBytes:changed,palette:prior.palette,scope:'Exact pre-regression EXE plus four immediate selection colors only. Header, manifest/resources, all native/API/reveal/startup code identical to pre-edge baseline.',template:{relative:prior.template.relative,source:oldTemplate,beforeSHA256:prior.template.afterSHA256,afterSHA256:sha(t)},current:{exe:prior.dest,exeSHA256:prior.candidateSHA256,template:prior.template.source},visualAccepted:false};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({sha:sha(out),changedBytes:changed,headersAndManifestUnchanged:true,removed:'Edge startup/wrapper and early root LINK'}));
