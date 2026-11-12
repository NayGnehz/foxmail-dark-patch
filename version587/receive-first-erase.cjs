'use strict';
// Reuse the existing TTabForm prefill for this exact progress dialog only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const {verifyByteDelta}=require('./verify-byte-delta.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const baselineSHA256='daa704320ecb6acbba31df79be7e3b297284c103ee2877e23be51e7d6cd24305';
const before=fs.readFileSync(path.join(paths.temp,'version587-chooser-first-erase/Foxmail.exe'));
assert.equal(sha(before),baselineSHA256);
const out=Buffer.from(before),base=0x400000,{resources,pe,op}=readResources(before);
const table=op+before.readUInt16LE(pe+20),ranges=[];
const sections=Array.from({length:before.readUInt16LE(pe+6)},(_,i)=>{const h=table+40*i;return{h,name:before.toString('ascii',h,h+8).replace(/\0/g,''),rva:before.readUInt32LE(h+12),raw:before.readUInt32LE(h+20),size:before.readUInt32LE(h+16),virtual:before.readUInt32LE(h+8)};});
const off=(rva,size=4)=>{const s=sections.find(s=>rva>=s.rva&&rva+size<=s.rva+s.size);assert(s);return s.raw+rva-s.rva;};
const meta=JSON.parse(fs.readFileSync(path.join(paths.temp,'version587-native/Foxmail深色.exe.json'),'utf8'));
const site=meta.nativeInitialErase.sites.find(s=>s.name==='optionForm');
assert.equal(site.originalRva,0x616594);assert.equal(site.size,457);
const handler=off(site.originalRva),guardAt=off(site.entryRva,site.size),guard=before.subarray(guardAt,guardAt+site.size);
assert.equal(before[handler],0xe9);assert.equal(site.originalRva+5+before.readInt32LE(handler+1),site.entryRva);
assert.equal(before.subarray(handler+6,handler+16).toString('hex'),'8955f88945fc8b45fce8');
const optionRva=site.vmtRvas[0],receiveRva=0x99ab9c;
for(const[rva,name,size]of [[optionRva,'TOptionForm',0x56c],[receiveRva,'TDlgNetTaskProgress',0x48c]]){
 assert.equal(before.readUInt32LE(off(rva-76)),base+rva);
 const n=off(before.readUInt32LE(off(rva-44))-base);
 assert.equal(before.toString('ascii',n+1,n+1+before[n]),name);
 if(name==='TDlgNetTaskProgress')assert.equal(before.readUInt32LE(off(rva-40)),size);
}
const cmp=Buffer.alloc(5);cmp[0]=0x3d;cmp.writeUInt32LE(optionRva,1);
const at=guard.indexOf(cmp);assert(at>=0&&guard.indexOf(cmp,at+1)<0);
assert.equal(guard.subarray(at+5,at+7).toString('hex'),'0f84');assert.equal(guard[at+11],0xe9);
const matched=site.entryRva+at+11+guard.readInt32LE(at+7),fallback=site.entryRva+at+11;
const restore=fallback+5+guard.readInt32LE(at+12);
assert.equal(before.subarray(off(matched),off(matched)+7).toString('hex'),'8b420485c00f84');
const tail=sections.at(-1);assert.equal(tail.name,'.fxcnca');assert.equal(tail.raw+tail.size,before.length);
const selectorRva=tail.rva+tail.virtual,selectorAt=off(selectorRva,16),selector=Buffer.alloc(16);
assert(before.subarray(selectorAt,selectorAt+16).every(x=>x===0));
selector[0]=0x3d;selector.writeUInt32LE(receiveRva,1);selector[5]=0x0f;selector[6]=0x85;
selector.writeInt32LE(restore-selectorRva-11,7);selector[11]=0xe9;selector.writeInt32LE(matched-selectorRva-16,12);
selector.copy(out,selectorAt);out.writeInt32LE(selectorRva-fallback-5,off(fallback)+1);
out.writeUInt32LE(tail.virtual+16,tail.h+8);
ranges.push([selectorAt,selectorAt+16],[off(fallback)+1,off(fallback)+5],[tail.h+8,tail.h+12]);
// The inherited erase fallback must also use a dark brush before skin paint.
const forms=resources.filter(r=>r.type===10&&r.name==='TDLGNETTASKPROGRESS');assert.equal(forms.length,1);
const r=forms[0],dfm=before.subarray(r.offset,r.offset+r.size),root=parseDFM(dfm);
assert.equal(root.className,'TDlgNetTaskProgress');
const color=root.properties.find(p=>p.name==='Color');assert.equal(color.value,'clWindow');
const value=Buffer.from([4,0x20,0x20,0x20,0]);
const changed=Buffer.concat([dfm.subarray(0,color.offset),value,dfm.subarray(color.end)]);
const expected=parseDFM(dfm);
function semantic(v){if(Array.isArray(v))return v.map(semantic);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['offset','end'].includes(k)).map(([k,x])=>[k,semantic(x)]));return v;}
expected.properties.find(p=>p.name==='Color').value=0x202020;
expected.properties.find(p=>p.name==='Color').type=4;
assert.deepEqual(semantic(parseDFM(changed)),semantic(expected));
changed.copy(out,r.offset);out.fill(0,r.offset+changed.length,r.offset+r.size);out.writeUInt32LE(changed.length,r.dataEntry+4);
ranges.push([r.offset,r.offset+r.size],[r.dataEntry+4,r.dataEntry+8]);
for(const other of resources.filter(x=>x!==r))assert(out.subarray(other.offset,other.offset+other.size).equals(before.subarray(other.offset,other.offset+other.size)));
const changedBytes=verifyByteDelta(before,out,ranges),reversed=Buffer.from(out);
for(const[start,end]of ranges)before.copy(reversed,start,start,end);assert(reversed.equals(before));
const imports=new Map();for(let d=off(before.readUInt32LE(op+104));before.readUInt32LE(d+12);d+=20){const iat=before.readUInt32LE(d+16),names=off(before.readUInt32LE(d)||iat);for(let i=0;before.readUInt32LE(names+4*i);i++){const ptr=before.readUInt32LE(names+4*i);if(ptr<0x80000000){const a=off(ptr)+2,n=before.toString('ascii',a,before.indexOf(0,a));if(!imports.has(n))imports.set(n,[]);imports.get(n).push(iat+4*i);}}}
const apiNames=['GetLastError','SetLastError','GetDeviceCaps','GetCurrentObject','GetObjectA','GetMapMode','GetClipBox','FillRect'];
const iats=apiNames.map(n=>{const used=imports.get(n).filter(iat=>{const b=Buffer.from([0xff,0x93,0,0,0,0]);b.writeUInt32LE(iat,2);return guard.includes(b);});assert.equal(used.length,1,n);return used[0];});
const brushRva=meta.sectionRVA+meta.slots+meta.hooks.length*4+5*4;
const stage=paths.output('version587-receive-first-erase'),dest=path.join(stage,'Foxmail.exe'),candidateSHA256=sha(out);
fs.writeFileSync(dest,out);
const array=(n,b)=>'static const U8 '+n+'[] = {'+[...b].join(',')+'};';
const definitions={IMAGE_SIZE:out.readUInt32LE(op+56),HANDLER_RVA:site.originalRva,GUARD_RVA:site.entryRva,SELECTOR_RVA:selectorRva,OPTION_RVA:optionRva,RECEIVE_RVA:receiveRva,BRUSH_RVA:brushRva};
// Execute the real entry/guard/selector, then a synthetic continuation with
// the original six-byte prologue and normal Delphi two-local return shape.
// The inherited form implementation calls real VCL and is not executed here.
const continuation=Buffer.from('8955f88945fc8b45f8c7400c0100000059595dc3','hex');
const header=[...Object.entries(definitions).map(([k,v])=>'#define FX_'+k+' '+v+'u'),'#define FX_CANDIDATE_SHA "'+candidateSHA256+'"',array('fx_handler',out.subarray(handler,handler+6)),array('fx_continuation',continuation),array('fx_guard',out.subarray(guardAt,guardAt+site.size)),array('fx_before_guard',guard),array('fx_selector',selector),'static const U32 fx_iats[] = {'+iats.map(v=>v+'u').join(',')+'};','static const U32 fx_dynamic[] = {'+['GetObjectType','GetROP2','GetGraphicsMode','GetLayout'].map(n=>meta.nativeInitialErase.dynamicSlots[n]+'u').join(',')+'};'].join('\n')+'\n';
fs.writeFileSync(path.join(stage,'receive-erase-fixture.h'),header);
const report={baselineSHA256,candidateSHA256,dest,generatorSHA256:sha(fs.readFileSync(__filename)),fixtureHeaderSHA256:sha(header),selectorRva,selectorBytes:16,appendBytes:0,changedBytes,reverseRestoresExactInput:true,otherPropertiesAndResourcesUnchanged:true,resource:{name:r.name,oldColor:'clWindow',newColor:0x202020,oldSize:r.size,newSize:changed.length},scope:'Exact TDlgNetTaskProgress joins existing TOptionForm validated prefill. Only its root Color changes. Original continuation unmodified.',installed:false};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
