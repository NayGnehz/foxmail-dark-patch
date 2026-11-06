'use strict';
// Observe the inherited Paint dispatch without suppressing or replacing painting.
// No API calls, startup code, waits, window messages, pixels or user content.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),stage=paths.output('version587-account-counter');
const input=path.join(paths.output('version587-notification'),'Foxmail深色.exe'),b=fs.readFileSync(input);
assert.equal(sha(b),'ce79d169ad6f908a4607ccc160efb17ce21b6afbcb9b8d1018c17331fff06c4a');
const pe=b.readUInt32LE(60),op=pe+24,ns=b.readUInt16LE(pe+6),so=op+b.readUInt16LE(pe+20),base=b.readUInt32LE(op+28),ss=[];
assert.equal(base,0x400000);assert.equal(b.readUInt16LE(pe+4),0x14c);
for(let i=0;i<ns;i++){const p=so+i*40;ss.push({r:b.readUInt32LE(p+12),p:b.readUInt32LE(p+20),n:b.readUInt32LE(p+16),v:b.readUInt32LE(p+8)});}
const off=r=>{const s=ss.find(s=>r>=s.r&&r<s.r+s.n);assert(s);return s.p+r-s.r;};
const vmt=0xb6a5e8,slot=vmt-base+0xc8,target=0x87aebc-base;
assert.equal(b.readUInt32LE(off(vmt-base-76)),vmt);assert.equal(b.readUInt32LE(off(vmt-base-40)),536);
assert.equal(b.readUInt32LE(off(slot)),target+base);
assert.equal(b.subarray(off(target),off(target)+12).toString('hex'),'558bec518945fca1a4bc2e01');
let slotRelocated=false;const rr=b.readUInt32LE(op+136),rn=b.readUInt32LE(op+140);
if(rr&&rn){for(let p=off(rr),end=p+rn;p<end;){const page=b.readUInt32LE(p),n=b.readUInt32LE(p+4);assert(n>=8&&p+n<=end);for(let q=p+8;q<p+n;q+=2){const x=b.readUInt16LE(q);if((x>>>12)===3&&page+(x&4095)===slot)slotRelocated=true;}p+=n;}}
assert(slotRelocated||((b.readUInt16LE(pe+22)&1)&&!(b.readUInt16LE(op+70)&0x40)),'VMT pointer relocation not proved');
const align=(x,a)=>Math.ceil(x/a)*a,sa=b.readUInt32LE(op+32),fa=b.readUInt32LE(op+36);
const rva=align(Math.max(...ss.map(s=>s.r+Math.max(s.n,s.v))),sa),raw=align(b.length,fa),counterRva=rva+32;
assert(so+(ns+1)*40<=Math.min(...ss.filter(s=>s.p).map(s=>s.p)));
const stub=Buffer.from('9c50e800000000582d00000000f0ff8000000000589de900000000','hex');
assert.equal(stub.length,27);stub.writeUInt32LE(rva+7,9);stub.writeUInt32LE(counterRva,16);stub.writeInt32LE(target-(rva+27),23);
const out=Buffer.alloc(raw+align(36,fa));b.copy(out);stub.copy(out,raw);
const sh=so+ns*40;out.fill(0,sh,sh+40);out.write('.fxacnt',sh,'ascii');
for(const [k,v]of [[8,36],[12,rva],[16,out.length-raw],[20,raw],[36,0xe0000020]])out.writeUInt32LE(v,sh+k);
out.writeUInt16LE(ns+1,pe+6);out.writeUInt32LE(align(rva+36,sa),op+56);out.writeUInt32LE(0,op+64);out.writeUInt32LE(base+rva,off(slot));
const allowed=[[pe+6,pe+8],[op+56,op+60],[op+64,op+68],[sh,sh+40],[off(slot),off(slot)+4]];
for(let i=0;i<b.length;i++)if(b[i]!==out[i])assert(allowed.some(([a,z])=>i>=a&&i<z));
const candidateSHA256=sha(out),dest=path.join(stage,'Foxmail深色.exe');fs.writeFileSync(dest,out);
const header=['/* Generated actual candidate stub; test fixture only. */',`#define FX_COUNTER_SECTION_RVA ${rva}u`,`#define FX_COUNTER_RVA ${counterRva}u`,`#define FX_COUNTER_TARGET_RVA ${target}u`,`#define FX_CANDIDATE_SHA "${candidateSHA256}"`,`static const unsigned char counter_stub[] = {${[...stub].join(',')}};`].join('\n');
fs.writeFileSync(path.join(stage,'counter-stub.h'),header+'\n');
const report={input,baselineSHA256:sha(b),dest,candidateSHA256,sectionRva:rva,sectionRaw:raw,counterRva,targetRva:target,slotRva:slot,slotRelocated,stubHex:stub.toString('hex'),helperSHA256:'29efc7d9ec5b402f6a00a165a586f0762ec51aa2495cdcdc8e0a5fb31bc05515',cssSHA256:'8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8',originalEntryUnchanged:out.readUInt32LE(op+16)===b.readUInt32LE(op+16),allOriginalPaintingCodeUnchanged:true,scope:'All exact TFMGroupBox inherited Paint dispatches increment one DWORD then tail-jump to the original method. No painting removed. No content, handles or object data recorded. Counter alone cannot identify which instance painted.',visualFix:false};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
