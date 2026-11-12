'use strict';
// Extend the existing erase prefill at its unmatched-class branch only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto'),paths=require('../foxmail-paths.cjs');
const {verifyByteDelta}=require('./verify-byte-delta.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const baselineSHA256='ff1e6f70c7bb551242ce441b8008a1ff211dbbcfe812d3866e713d31d6d865a6';
const base=0x400000,handlerRva=0x5872c8,drawRva=0x56fbbc,stringRva=0x56d398,ownerRva=0x7e8214;
const fields=[['vtMembers',0x444],['vtTo',0x454],['vtCc',0x464],['vtBcc',0x474]];
const before=fs.readFileSync(path.join(paths.temp,'version587-search-chooser-followup/Foxmail.exe'));
assert.equal(sha(before),baselineSHA256);
const pe=before.readUInt32LE(60),op=pe+24,table=op+before.readUInt16LE(pe+20);
assert.equal(before.readUInt32LE(op+28),base);
const sections=Array.from({length:before.readUInt16LE(pe+6)},(_,i)=>{const h=table+i*40;return{h,name:before.toString('ascii',h,h+8).replace(/\0/g,''),rva:before.readUInt32LE(h+12),raw:before.readUInt32LE(h+20),size:before.readUInt32LE(h+16),virtual:before.readUInt32LE(h+8)};});
const off=(rva,size=4)=>{const s=sections.find(s=>rva>=s.rva&&rva+size<=s.rva+s.size);assert(s);return s.raw+rva-s.rva;};
const u32=rva=>before.readUInt32LE(off(rva));
for(const[vmt,name,size]of [[stringRva,'TVirtualStringTree',0x750],[drawRva,'TVirtualDrawTree',0x728],[ownerRva,'TDlg_SelAddr',0x560]]){
 assert.equal(u32(vmt-76),base+vmt);assert.equal(u32(vmt-40),size);
 const nameAt=off(u32(vmt-44)-base);assert.equal(before[nameAt],name.length);assert.equal(before.toString('ascii',nameAt+1,nameAt+1+name.length),name);
}
// Bind the actual streamed component fields, and the original Owner write.
let p=off(u32(ownerRva-56)-base);const count=before.readUInt16LE(p);p+=6;const bindings=new Map();
for(let i=0;i<count;i++){const length=before[p+6];bindings.set(before.toString('ascii',p+7,p+7+length),before.readUInt32LE(p));p+=7+length;}
for(const[name,offset]of fields)assert.equal(bindings.get(name),offset);
assert.equal(before.subarray(off(0x251f41),off(0x251f41)+9).toString('hex'),'8b45fc8b55f8894204','TComponent inserts Owner at +4');
const siteAt=off(handlerRva,26);assert.equal(before[siteAt],0xe9);
assert.equal(before.subarray(siteAt+6,siteAt+26).toString('hex'),'8955f88945fc8b45f8c7400c0100000059595dc3');
const guardRva=handlerRva+5+before.readInt32LE(siteAt+1);
const guardSize=457,guardAt=off(guardRva,guardSize),guard=before.subarray(guardAt,guardAt+guardSize);
const cmp=Buffer.alloc(5);cmp[0]=0x3d;cmp.writeUInt32LE(drawRva,1);
const at=guard.indexOf(cmp);assert(at>=0&&guard.indexOf(cmp,at+1)<0);assert.equal(guard.subarray(at+5,at+7).toString('hex'),'0f84');assert.equal(guard[at+11],0xe9);
const matched=guardRva+at+11+guard.readInt32LE(at+7),fallback=guardRva+at+11;
const restore=fallback+5+guard.readInt32LE(at+12);
assert.equal(before.subarray(off(matched),off(matched)+7).toString('hex'),'8b420485c00f84');
assert.equal(before.subarray(off(restore),off(restore)+22).toString('hex'),'8b45fc8b55f88b4df45f5e5b8be55d558bec83c4f8e9');
const tail=sections.at(-1);assert.equal(tail.name,'.fxcnca');assert.equal(tail.raw+tail.size,before.length);assert(tail.virtual<=tail.size);
const selectorRva=tail.rva+tail.size,code=[];
const byte=(...v)=>code.push(...v),dword=value=>{const b=Buffer.alloc(4);b.writeInt32LE(value);byte(...b);};
const branch=(opcode,target)=>{byte(...opcode);dword(target-(selectorRva+code.length+4));};
byte(0x3d);dword(stringRva);branch([0x0f,0x85],restore);
byte(0x8b,0x45,0xfc,0x8b,0x48,4,0x85,0xc9);branch([0x0f,0x84],restore);
byte(0x8b,1,0x29,0xd8,0x3d);dword(ownerRva);branch([0x0f,0x85],restore);
byte(0x8b,0x45,0xfc);
for(const[,field]of fields){byte(0x3b,0x81);dword(field);branch([0x0f,0x84],matched);}
branch([0xe9],restore);
const selector=Buffer.from(code),align=(value,size)=>Math.ceil(value/size)*size;
const out=Buffer.alloc(align(before.length+selector.length,before.readUInt32LE(op+36)));before.copy(out);selector.copy(out,before.length);
out.writeInt32LE(selectorRva-fallback-5,off(fallback)+1);
out.writeUInt32LE(tail.size+selector.length,tail.h+8);out.writeUInt32LE(out.length-tail.raw,tail.h+16);
out.writeUInt32LE(align(selectorRva+selector.length,before.readUInt32LE(op+32)),op+56);
out.writeUInt32LE(before.readUInt32LE(op+4)+out.length-before.length,op+4);
const ranges=[[off(fallback)+1,off(fallback)+5],[tail.h+8,tail.h+12],[tail.h+16,tail.h+20],[op+4,op+8],[op+56,op+60]];
const changedBytes=verifyByteDelta(before,out.subarray(0,before.length),ranges);
const reversed=Buffer.from(out.subarray(0,before.length));for(const[start,end]of ranges)before.copy(reversed,start,start,end);assert(reversed.equals(before));
// Every resource and all previous guard/reveal payloads remain byte-identical
// except the single existing unmatched-class jump operand.
const imports=new Map();for(let d=off(before.readUInt32LE(op+104));before.readUInt32LE(d+12);d+=20){const iat=before.readUInt32LE(d+16),names=off(before.readUInt32LE(d)||iat);for(let i=0;before.readUInt32LE(names+4*i);i++){const ptr=before.readUInt32LE(names+4*i);if(ptr<0x80000000){const a=off(ptr)+2,name=before.toString('ascii',a,before.indexOf(0,a));if(!imports.has(name))imports.set(name,[]);imports.get(name).push(iat+4*i);}}}
const meta=JSON.parse(fs.readFileSync(path.join(paths.temp,'version587-native/Foxmail深色.exe.json'),'utf8'));
const apiNames=['GetLastError','SetLastError','GetDeviceCaps','GetCurrentObject','GetObjectA','GetMapMode','GetClipBox','FillRect'];
const usedImports=new Map();
for(const name of apiNames){assert(imports.has(name));const matches=imports.get(name).filter(iat=>{const call=Buffer.alloc(6);call[0]=0xff;call[1]=0x93;call.writeUInt32LE(iat,2);return guard.includes(call);});assert.equal(matches.length,1,name);usedImports.set(name,matches[0]);}
const brushRva=meta.sectionRVA+meta.slots+meta.hooks.length*4+5*4;
const brushLoad=Buffer.alloc(6);brushLoad[0]=0x8b;brushLoad[1]=0x83;brushLoad.writeUInt32LE(brushRva,2);assert(guard.includes(brushLoad));
const stage=paths.output('version587-chooser-first-erase'),dest=path.join(stage,'Foxmail.exe'),candidateSHA256=sha(out);
fs.writeFileSync(dest,out);
const define={IMAGE_SIZE:out.readUInt32LE(op+56),HANDLER_RVA:handlerRva,GUARD_RVA:guardRva,SELECTOR_RVA:selectorRva,DRAW_RVA:drawRva,STRING_RVA:stringRva,OWNER_RVA:ownerRva,BRUSH_RVA:brushRva};
const array=(name,b)=>'static const U8 '+name+'[] = {'+[...b].join(',')+'};';
const header=[...Object.entries(define).map(([k,v])=>'#define FX_'+k+' '+v+'u'),'#define FX_CANDIDATE_SHA "'+candidateSHA256+'"',array('fx_handler',out.subarray(siteAt,siteAt+26)),array('fx_guard',out.subarray(guardAt,guardAt+guardSize)),array('fx_before_guard',guard),array('fx_selector',selector),'static const U32 fx_iats[] = {'+apiNames.map(n=>usedImports.get(n)+'u').join(',')+'};','static const U32 fx_dynamic[] = {'+['GetObjectType','GetROP2','GetGraphicsMode','GetLayout'].map(n=>meta.nativeInitialErase.dynamicSlots[n]+'u').join(',')+'};','static const U32 fx_fields[] = {'+fields.map(([,v])=>v+'u').join(',')+'};'].join('\n')+'\n';
fs.writeFileSync(path.join(stage,'chooser-erase-fixture.h'),header);
const report={baselineSHA256,candidateSHA256,dest,generatorSHA256:sha(fs.readFileSync(__filename)),fixtureHeaderSHA256:sha(header),selectorRva,selectorBytes:selector.length,fallbackRva:fallback,matchedRva:matched,restoreRva:restore,guardRva,guardSize,fields,changedBytes,appendBytes:out.length-before.length,reverseRestoresExactInput:true,resourcesUnchanged:true,scope:'Only the four streamed TVirtualStringTree fields owned by exact TDlg_SelAddr join the existing validated screen/DC prefill. Existing TVirtualDrawTree path retained. No API calls, new paint code or delayed show.',installed:false};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
