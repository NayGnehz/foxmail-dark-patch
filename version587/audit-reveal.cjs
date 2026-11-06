'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const paths=require('../foxmail-paths.cjs'),stage=paths.output('version587-reveal');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const evidence=JSON.parse(fs.readFileSync(path.join(stage,'validation.json'),'utf8'));
const meta=JSON.parse(fs.readFileSync(evidence.dest+'.json','utf8'));
const input=fs.readFileSync(meta.baseline),out=fs.readFileSync(evidence.dest);
assert.equal(sha(input),evidence.inputSHA256);assert.equal(sha(out),evidence.candidateSHA256);
assert.equal(sha(fs.readFileSync(evidence.helper)),evidence.helperSHA256);
const pe=input.readUInt32LE(60),op=pe+24,so=op+input.readUInt16LE(pe+20),ns=input.readUInt16LE(pe+6);
const sections=Array.from({length:ns},(_,i)=>{const p=so+40*i;return {r:input.readUInt32LE(p+12),p:input.readUInt32LE(p+20),n:input.readUInt32LE(p+16)};});
const offset=r=>{const s=sections.find(s=>r>=s.r&&r<s.r+s.n);assert(s);return s.p+r-s.r;};
const ranges=[[pe+6,pe+8],[op+16,op+20],[op+56,op+60],[op+64,op+68],[so+ns*40,so+(ns+1)*40]];
for(const h of meta.hooks){const p=offset(h.rva),n=h.stolenHex.length/2;assert.equal(input.subarray(p,p+n).toString('hex'),h.stolenHex);assert.equal(out[p],0xe9);assert.equal(out.readInt32LE(p+1)+h.rva+5,meta.labels[h.name+'_hook']);ranges.push([p,p+n]);}
let changed=0;for(let i=0;i<input.length;i++)if(input[i]!==out[i]){assert(ranges.some(([a,b])=>i>=a&&i<b),'Unexpected original-file delta at '+i);changed++;}
assert.equal(out.readUInt16LE(pe+6),ns+1);assert.equal(out.readUInt32LE(op+16),meta.labels.entry);
assert.equal(out.toString('ascii',so+ns*40,so+ns*40+7),'.fxgate');
assert.equal(out.readUInt32LE(so+ns*40+12),meta.sectionRva);assert.equal(out.readUInt32LE(so+ns*40+20),meta.sectionRaw);
assert.equal(out.readUInt32LE(so+ns*40+8),meta.codeBytes);
assert(out.subarray(input.length,meta.sectionRaw).every(x=>x===0));
assert(out.subarray(meta.sectionRaw+meta.codeBytes).every(x=>x===0));
const bridge=JSON.parse(fs.readFileSync(path.join(stage,'bridge-tests.json'),'utf8'));assert.equal(bridge.passed,true);
for(const [file,token]of [['native-api-tests.log','PASS: startup + 62100'],['initial-erase-tests.log','PASS 1509']])assert(fs.readFileSync(path.join(stage,file),'utf8').includes(token));
const audit={passed:true,candidateSHA256:sha(out),helperSHA256:evidence.helperSHA256,originalFileChangedBytes:changed,allowedOriginalRanges:ranges,appendedSection:'.fxgate',bridgeCases:bridge.cases.length+bridge.entryCases.length+bridge.extraCases.length,apiChecks:62100,eraseChecks:1509,visualAccepted:false,limits:'Own isolated code/ABI fixtures only. No live Foxmail UI or asynchronous CEF-frame acceptance is inferred.'};
fs.writeFileSync(path.join(stage,'final-audit.json'),JSON.stringify(audit,null,2));console.log(JSON.stringify(audit));
