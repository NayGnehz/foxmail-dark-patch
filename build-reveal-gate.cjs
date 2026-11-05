'use strict';
// Add an optional companion-DLL gate to the already verified dark executable.
// No palette/resource rebuild; the only existing CODE edit is the seven-byte
// main restore coordinator prologue. Missing helper always uses the original.
const fs=require('fs'),crypto=require('crypto');
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('usage: node build-reveal-gate.cjs baseline output');
const b=fs.readFileSync(input),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const expected='75d86c85b9d5bc568248626170b776eef58f29e26b2f21c28f48025ade7d7f85';
if(sha(b)!==expected)throw Error('Unexpected diagnostic-off baseline');
const pe=b.readUInt32LE(60),op=pe+24,ns=b.readUInt16LE(pe+6),so=op+b.readUInt16LE(pe+20);
if(b.readUInt16LE(pe+4)!==0x14c||b.readUInt16LE(op)!==0x10b)throw Error('x86 required');
const sections=Array.from({length:ns},(_,i)=>{let p=so+i*40;return{rva:b.readUInt32LE(p+12),size:b.readUInt32LE(p+16),raw:b.readUInt32LE(p+20),vs:b.readUInt32LE(p+8)};});
const off=r=>{const s=sections.find(s=>r>=s.rva&&r<s.rva+Math.max(s.size,s.vs));if(!s)throw Error('Unmapped RVA');return s.raw+r-s.rva;};
const str=p=>b.toString('ascii',p,b.indexOf(0,p));
const imports={};for(let d=off(b.readUInt32LE(op+104));b.readUInt32LE(d+12);d+=20){const tab=off(b.readUInt32LE(d)||b.readUInt32LE(d+16)),iat=b.readUInt32LE(d+16);for(let i=0;b.readUInt32LE(tab+4*i);i++){const n=b.readUInt32LE(tab+4*i);if(n<0x80000000)imports[str(off(n)+2)]=iat+i*4;}}
for(const n of ['GetLastError','SetLastError','LoadLibraryExW','GetProcAddress'])if(!imports[n])throw Error('Missing '+n);
const originalRva=0xbdff2c,stolen=Buffer.from('558bec518945fc','hex');
if(!b.subarray(off(originalRva),off(originalRva)+7).equals(stolen))throw Error('Coordinator signature mismatch');
const align=(n,a)=>Math.ceil(n/a)*a,sa=b.readUInt32LE(op+32),fa=b.readUInt32LE(op+36);
const rva=align(Math.max(...sections.map(s=>s.rva+Math.max(s.size,s.vs))),sa),raw=align(b.length,fa);
if(so+(ns+1)*40>Math.min(...sections.filter(s=>s.raw).map(s=>s.raw)))throw Error('No section-header room');
const code=[],labels={},refs=[];
const byte=(...x)=>code.push(...x),u32=x=>{const q=Buffer.alloc(4);q.writeUInt32LE(x>>>0);byte(...q);};
const mark=n=>labels[n]=code.length;
const rel=(ops,n)=>{byte(...ops);refs.push({at:code.length,n,relative:true});u32(0);};
const data=n=>{refs.push({at:code.length,n,relative:false});u32(0);};
const base=()=>{byte(0xe8,0,0,0,0);const next=rva+code.length;byte(0x5b,0x81,0xeb);u32(next);};
// Hook entry: EAX=Self. Preserve the exact post-original register/flags values
// via the callback context, including ECX=Self from the original local pop.
mark('hook');byte(0x55,0x8b,0xec,0x83,0xec,32,0x89,0x45,0xe4,0x89,0x55,0xe8,0x89,0x4d,0xec,0x53,0x56,0x57);base();
byte(0x8d,0x93);data('trampoline');byte(0x89,0x55,0xe0,0x83,0xbb);data('gateSlot');byte(0);rel([0x0f,0x84],'fallback');
byte(0x85,0xc0);rel([0x0f,0x84],'fallback');
// Original guards skip restoration during destruction or disabled workflow.
byte(0x80,0xb8);u32(0x551);byte(0);rel([0x0f,0x85],'fallback');
byte(0x80,0xb8);u32(0x550);byte(0);rel([0x0f,0x84],'fallback');
byte(0x8b,0x90);u32(0x180);byte(0x8d,0x45,0xe0,0x50,0x8d,0x83);data('callback');byte(0x50,0x52,0xff,0x93);data('gateSlot');rel([0xe9],'finish');
mark('fallback');byte(0x8d,0x45,0xe0,0x50);rel([0xe8],'callback');
mark('finish');byte(0x8b,0x45,0xf0,0x8b,0x55,0xf4,0x8b,0x4d,0xf8,0xff,0x75,0xfc,0x9d,0x5f,0x5e,0x5b,0x8b,0xe5,0x5d,0xc3);
mark('callback');byte(0x55,0x8b,0xec,0x53,0x8b,0x5d,8,0x8b,0x43,4,0x8b,0x53,8,0x8b,0x4b,12,0xff,0x13,0x89,0x43,16,0x89,0x53,20,0x89,0x4b,24,0x9c,0x8f,0x43,28,0x5b,0x5d,0xc2,4,0);
mark('trampoline');byte(...stolen,0xe9);u32(originalRva+7-(rva+code.length+4));
// Resolve the companion from the executable directory and System32 only.
mark('entry');byte(0x9c,0x60);base();byte(0xff,0x93);u32(imports.GetLastError);byte(0x50,0x68);u32(0xa00);byte(0x6a,0,0x8d,0x83);data('dllName');byte(0x50,0xff,0x93);u32(imports.LoadLibraryExW);byte(0x85,0xc0);rel([0x0f,0x84],'entryCleanup');
byte(0x8d,0x8b);data('exportName');byte(0x51,0x50,0xff,0x93);u32(imports.GetProcAddress);byte(0x89,0x83);data('gateSlot');
mark('entryCleanup');byte(0xff,0x93);u32(imports.SetLastError);byte(0x61,0x9d,0xe9);u32(b.readUInt32LE(op+16)-(rva+code.length+4));
while(code.length%4)byte(0);mark('gateSlot');u32(0);mark('dllName');byte(...Buffer.from('FoxmailRevealGate.dll\0','utf16le'));mark('exportName');byte(...Buffer.from('FxGateRun\0'));
for(const f of refs){const value=f.relative?labels[f.n]-f.at-4:rva+labels[f.n];if(!Number.isInteger(value))throw Error('Unknown label');for(let i=0;i<4;i++)code[f.at+i]=(value>>>(8*i))&255;}
const out=Buffer.alloc(raw+align(code.length,fa));b.copy(out);Buffer.from(code).copy(out,raw);
const sh=so+ns*40;out.fill(0,sh,sh+40);out.write('.fxgate',sh,'ascii');out.writeUInt32LE(code.length,sh+8);out.writeUInt32LE(rva,sh+12);out.writeUInt32LE(align(code.length,fa),sh+16);out.writeUInt32LE(raw,sh+20);out.writeUInt32LE(0xe0000020,sh+36);
out.writeUInt16LE(ns+1,pe+6);out.writeUInt32LE(rva+labels.entry,op+16);out.writeUInt32LE(align(rva+code.length,sa),op+56);out.writeUInt32LE(0,op+64);
const at=off(originalRva);out[at]=0xe9;out.writeInt32LE(rva+labels.hook-originalRva-5,at+1);out[at+5]=out[at+6]=0x90;
fs.writeFileSync(output,out);
const meta={baseline:input,baselineSHA256:sha(b),candidateSHA256:sha(out),experimental:true,eligibleForInstall:false,sectionRva:rva,sectionRaw:raw,codeBytes:code.length,labels:Object.fromEntries(Object.entries(labels).map(([k,v])=>[k,rva+v])),originalRva,stolenHex:stolen.toString('hex'),originalEntryRva:b.readUInt32LE(op+16),imports,helper:'FoxmailRevealGate.dll',export:'FxGateRun',scope:'Main restore coordinator only; no settings hook; conservative unknown-lifetime bypass; companion failure falls through original',noStyleChanges:true};
fs.writeFileSync(output+'.json',JSON.stringify(meta,null,2));console.log(JSON.stringify({candidateSHA256:meta.candidateSHA256,codeBytes:code.length,sectionRva:rva,eligibleForInstall:false}));
