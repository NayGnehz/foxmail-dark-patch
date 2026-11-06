'use strict';
// One finite numeric record at the account group's original bottom-strip draw.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),align=(x,a)=>Math.ceil(x/a)*a;
const input=path.join(paths.output('version587-account-right-inset'),'Foxmail深色.exe'),b=fs.readFileSync(input),baselineSHA256='540cf174a53e319529605b0cb3e171550783a6fe6455d29d16e5bc410f6d1f33';assert.equal(sha(b),baselineSHA256);
const pe=b.readUInt32LE(60),op=pe+24,so=op+b.readUInt16LE(pe+20),ss=[];
for(let i=0;i<b.readUInt16LE(pe+6);i++){const h=so+i*40;ss.push({h,r:b.readUInt32LE(h+12),p:b.readUInt32LE(h+20),n:b.readUInt32LE(h+16),v:b.readUInt32LE(h+8),name:b.toString('ascii',h,h+8).replace(/\0/g,'')});}
const off=r=>{const s=ss.find(s=>r>=s.r&&r<s.r+s.n);assert(s);return s.p+r-s.r;};
const siteRva=0x47badd,targetRva=0x4c668c,groupVmtRva=0x76a5e8,parentVmtRva=0x9aa69c,clipIatRva=0xefbb3c,visibleIatRva=0xefba8c,pngGlobalRva=0xee6b60;
assert.equal(b[off(siteRva)],0xe8);assert.equal(siteRva+5+b.readInt32LE(off(siteRva)+1),targetRva);
assert.equal(b.subarray(off(0x4c7112),off(0x4c7112)+3).toString('hex'),'c20400');
for(const [v,size]of [[groupVmtRva,536],[parentVmtRva,904]]){assert.equal(b.readUInt32LE(off(v-76)),v+0x400000);assert.equal(b.readUInt32LE(off(v-40)),size);}
const last=ss.at(-1);assert.equal(last.name,'.fxcnca');assert.equal(last.p+last.n,b.length);
const stubRva=last.r+align(Math.max(last.n,last.v),16),recordRva=stubRva+768,recordSize=96;
const c=[],fix=[],byte=(...v)=>c.push(...v),u32=x=>{const q=Buffer.alloc(4);q.writeUInt32LE(x>>>0);byte(...q);},branch=op=>{byte(0x0f,op);fix.push(c.length);u32(0);};
const mem=(opcode,offset)=>{byte(...opcode);u32(recordRva+offset);};
byte(0x9c,0x60,0xe8,0,0,0,0,0x5f,0x81,0xef);u32(stubRva+7);
mem([0xf0,0xff,0x87],4);byte(0x85,0xc0);branch(0x84);byte(0x3b,0x87);u32(pngGlobalRva);branch(0x85);
byte(0x8b,0x45,0xf8,0x85,0xc0);branch(0x84);byte(0x8d,0x97);u32(groupVmtRva);byte(0x39,0x10);branch(0x85);byte(0x39,0x52,0xb4);branch(0x85);byte(0x81,0x7a,0xd8);u32(536);branch(0x85);
byte(0x8b,0x40,0x30,0x85,0xc0);branch(0x84);byte(0x8d,0x97);u32(parentVmtRva);byte(0x39,0x10);branch(0x85);byte(0x39,0x52,0xb4);branch(0x85);byte(0x81,0x7a,0xd8);u32(904);branch(0x85);
mem([0xf0,0xff,0x87],8);
byte(0x8b,0x74,0x24,24,0x8b,0x46,8,0x3b,0x06);branch(0x8e);byte(0x8b,0x46,12,0x3b,0x46,4);branch(0x8e);
byte(0x33,0xc0,0xba,1,0,0,0);mem([0xf0,0x0f,0xb1,0x97],0);branch(0x85);
// Saved ECX is destination pointer; original stack argument is source pointer.
for(const [stackOffset,recordOffset]of [[24,20],[40,36]]){byte(0x8b,0x74,0x24,stackOffset);for(let i=0;i<4;i++){byte(0x8b,0x46,i*4);mem([0x89,0x87],recordOffset+i*4);}}
for(const [r,at]of [[0xee6b64,68],[0xee6b68,72]]){byte(0x8b,0x87);u32(r);mem([0x89,0x87],at);}
byte(0x33,0xc0,0x83,0x7c,0x24,20,0,0x0f,0x95,0xc0);mem([0x89,0x87],12);
// Win32 LastError belongs to this thread. Preserve it around both query APIs.
byte(0x64,0x8b,0x1d,0x34,0,0,0);mem([0x8d,0x87],52);byte(0x50,0xff,0x74,0x24,24,0xff,0x97);u32(clipIatRva);mem([0x89,0x87],16);
mem([0x8b,0x87],20);mem([0x03,0x87],28);byte(0x48,0xd1,0xf8);mem([0x89,0x87],76);byte(0x40);mem([0x89,0x87],84);
mem([0x8b,0x87],32);byte(0x48);mem([0x89,0x87],80);byte(0x40);mem([0x89,0x87],88);
mem([0x8d,0x87],76);byte(0x50,0xff,0x74,0x24,24,0xff,0x97);u32(visibleIatRva);mem([0x89,0x87],92);
byte(0x64,0x89,0x1d,0x34,0,0,0,0x33,0xc0);mem([0x83,0xbf],16);byte(1,0x7e,5,0xb8,2,0,0,0);mem([0x87,0x87],0);
const done=c.length;byte(0x61,0x9d,0xe9);u32(targetRva-(stubRva+c.length+4));
const stub=Buffer.from(c);assert(stub.length<768);for(const p of fix)stub.writeInt32LE(done-p-4,p);
const virtualSize=recordRva+recordSize-last.r,rawSize=align(virtualSize,b.readUInt32LE(op+36)),out=Buffer.alloc(last.p+rawSize);b.copy(out);stub.copy(out,last.p+stubRva-last.r);
out.writeUInt32LE(virtualSize,last.h+8);out.writeUInt32LE(rawSize,last.h+16);out.writeUInt32LE(align(last.r+virtualSize,b.readUInt32LE(op+32)),op+56);out.writeUInt32LE(0,op+64);
const p=off(siteRva);out[p]=0xe8;out.writeInt32LE(stubRva-siteRva-5,p+1);const allowed=[[p,p+5],[last.h+8,last.h+12],[last.h+16,last.h+20],[op+56,op+60],[op+64,op+68]];
for(let i=0;i<b.length;i++)if(b[i]!==out[i])assert(allowed.some(([a,z])=>a<=i&&i<z));
const stage=paths.output('version587-group-bottom-probe'),dest=path.join(stage,'Foxmail深色.exe'),candidateSHA256=sha(out),siteHex=out.subarray(p,p+5).toString('hex');
const fields={state:0,allCalls:4,accountCalls:8,validHdc:12,clipType:16,destRect:20,sourceRect:36,clipRect:52,marginX:68,marginY:72,bottomCenterRect:76,bottomCenterVisible:92};
const report={input,dest,baselineSHA256,candidateSHA256,generatorSHA256:sha(fs.readFileSync(__filename)),siteRva,targetRva,stubRva,recordRva,recordSize,fields,siteHex,originalSiteHex:b.subarray(p,p+5).toString('hex'),stubHex:stub.toString('hex'),groupVmtRva,parentVmtRva,clipIatRva,visibleIatRva,pngGlobalRva,guardSelf:'[87B6EC EBP-8] = original 87BB84 EDX group',originalEntryUnchanged:true,originalPayloadsExceptSitesUnchanged:true,helperSHA256:'0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70',cssSHA256:'8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8',scope:'Original bottom drawing always executes. One atomically claimed numeric account record; existing GetClipBox/RectVisible query the native HDC. Preserves original GPR/flags/stack/LastError. No pixels, text, object addresses, HWND or content recorded.',installed:false};
report.samplePolicy='Only positive destination geometry is queried. ERROR/NULLREGION resets state to 0 for the next matching call; first nonempty clip is published as state 2. Desktop occlusion or startup gates can still hide the sampled bottom center; RectVisible is not proof of painter clipping by itself.';
fs.writeFileSync(dest,out);fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));
const header=[`#define FX_CANDIDATE_SHA "${candidateSHA256}"`,...Object.entries({FX_GROUP_VMT_RVA:groupVmtRva,FX_PARENT_VMT_RVA:parentVmtRva,FX_IMAGE_LIMIT:align(recordRva+recordSize+4096,4096),FX_STUB_RVA:stubRva,FX_SITE_RVA:siteRva,FX_TARGET_RVA:targetRva,FX_RECORD_RVA:recordRva,FX_CLIP_IAT_RVA:clipIatRva,FX_VISIBLE_IAT_RVA:visibleIatRva,FX_PNG_GLOBAL_RVA:pngGlobalRva}).map(([k,v])=>`#define ${k} ${v}u`),`static const unsigned char probe_stub[]={${[...stub].join(',')}};`,`static const unsigned char probe_site[]={${[...Buffer.from(siteHex,'hex')].join(',')}};`].join('\n');fs.writeFileSync(path.join(stage,'group-bottom-probe-stub.h'),header+'\n');console.log(JSON.stringify({candidateSHA256,dest,stubRva,recordRva,fields}));
