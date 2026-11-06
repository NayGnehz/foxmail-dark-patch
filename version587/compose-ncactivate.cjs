'use strict';
// Extend the accepted first-default-activation protection to exact compose forms.
// Every fallback executes the existing, byte-preserved main-window stub.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),stage=paths.output('version587-compose-ncactivate');
const input=path.join(paths.output('version587-main-ncactivate'),'Foxmail深色.exe'),b=fs.readFileSync(input);
const baselineSHA256='f8f4732d8fd74411c6bed7306041d02cbdcb4bad604eb3dc265b4fa6f7d03f82';
assert.equal(sha(b),baselineSHA256);
const pe=b.readUInt32LE(60),op=pe+24,ns=b.readUInt16LE(pe+6),so=op+b.readUInt16LE(pe+20),base=b.readUInt32LE(op+28),ss=[];
assert.equal(base,0x400000);assert.equal(b.readUInt16LE(pe+4),0x14c);assert.equal(b.readUInt16LE(op),0x10b);
for(let i=0;i<ns;i++){const p=so+i*40;ss.push({name:b.toString('ascii',p,p+8).replace(/\0/g,''),r:b.readUInt32LE(p+12),p:b.readUInt32LE(p+20),n:b.readUInt32LE(p+16),v:b.readUInt32LE(p+8)});}
const off=r=>{const s=ss.find(s=>r>=s.r&&r<s.r+s.n);assert(s,'Unmapped RVA');return s.p+r-s.r;};
const read=va=>b.readUInt32LE(off(va-base));
const className=v=>{const p=off(read(v-44)-base);return b.toString('ascii',p+1,p+1+b[p]);};
const vmtRva=0xd0b0c4-base,mainVmtRva=0xfdd0ac-base,siteRva=0xa166e7-base;
assert.equal(read(base+vmtRva-76),base+vmtRva);assert.equal(read(base+vmtRva-40),1768);
assert.equal(className(base+vmtRva),'TFoxComposeForm');assert.equal(read(base+vmtRva-16),0xa18318);
// Resolve the actual dynamic message table, including inherited dispatch.
const dispatchProof=[];let handler=0;
for(let v=base+vmtRva;v;){
 assert.equal(read(v-76),v);const table=read(v-48);let found=0;
 if(table){const count=b.readUInt16LE(off(table-base));assert(count<4096);
  for(let i=0;i<count;i++)if(b.readUInt16LE(off(table+2+2*i-base))===0x86){assert.equal(found,0);found=read(table+2+2*count+4*i);}}
 dispatchProof.push({className:className(v),vmtVA:v,wmNCActivate:found||null});
 if(found){handler=found;break;}const parentRef=read(v-36);v=parentRef?read(parentRef):0;
 assert(dispatchProof.length<32);
}
assert.equal(handler,0xa16698,'Compose must inherit the verified first-activation handler');
assert.equal(b.subarray(off(0xa166cc-base),off(siteRva)).toString('hex'),'8b45fc80b8fd03000000741e8b45f88378040074158b55f88b45fc');
assert.equal(b.subarray(off(siteRva)+5,off(siteRva)+15).toString('hex'),'8b45fcc680fd03000000');
assert.equal(b[off(siteRva)],0xe8);
const oldEntryRva=siteRva+5+b.readInt32LE(off(siteRva)+1),oldSection=ss.find(s=>s.name==='.fxnca');
assert(oldSection&&oldSection.r===oldEntryRva);assert(oldSection.v>=100&&oldSection.v<512);
const mainCounterRva=oldSection.r+oldSection.v-4;assert.equal(mainCounterRva%4,0);assert.equal(b.readUInt32LE(off(mainCounterRva)),0);
const oldStub=b.subarray(off(oldEntryRva),off(mainCounterRva));
const align=(x,a)=>Math.ceil(x/a)*a,sa=b.readUInt32LE(op+32),fa=b.readUInt32LE(op+36);
const rva=align(Math.max(...ss.map(s=>s.r+Math.max(s.n,s.v))),sa),raw=align(b.length,fa);
assert(so+(ns+1)*40<=Math.min(...ss.filter(s=>s.p).map(s=>s.p)));
const code=[],jumps=[],byte=(...x)=>code.push(...x),u32=x=>{const v=Buffer.alloc(4);v.writeUInt32LE(x>>>0);byte(...v);};
const branch=op=>{byte(0x0f,op);jumps.push(code.length);u32(0);};
byte(0x9c,0x53,0xe8,0,0,0,0,0x5b,0x81,0xeb);u32(rva+7);
byte(0x8d,0x8b);u32(vmtRva);byte(0x39,0x08);branch(0x85);
byte(0x80,0xb8);u32(0x22b);byte(1);branch(0x84);
byte(0x81,0x3a);u32(0x86);branch(0x85);
byte(0x83,0x7a,4,0);branch(0x84);
byte(0xf0,0xff,0x83);const counterOperand=code.length;u32(0);
byte(0x5b,0x9d,0xff,0x72,8,0x52,0xc7,0x42,8);u32(0xffffffff);
byte(0x8b,0x08,0xff,0x51,0xf0);
byte(0x9c,0x50,0x52,0x8b,0x54,0x24,12,0x8b,0x44,0x24,16,0x89,0x42,8,0x5a,0x58,0x9d,0x8d,0x64,0x24,8,0xc3);
const fallback=code.length;byte(0x5b,0x9d,0xe9);u32(oldEntryRva-(rva+code.length+4));
const stub=Buffer.from(code),counterRva=rva+align(stub.length,4);stub.writeUInt32LE(counterRva,counterOperand);
for(const at of jumps)stub.writeInt32LE(fallback-at-4,at);
const replacement=Buffer.alloc(5);replacement[0]=0xe8;replacement.writeInt32LE(rva-siteRva-5,1);
const virtualSize=counterRva-rva+4,out=Buffer.alloc(raw+align(virtualSize,fa));b.copy(out);stub.copy(out,raw);replacement.copy(out,off(siteRva));
const sh=so+ns*40;out.fill(0,sh,sh+40);out.write('.fxcnca',sh,'ascii');
for(const [k,v]of [[8,virtualSize],[12,rva],[16,out.length-raw],[20,raw],[36,0xe0000020]])out.writeUInt32LE(v,sh+k);
out.writeUInt16LE(ns+1,pe+6);out.writeUInt32LE(align(rva+virtualSize,sa),op+56);out.writeUInt32LE(0,op+64);
const allowed=[[pe+6,pe+8],[op+56,op+60],[op+64,op+68],[sh,sh+40],[off(siteRva),off(siteRva)+5]];
let changed=0;for(let i=0;i<b.length;i++)if(b[i]!==out[i]){assert(allowed.some(([a,z])=>i>=a&&i<z),'Unlisted baseline change');changed++;}
assert(out.subarray(oldSection.p,oldSection.p+oldSection.n).equals(b.subarray(oldSection.p,oldSection.p+oldSection.n)),'Accepted main stub changed');
const candidateSHA256=sha(out),dest=path.join(stage,'Foxmail深色.exe');fs.writeFileSync(dest,out);
const header=['/* Actual emitted candidate bytes and the byte-preserved main stub. */',
 ...Object.entries({FX_NCA_SECTION_RVA:rva,FX_NCA_COUNTER_RVA:counterRva,FX_NCA_VMT_RVA:vmtRva,FX_NCA_SITE_RVA:siteRva,FX_MAIN_SECTION_RVA:oldEntryRva,FX_MAIN_COUNTER_RVA:mainCounterRva,FX_MAIN_VMT_RVA:mainVmtRva}).map(([k,v])=>`#define ${k} ${v}u`),
 `#define FX_CANDIDATE_SHA "${candidateSHA256}"`,...Object.entries({nca_stub:stub,nca_site:replacement,main_stub:oldStub}).map(([k,v])=>`static const unsigned char ${k}[] = {${[...v].join(',')}};`)].join('\n');
fs.writeFileSync(path.join(stage,'compose-ncactivate-stub.h'),header+'\n');
const report={input,baselineSHA256,dest,candidateSHA256,sectionRva:rva,sectionRaw:raw,counterRva,siteRva,vmtRva,mainVmtRva,mainCounterRva,oldEntryRva,oldMainSectionSHA256:sha(b.subarray(oldSection.p,oldSection.p+oldSection.n)),oldMainSectionByteIdentical:true,dispatchProof,stubHex:stub.toString('hex'),siteHex:replacement.toString('hex'),originalChangedBytes:changed,originalEntryUnchanged:out.readUInt32LE(op+16)===b.readUInt32LE(op+16),onlyOriginalCodeSite:[siteRva,5],helperSHA256:'29efc7d9ec5b402f6a00a165a586f0762ec51aa2495cdcdc8e0a5fb31bc05515',cssSHA256:'8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8',scope:'Exact non-minimized TFoxComposeForm WM_NCACTIVATE(nonzero) at the existing first default-activation site temporarily receives lParam=-1, then original lParam is restored while default outputs are preserved. All fallback branches tail-jump the unchanged accepted main-window stub. No other original code, startup, resources, helper, CSS, delay or window style changes.',visualAccepted:false};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({candidateSHA256,dest,dispatchProof,counterRva,mainCounterRva,oldMainSectionByteIdentical:true,originalChangedBytes:changed}));
