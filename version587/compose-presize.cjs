'use strict';
// Compose-only pre-layout inside the existing gated original-Show callback.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const BASELINE='4ca3440e7da018de28d3b920f93ba38af3f8500d1a767a7c091430577b6853c3';
assert.match(BASELINE,/^[a-f0-9]{64}$/, 'Root must select the exact compose NC baseline before generation');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const stage=paths.output('version587-compose-presize'),input=path.join(paths.output('version587-compose-ncactivate'),'Foxmail深色.exe'),b=fs.readFileSync(input);assert.equal(sha(b),BASELINE);
const prior=JSON.parse(fs.readFileSync(path.join(path.dirname(input),'validation.json'),'utf8'));assert.equal(prior.candidateSHA256,BASELINE);assert.equal(prior.dest,input);
const metaPath=path.join(paths.output('version587-reveal'),'Foxmail深色.exe.json'),metaBytes=fs.readFileSync(metaPath);assert.equal(sha(metaBytes),'bbc76b88693d51f9aa2df149e834ab840d1ff5f9846a3d1a5a8e3681a3608204');
const meta=JSON.parse(metaBytes),trampoline=22544975,callback=22544939,hook=22544771;
for(const [k,v]of Object.entries({settings_trampoline:trampoline,settings_callback:callback,settings_hook:hook}))assert.equal(meta.labels[k],v);
const pe=b.readUInt32LE(60),op=pe+24,ns=b.readUInt16LE(pe+6),so=op+b.readUInt16LE(pe+20),base=b.readUInt32LE(op+28);assert.equal(base,0x400000);assert.equal(b.readUInt16LE(pe+4),0x14c);
const ss=Array.from({length:ns},(_,i)=>{const p=so+i*40;return{h:p,r:b.readUInt32LE(p+12),p:b.readUInt32LE(p+20),n:b.readUInt32LE(p+16),v:b.readUInt32LE(p+8),name:b.toString('ascii',p,p+8).replace(/\0/g,'')};});
const off=r=>{const s=ss.find(s=>r>=s.r&&r<s.r+s.n);assert(s,'RVA mapped');return s.p+r-s.r;};
const str=p=>b.toString('ascii',p,b.indexOf(0,p)),imports={};for(let d=off(b.readUInt32LE(op+104));b.readUInt32LE(d+12);d+=20){const tab=off(b.readUInt32LE(d)||b.readUInt32LE(d+16)),iat=b.readUInt32LE(d+16);for(let i=0;b.readUInt32LE(tab+4*i);i++){const n=b.readUInt32LE(tab+4*i);if(n<0x80000000)imports[str(off(n)+2)]=iat+i*4;}}
const api={GetPropA:15710240,GetLastError:15711732,SetLastError:15711384,GetModuleHandleA:15711704,GetProcAddress:15711680};for(const[k,v]of Object.entries(api)){assert.equal(imports[k],v);assert.equal(meta.imports[k],v);}
const vmt=0xd0b0c4-base,cfg=0x1009810-base,scale=0x6b3a54-base,setBounds=0x1133690-base;
assert.equal(b.readUInt32LE(off(vmt-76)),base+vmt);assert.equal(b.readUInt32LE(off(vmt-40)),1768);assert.equal(b.readUInt32LE(off(vmt+0x84)),base+setBounds);
// Static function guards are from the exact pristine 587 binary, never a live process.
const proofDir=paths.output('version587-goal'),proofs=[...JSON.parse(fs.readFileSync(path.join(proofDir,'compose-presize-map.json'),'utf8')),...JSON.parse(fs.readFileSync(path.join(proofDir,'compose-presize-extra-map.json'),'utf8'))];
for(const a of [0xd1e548,0xd263f4,0x112aa78,0xd25080,0x10eea84,0x10ee9f4,0x10eea3c,0x1133690,0x1009810,0x6b3a54,0x10ee960]){const p=proofs.find(x=>x.newVA===a);assert(p&&p.bytes);assert.equal(b.subarray(off(a-base),off(a-base)+p.bytes.length/2).toString('hex'),p.bytes);}
assert.equal(b.subarray(off(trampoline),off(trampoline)+7).toString('hex'),'558bec518945fc');
const oldLEA=Buffer.alloc(6);oldLEA[0]=0x8d;oldLEA[1]=0x93;oldLEA.writeUInt32LE(trampoline,2);const start=off(hook),end=off(callback),hits=[];for(let p=start;p<=end-6;p++)if(b.subarray(p,p+6).equals(oldLEA))hits.push(p);assert.equal(hits.length,1);const siteRaw=hits[0]+2,siteRva=hook+siteRaw-start;
const align=(x,a)=>Math.ceil(x/a)*a,sa=b.readUInt32LE(op+32),fa=b.readUInt32LE(op+36),tail=ss[ss.length-1],raw=align(b.length,fa);assert.equal(tail.name,'.fxcnca');assert.equal(tail.p+tail.n,b.length);assert.equal(b.readUInt32LE(tail.h+36),0xe0000020);assert.equal(tail.r,Math.max(...ss.map(s=>s.r)));const rva=tail.r+raw-tail.p;
const code=[],labels={},refs=[],byte=(...x)=>code.push(...x),u32=x=>{const q=Buffer.alloc(4);q.writeUInt32LE(x>>>0);byte(...q);},mark=n=>labels[n]=code.length;
const ref=(ops,n,relative)=>{byte(...ops);refs.push({at:code.length,n,relative});u32(0);},branch=(op,n)=>ref([0x0f,op],n,true),data=(ops,n)=>ref(ops,n,false);
const call=r=>{byte(0xe8);u32(r-(rva+code.length+4));},apiCall=n=>{byte(0xff,0x93);u32(api[n]);};
byte(0x9c,0x60,0x83,0xec,32,0xe8,0,0,0,0,0x5b,0x81,0xeb);u32(rva+10); // local32 + pushad + pushfd
byte(0x8b,0x74,0x24,60,0x85,0xf6);branch(0x84,'restore');
byte(0x8d,0x83);u32(vmt);byte(0x39,0x06);branch(0x85,'restore');
for(const[o,v,condition]of [[0x57,0,0x85],[0x22b,0,0x85],[0x58a,1,0x84]]){byte(0x80,0xbe);u32(o);byte(v);branch(condition,'restore');}
byte(0x8b,0xbe);u32(0x180);byte(0x85,0xff);branch(0x84,'restore');
data([0x83,0xbb],'busy');byte(0);branch(0x85,'restore');
apiCall('GetLastError');byte(0x89,0x04,0x24);
data([0x8d,0x83],'owner');byte(0x50,0x57);apiCall('GetPropA');byte(0x85,0xc0);branch(0x84,'restoreError');
data([0x8d,0x83],'dwmName');byte(0x50);apiCall('GetModuleHandleA');byte(0x85,0xc0);branch(0x84,'restoreError');
data([0x8d,0x93],'dwmProc');byte(0x52,0x50);apiCall('GetProcAddress');byte(0x85,0xc0);branch(0x84,'restoreError');
byte(0xc7,0x44,0x24,4);u32(0);byte(0x8d,0x54,0x24,4,0x6a,4,0x52,0x6a,14,0x57,0xff,0xd0,0x85,0xc0);branch(0x88,'restoreError');
byte(0x83,0x7c,0x24,4,1);branch(0x85,'restoreError');
// busy is process-local, nonwaiting. On an exception it stays set (fail closed);
// the existing native gate's finally still releases its cloak while unwinding.
data([0xc7,0x83],'busy');u32(1);call(cfg);byte(0x85,0xc0);branch(0x84,'clearBusy');
byte(0x80,0x78,0x10,1);branch(0x85,'clearBusy');byte(0x80,0x78,0x24,0);branch(0x85,'clearBusy');
byte(0x8b,0x50,0x1c,0x8b,0x48,0x20,0x89,0x54,0x24,8,0x89,0x4c,0x24,12);
for(const reg of [0xfa,0xf9]){byte(0x81,reg);u32(100);branch(0x8c,'clearBusy');byte(0x81,reg);u32(12000);branch(0x8f,'clearBusy');}
byte(0x8b,0x44,0x24,8);call(scale);byte(0x89,0x44,0x24,8,0x3d);u32(200);branch(0x8c,'clearBusy');byte(0x3d);u32(16000);branch(0x8f,'clearBusy');
byte(0x8b,0x44,0x24,12);call(scale);byte(0x89,0x44,0x24,12,0x3d);u32(100);branch(0x8c,'clearBusy');byte(0x3d);u32(16000);branch(0x8f,'clearBusy');
byte(0x8b,0x44,0x24,8,0x3b,0x46,0x48);branch(0x85,'apply');byte(0x8b,0x44,0x24,12,0x3b,0x46,0x4c);branch(0x84,'clearBusy');
mark('apply');byte(0x80,0x7e,0x57,0);branch(0x85,'clearBusy');byte(0x80,0xbe);u32(0x22b);byte(0);branch(0x85,'clearBusy');byte(0x3b,0xbe);u32(0x180);branch(0x85,'clearBusy');byte(0x8b,0x44,0x24,8,0x8b,0x54,0x24,12,0x50,0x52,0x8b,0x4e,0x44,0x8b,0x56,0x40,0x8b,0xc6,0x8b,0x06); // EAX currently VMT; restore Self after pointer selection
byte(0x8b,0x80);u32(0x84);byte(0x89,0x44,0x24,24,0x8b,0xc6,0xff,0x54,0x24,24); // local16 now at esp+24 while W/H pushed
byte(0x80,0x8e);u32(0x98);byte(12);data([0xff,0x83],'counter');
mark('clearBusy');data([0xc7,0x83],'busy');u32(0);
mark('restoreError');byte(0xff,0x34,0x24);apiCall('SetLastError');
mark('restore');byte(0x83,0xc4,32,0x61,0x9d,0xe9);u32(trampoline-(rva+code.length+4));
while(code.length%4)byte(0);mark('busy');u32(0);mark('counter');u32(0);
for(const[n,s]of [['owner','FxRevealGate.Owner.43E5CD38.v2'],['dwmName','dwmapi.dll'],['dwmProc','DwmGetWindowAttribute']]){mark(n);byte(...Buffer.from(s+'\0'));}
for(const f of refs){assert(Number.isInteger(labels[f.n]));const v=f.relative?labels[f.n]-f.at-4:rva+labels[f.n];for(let i=0;i<4;i++)code[f.at+i]=(v>>>(8*i))&255;}
const stub=Buffer.from(code),out=Buffer.alloc(raw+align(stub.length,fa));b.copy(out);stub.copy(out,raw);out.writeUInt32LE(rva,siteRaw);
const sh=tail.h;out.writeUInt32LE(rva-tail.r+stub.length,sh+8);out.writeUInt32LE(out.length-tail.p,sh+16);
out.writeUInt32LE(align(rva+stub.length,sa),op+56);out.writeUInt32LE(0,op+64);
const allowed=[[op+56,op+60],[op+64,op+68],[sh+8,sh+12],[sh+16,sh+20],[siteRaw,siteRaw+4]];let changed=0;for(let i=0;i<b.length;i++)if(b[i]!==out[i]){assert(allowed.some(([a,z])=>i>=a&&i<z));changed++;}
const dest=path.join(stage,'Foxmail深色.exe'),candidateSHA256=sha(out),busyRva=rva+labels.busy,counterRva=rva+labels.counter;
const report={generatorSHA256:sha(fs.readFileSync(__filename)),input,dest,baselineSHA256:BASELINE,candidateSHA256,sectionRva:rva,sectionRaw:raw,sectionSize:stub.length,extendedSection:tail.name,extendedSectionOriginalRva:tail.r,existingPayloadsUnchanged:ss.every(s=>{const x=Buffer.from(out.subarray(s.p,s.p+s.n));if(siteRaw>=s.p&&siteRaw<s.p+s.n)b.subarray(siteRaw,siteRaw+4).copy(x,siteRaw-s.p);return x.equals(b.subarray(s.p,s.p+s.n));}),busyRva,counterRva,siteRva,siteRaw,trampolineRva:trampoline,callbackRva:callback,hookRva:hook,vmtRva:vmt,cfgRva:cfg,scaleRva:scale,setBoundsRva:setBounds,imports:api,stubHex:stub.toString('hex'),labels,originalChangedBytes:changed,originalEntryUnchanged:out.readUInt32LE(op+16)===b.readUInt32LE(op+16),onlyOriginalCodeSite:[siteRva,4],oldTrampolinePreserved:out.subarray(off(trampoline),off(trampoline)+12).equals(b.subarray(off(trampoline),off(trampoline)+12)),helperSHA256:prior.helperSHA256,cssSHA256:prior.cssSHA256,scope:'Exact hidden normal compose only, existing owner property plus DWM cloak==1; initialized normal saved bounds read in-app; original scale and one virtual SetBounds; no config writes, new library load, UI wait, WindowState change or helper modification. Busy fails closed on exceptional unwinding; original gate owns cloak cleanup.',visualAccepted:false};
fs.writeFileSync(dest,out);fs.writeFileSync(path.join(stage,'emitted-stub.bin'),stub);fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));
const macros={SECTION_RVA:rva,BUSY_RVA:busyRva,COUNTER_RVA:counterRva,TRAMPOLINE_RVA:trampoline,VMT_RVA:vmt,CFG_RVA:cfg,SCALE_RVA:scale,SETBOUNDS_RVA:setBounds,...Object.fromEntries(Object.entries(api).map(([k,v])=>[k+'_IAT',v]))};
fs.writeFileSync(path.join(stage,'compose-presize-stub.h'),Object.entries(macros).map(([k,v])=>`#define FX_PRE_${k} ${v}u`).join('\n')+`\n#define FX_CANDIDATE_SHA "${candidateSHA256}"\nstatic const unsigned char presize_stub[] = {${[...stub].join(',')}};\n`);
console.log(JSON.stringify({candidateSHA256,sectionRva:rva,busyRva,counterRva,siteRva,originalChangedBytes:changed}));



