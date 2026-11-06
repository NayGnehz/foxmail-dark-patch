'use strict';
// Keep the first default activation, but suppress its system-frame painting on
// the exact skinned main form. All subsequent application painting is retained.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),stage=paths.output('version587-main-ncactivate');
const input=path.join(paths.output('version587-notification'),'Foxmail深色.exe'),b=fs.readFileSync(input);
assert.equal(sha(b),'ce79d169ad6f908a4607ccc160efb17ce21b6afbcb9b8d1018c17331fff06c4a');
const pe=b.readUInt32LE(60),op=pe+24,ns=b.readUInt16LE(pe+6),so=op+b.readUInt16LE(pe+20),base=b.readUInt32LE(op+28),ss=[];
assert.equal(base,0x400000);assert.equal(b.readUInt16LE(pe+4),0x14c);
for(let i=0;i<ns;i++){const p=so+i*40;ss.push({r:b.readUInt32LE(p+12),p:b.readUInt32LE(p+20),n:b.readUInt32LE(p+16),v:b.readUInt32LE(p+8)});}
const off=r=>{const s=ss.find(s=>r>=s.r&&r<s.r+s.n);assert(s);return s.p+r-s.r;};
const vmtRva=0xfdd0ac-base,siteRva=0xa166e7-base;
assert.equal(b.readUInt32LE(off(vmtRva-76)),base+vmtRva);
assert.equal(b.readUInt32LE(off(vmtRva-40)),1368);
assert.equal(b.readUInt32LE(off(vmtRva-16)),0xa18318);
assert.equal(b.subarray(off(siteRva),off(siteRva)+5).toString('hex'),'8b08ff51f0');
assert.equal(b.subarray(off(0xa166cc-base),off(siteRva)).toString('hex'),'8b45fc80b8fd03000000741e8b45f88378040074158b55f88b45fc');
assert.equal(b.subarray(off(siteRva)+5,off(siteRva)+15).toString('hex'),'8b45fcc680fd03000000');
const align=(x,a)=>Math.ceil(x/a)*a,sa=b.readUInt32LE(op+32),fa=b.readUInt32LE(op+36);
const rva=align(Math.max(...ss.map(s=>s.r+Math.max(s.n,s.v))),sa),raw=align(b.length,fa);
assert(so+(ns+1)*40<=Math.min(...ss.filter(s=>s.p).map(s=>s.p)));
const code=[],jumps=[],labels={},byte=(...x)=>code.push(...x),u32=x=>{const v=Buffer.alloc(4);v.writeUInt32LE(x>>>0);byte(...v);};
const branch=op=>{byte(0x0f,op);jumps.push(code.length);u32(0);};
byte(0x9c,0x53,0xe8,0,0,0,0,0x5b,0x81,0xeb);u32(rva+7); // preserve flags/EBX; image base
byte(0x8d,0x8b);u32(vmtRva);byte(0x39,0x08);branch(0x85); // exact TFoxMainFrm
byte(0x80,0xb8);u32(0x22b);byte(1);branch(0x84); // minimized: keep default paint
byte(0x81,0x3a);u32(0x86);branch(0x85); // WM_NCACTIVATE only
byte(0x83,0x7a,4,0);branch(0x84); // activation only
byte(0xf0,0xff,0x83);const counterOperand=code.length;u32(0);
byte(0x5b,0x9d,0xff,0x72,8,0x52,0xc7,0x42,8);u32(0xffffffff);
byte(0x8b,0x08,0xff,0x51,0xf0); // original virtual default call, same Self/message
// Preserve every output register and arithmetic flag while restoring lParam.
byte(0x9c,0x50,0x52,0x8b,0x54,0x24,12,0x8b,0x44,0x24,16,0x89,0x42,8,0x5a,0x58,0x9d,0x8d,0x64,0x24,8,0xc3);
labels.fallback=code.length;byte(0x5b,0x9d,0x8b,0x08,0xff,0x61,0xf0);
const stub=Buffer.from(code),counterRva=rva+align(stub.length,4);
stub.writeUInt32LE(counterRva,counterOperand);
for(const at of jumps)stub.writeInt32LE(labels.fallback-at-4,at);
const replacement=Buffer.alloc(5);replacement[0]=0xe8;replacement.writeInt32LE(rva-siteRva-5,1);
const virtualSize=counterRva-rva+4,out=Buffer.alloc(raw+align(virtualSize,fa));b.copy(out);stub.copy(out,raw);replacement.copy(out,off(siteRva));
const sh=so+ns*40;out.fill(0,sh,sh+40);out.write('.fxnca',sh,'ascii');
for(const [k,v]of [[8,virtualSize],[12,rva],[16,out.length-raw],[20,raw],[36,0xe0000020]])out.writeUInt32LE(v,sh+k);
out.writeUInt16LE(ns+1,pe+6);out.writeUInt32LE(align(rva+virtualSize,sa),op+56);out.writeUInt32LE(0,op+64);
const allowed=[[pe+6,pe+8],[op+56,op+60],[op+64,op+68],[sh,sh+40],[off(siteRva),off(siteRva)+5]];
let changed=0;for(let i=0;i<b.length;i++)if(b[i]!==out[i]){assert(allowed.some(([a,z])=>i>=a&&i<z));changed++;}
const candidateSHA256=sha(out),dest=path.join(stage,'Foxmail深色.exe');fs.writeFileSync(dest,out);
const header=['/* Generated actual candidate bytes; own-process fixture only. */',`#define FX_NCA_SECTION_RVA ${rva}u`,`#define FX_NCA_COUNTER_RVA ${counterRva}u`,`#define FX_NCA_VMT_RVA ${vmtRva}u`,`#define FX_NCA_SITE_RVA ${siteRva}u`,`#define FX_CANDIDATE_SHA "${candidateSHA256}"`,`static const unsigned char nca_stub[] = {${[...stub].join(',')}};`,`static const unsigned char nca_site[] = {${[...replacement].join(',')}};`].join('\n');
fs.writeFileSync(path.join(stage,'main-ncactivate-stub.h'),header+'\n');
const report={input,baselineSHA256:sha(b),dest,candidateSHA256,sectionRva:rva,sectionRaw:raw,counterRva,siteRva,vmtRva,stubHex:stub.toString('hex'),siteHex:replacement.toString('hex'),originalChangedBytes:changed,originalEntryUnchanged:out.readUInt32LE(op+16)===b.readUInt32LE(op+16),onlyOriginalCodeSite:[siteRva,5],helperSHA256:'29efc7d9ec5b402f6a00a165a586f0762ec51aa2495cdcdc8e0a5fb31bc05515',cssSHA256:'8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8',scope:'At the existing first-activation default call only, exact non-minimized TFoxMainFrm and WM_NCACTIVATE(TRUE) receive temporary lParam=-1. Original default processing and dark skin painting remain. Other forms/messages forward unchanged. One numeric counter; no content, timers, startup APIs, DPI or asset changes.',visualAccepted:false};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
