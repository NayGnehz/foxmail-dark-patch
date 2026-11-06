'use strict';
// Numeric-only account-parent attribution; every handler still executes unchanged.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),align=(x,a)=>Math.ceil(x/a)*a;
const stage=paths.output('version587-account-instance-counter'),input=path.join(paths.output('version587-compose-ready'),'Foxmail深色.exe'),b=fs.readFileSync(input);
const baselineSHA256='62faa3d801b1fcf8726a5b29f9636b8cc6e0fbec96e215ff7c856be6bbb5e52c';assert.equal(sha(b),baselineSHA256);
const pe=b.readUInt32LE(60),op=pe+24,so=op+b.readUInt16LE(pe+20),ns=b.readUInt16LE(pe+6),base=b.readUInt32LE(op+28),ss=[];
assert.equal(base,0x400000);assert.equal(b.readUInt16LE(pe+4),0x14c);assert.equal(b.readUInt16LE(op),0x10b);
for(let i=0;i<ns;i++){const h=so+i*40;ss.push({h,name:b.toString('ascii',h,h+8).replace(/\0/g,''),r:b.readUInt32LE(h+12),p:b.readUInt32LE(h+20),n:b.readUInt32LE(h+16),v:b.readUInt32LE(h+8)});}
const off=r=>{const s=ss.find(s=>r>=s.r&&r<s.r+s.n);assert(s);return s.p+r-s.r;},read=va=>b.readUInt32LE(off(va-base));
const groupVmtRva=0x76a5e8,parentVmtRva=0x9aa69c;
for(const [v,size]of [[base+groupVmtRva,536],[base+parentVmtRva,904]]){assert.equal(read(v-76),v);assert.equal(read(v-40),size);}
assert.equal(b.subarray(off(0xd27974),off(0xd27974)+11).toString('hex'),'8b45fc8b4030e8b5550000'); // Parent background Perform on Self+30.
const table=read(base+groupVmtRva-48),count=b.readUInt16LE(off(table-base));assert(count<4096);
const hooks=[{name:'paint',slotRva:groupVmtRva+0xc8,targetRva:0x47aebc}];
for(const [message,name,target]of [[15,'wmPaint',0xb6abc0],[20,'erase',0xb6ab78],[0x85,'ncPaint',0xb6ab9c]]){
 const matches=[];for(let i=0;i<count;i++)if(b.readUInt16LE(off(table+2+2*i-base))===message)matches.push(table+2+2*count+4*i-base);
 assert.equal(matches.length,1);hooks.push({name,message,slotRva:matches[0],targetRva:target-base});
}
const relocated=new Set(),rr=b.readUInt32LE(op+136),rn=b.readUInt32LE(op+140);
for(let p=off(rr),end=p+rn;p<end;){const page=b.readUInt32LE(p),n=b.readUInt32LE(p+4);assert(n>=8&&p+n<=end);for(let q=p+8;q<p+n;q+=2){const x=b.readUInt16LE(q);if((x>>>12)===3)relocated.add(page+(x&4095));}p+=n;}
const last=ss.at(-1);assert.equal(last.name,'.fxcnca');assert.equal(last.p+last.n,b.length);assert.equal((b.readUInt32LE(last.h+36)&0xe0000000)>>>0,0xe0000000);
const appendRva=last.r+align(Math.max(last.n,last.v),16),payload=[];
for(const hook of hooks){
 assert.equal(read(base+hook.slotRva),base+hook.targetRva);assert(relocated.has(hook.slotRva),'Existing pointer relocation required');
 while(payload.length%16)payload.push(0);hook.stubRva=appendRva+payload.length;
 const c=[],fix=[],byte=(...x)=>c.push(...x),u32=x=>{const q=Buffer.alloc(4);q.writeUInt32LE(x>>>0);byte(...q);},fail=()=>{byte(0x0f,0x85);fix.push(c.length);u32(0);},zero=()=>{byte(0x0f,0x84);fix.push(c.length);u32(0);};
 byte(0x9c,0x60,0xe8,0,0,0,0,0x5f,0x81,0xef);u32(hook.stubRva+7);
 byte(0xf0,0xff,0x87);const allAt=c.length;u32(0);
 byte(0x85,0xc0);zero();byte(0x8d,0x97);u32(groupVmtRva);byte(0x39,0x10);fail();
 byte(0x39,0x52,0xb4);fail();byte(0x81,0x7a,0xd8);u32(536);fail();
 byte(0x8b,0x40,0x30,0x85,0xc0);zero();byte(0x8d,0x97);u32(parentVmtRva);byte(0x39,0x10);fail();
 byte(0x39,0x52,0xb4);fail();byte(0x81,0x7a,0xd8);u32(904);fail();
 byte(0xf0,0xff,0x87);const accountAt=c.length;u32(0);
 const done=c.length;byte(0x61,0x9d,0xe9);u32(hook.targetRva-(hook.stubRva+c.length+4));
 const stub=Buffer.from(c);hook.allCallsRva=hook.stubRva+align(stub.length,4);hook.accountCallsRva=hook.allCallsRva+4;
 stub.writeUInt32LE(hook.allCallsRva,allAt);stub.writeUInt32LE(hook.accountCallsRva,accountAt);for(const at of fix)stub.writeInt32LE(done-at-4,at);
 hook.allCounterRva=hook.allCallsRva;hook.accountCounterRva=hook.accountCallsRva;
 hook.stubHex=stub.toString('hex');hook.slotRelocated=true;payload.push(...stub);while((appendRva+payload.length)<hook.accountCallsRva+4)payload.push(0);
}
const virtualSize=appendRva-last.r+payload.length,fa=b.readUInt32LE(op+36),sa=b.readUInt32LE(op+32),rawSize=align(virtualSize,fa),out=Buffer.alloc(last.p+rawSize);b.copy(out);Buffer.from(payload).copy(out,last.p+appendRva-last.r);
out.writeUInt32LE(virtualSize,last.h+8);out.writeUInt32LE(rawSize,last.h+16);out.writeUInt32LE(align(last.r+virtualSize,sa),op+56);out.writeUInt32LE(0,op+64);
for(const h of hooks)out.writeUInt32LE(base+h.stubRva,off(h.slotRva));
const allowed=[[last.h+8,last.h+12],[last.h+16,last.h+20],[op+56,op+60],[op+64,op+68],...hooks.map(h=>[off(h.slotRva),off(h.slotRva)+4])];
for(let i=0;i<b.length;i++)if(b[i]!==out[i])assert(allowed.some(([a,z])=>a<=i&&i<z),'Unexpected baseline change');
const candidateSHA256=sha(out),dest=path.join(stage,'Foxmail深色.exe');fs.writeFileSync(dest,out);
const report={input,baselineSHA256,dest,candidateSHA256,appendRva,groupVmtRva,parentVmtRva,parentOffset:48,groupSize:536,parentSize:904,hooks,helperSHA256:'0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70',originalEntryUnchanged:out.readUInt32LE(op+16)===b.readUInt32LE(op+16),allOriginalPaintingCodeUnchanged:true,scope:'Four original dispatch pointers only. Each stub counts all calls and calls on exact TFMGroupBox whose direct Parent is exact TAccountOptionFrame; original code always tail-jumped. No API, object recording, painting change or visual fix.',installed:false};
report.cssSHA256='8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8';report.originalPayloadsExceptSlotsUnchanged=true;report.generatorSHA256=sha(fs.readFileSync(__filename));
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));
const header=[`#define FX_CANDIDATE_SHA "${candidateSHA256}"`,`#define FX_GROUP_VMT_RVA ${groupVmtRva}u`,`#define FX_PARENT_VMT_RVA ${parentVmtRva}u`,`#define FX_IMAGE_LIMIT ${align(last.r+virtualSize,sa)+4096}u`,`#define FX_HOOK_COUNT ${hooks.length}u`,...hooks.map((h,i)=>`static const unsigned char hook_${i}[] = {${[...Buffer.from(h.stubHex,'hex')].join(',')}};`),'typedef struct {const unsigned char *bytes; U32 length, entry, target, all, account;} Hook;','static const Hook hooks[] = {',...hooks.map((h,i)=>`{hook_${i},sizeof(hook_${i}),${h.stubRva}u,${h.targetRva}u,${h.allCallsRva}u,${h.accountCallsRva}u},`),'};'].join('\n');fs.writeFileSync(path.join(stage,'account-instance-stub.h'),header+'\n');
fs.renameSync(path.join(stage,'account-instance-stub.h'),path.join(stage,'account-instance-counter-stub.h'));
console.log(JSON.stringify({candidateSHA256,dest,appendRva,hooks}));
