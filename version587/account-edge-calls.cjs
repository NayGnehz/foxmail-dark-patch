'use strict';
// Suppress only group frame drawing calls for the exact account-parent instance.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),align=(x,a)=>Math.ceil(x/a)*a;
const stage=paths.output('version587-account-edge-calls'),input=path.join(paths.output('version587-compose-ready'),'Foxmail深色.exe'),b=fs.readFileSync(input);
const baselineSHA256='62faa3d801b1fcf8726a5b29f9636b8cc6e0fbec96e215ff7c856be6bbb5e52c';assert.equal(sha(b),baselineSHA256);
const pe=b.readUInt32LE(60),op=pe+24,so=op+b.readUInt16LE(pe+20),ns=b.readUInt16LE(pe+6),base=b.readUInt32LE(op+28),ss=[];
assert.equal(base,0x400000);assert.equal(b.readUInt16LE(pe+4),0x14c);assert.equal(b.readUInt16LE(op),0x10b);
for(let i=0;i<ns;i++){const h=so+i*40;ss.push({h,name:b.toString('ascii',h,h+8).replace(/\0/g,''),r:b.readUInt32LE(h+12),p:b.readUInt32LE(h+20),n:b.readUInt32LE(h+16),v:b.readUInt32LE(h+8)});}
const off=r=>{const s=ss.find(s=>r>=s.r&&r<s.r+s.n);assert(s);return s.p+r-s.r;},read=va=>b.readUInt32LE(off(va-base));
const groupVmtRva=0x76a5e8,parentVmtRva=0x9aa69c;
for(const [v,size]of [[base+groupVmtRva,536],[base+parentVmtRva,904]]){assert.equal(read(v-76),v);assert.equal(read(v-40),size);}
assert.equal(b.subarray(off(0xd27974),off(0xd27974)+11).toString('hex'),'8b45fc8b4030e8b5550000'); // Parent background Perform on Self+30.
const hooks=[{name:'themeFrame',siteRva:0x47abc4,targetRva:0x29d80c,stackBytes:8},{name:'legacyHighlight',siteRva:0x47acfe,targetRva:0x2576d4,stackBytes:0},{name:'legacyFrame',siteRva:0x47ad38,targetRva:0x2576d4,stackBytes:0}];
assert.equal(b.subarray(off(0x29d84f),off(0x29d84f)+4).toString('hex'),'5dc20800');
assert.equal(b.subarray(off(0x25771a),off(0x25771a)+4).toString('hex'),'59595dc3');
// Both nested frame painters obtain the original 87AEBC frame through EBP+8.
for(const r of [0x47aa76,0x47ac82])assert.equal(b.subarray(off(r),off(r)+6).toString('hex'),'8b45088b40fc');
const last=ss.at(-1);assert.equal(last.name,'.fxcnca');assert.equal(last.p+last.n,b.length);assert.equal((b.readUInt32LE(last.h+36)&0xe0000000)>>>0,0xe0000000);
const appendRva=last.r+align(Math.max(last.n,last.v),16),payload=[];
for(const hook of hooks){
 const site=off(hook.siteRva);assert.equal(b[site],0xe8);assert.equal(hook.siteRva+5+b.readInt32LE(site+1),hook.targetRva);hook.originalSiteHex=b.subarray(site,site+5).toString('hex');
 while(payload.length%16)payload.push(0);hook.stubRva=appendRva+payload.length;
 const c=[],fix=[],byte=(...x)=>c.push(...x),u32=x=>{const q=Buffer.alloc(4);q.writeUInt32LE(x>>>0);byte(...q);},fail=()=>{byte(0x0f,0x85);fix.push(c.length);u32(0);},zero=()=>{byte(0x0f,0x84);fix.push(c.length);u32(0);};
 byte(0x9c,0x60,0xe8,0,0,0,0,0x5f,0x81,0xef);u32(hook.stubRva+7);
 byte(0xf0,0xff,0x87);const allAt=c.length;u32(0);
 byte(0x8b,0x45,8,0x85,0xc0);zero();byte(0x8b,0x40,0xfc);
 byte(0x85,0xc0);zero();byte(0x8d,0x97);u32(groupVmtRva);byte(0x39,0x10);fail();
 byte(0x39,0x52,0xb4);fail();byte(0x81,0x7a,0xd8);u32(536);fail();
 byte(0x8b,0x40,0x30,0x85,0xc0);zero();byte(0x8d,0x97);u32(parentVmtRva);byte(0x39,0x10);fail();
 byte(0x39,0x52,0xb4);fail();byte(0x81,0x7a,0xd8);u32(904);fail();
 byte(0xf0,0xff,0x87);const accountAt=c.length;u32(0);
 byte(0x61,0x9d);if(hook.stackBytes)byte(0xc2,hook.stackBytes,0);else byte(0xc3);
 const done=c.length;byte(0x61,0x9d,0xe9);u32(hook.targetRva-(hook.stubRva+c.length+4));
 const stub=Buffer.from(c);hook.allCallsRva=hook.stubRva+align(stub.length,4);hook.accountCallsRva=hook.allCallsRva+4;
 stub.writeUInt32LE(hook.allCallsRva,allAt);stub.writeUInt32LE(hook.accountCallsRva,accountAt);for(const at of fix)stub.writeInt32LE(done-at-4,at);
 hook.allCounterRva=hook.allCallsRva;hook.accountCounterRva=hook.accountCallsRva;
 hook.stubHex=stub.toString('hex');payload.push(...stub);while((appendRva+payload.length)<hook.accountCallsRva+4)payload.push(0);
}
const virtualSize=appendRva-last.r+payload.length,fa=b.readUInt32LE(op+36),sa=b.readUInt32LE(op+32),rawSize=align(virtualSize,fa),out=Buffer.alloc(last.p+rawSize);b.copy(out);Buffer.from(payload).copy(out,last.p+appendRva-last.r);
out.writeUInt32LE(virtualSize,last.h+8);out.writeUInt32LE(rawSize,last.h+16);out.writeUInt32LE(align(last.r+virtualSize,sa),op+56);out.writeUInt32LE(0,op+64);
for(const h of hooks){const p=off(h.siteRva);out[p]=0xe8;out.writeInt32LE(h.stubRva-h.siteRva-5,p+1);h.siteHex=out.subarray(p,p+5).toString('hex');}
const allowed=[[last.h+8,last.h+12],[last.h+16,last.h+20],[op+56,op+60],[op+64,op+68],...hooks.map(h=>[off(h.siteRva),off(h.siteRva)+5])];
for(let i=0;i<b.length;i++)if(b[i]!==out[i])assert(allowed.some(([a,z])=>a<=i&&i<z),'Unexpected baseline change');
const candidateSHA256=sha(out),dest=path.join(stage,'Foxmail深色.exe');fs.writeFileSync(dest,out);
for(const h of hooks){h.callVA=base+h.siteRva;h.cleanupBytes=h.stackBytes;h.skippedCounterRva=h.accountCounterRva;h.returnIgnoredProof=h.name==='themeFrame'?'87ABC9 push 0; next operation overwrites EAX via canvas/DC getter':'After 87ACFE: pushes -1/-1 and obtains local rect; after 87AD38: obtains caption via 87AA18; EAX output unused';}
const report={input,baselineSHA256,dest,candidateSHA256,appendRva,groupVmtRva,parentVmtRva,parentOffset:48,groupSize:536,parentSize:904,guardSelf:'[[EBP+8]-4]',hooks,helperSHA256:'0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70',originalEntryUnchanged:out.readUInt32LE(op+16)===b.readUInt32LE(op+16),scope:'Three drawing calls only: theme group frame and two legacy FrameRect calls. Exact TFMGroupBox with exact direct TAccountOptionFrame parent skips drawing calls; other instances tail-jump original callee. Inherited Paint setup, captions and cleanup preserved. No new API, timings, DPI or object logging.',installed:false};
report.cssSHA256='8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8';report.originalPayloadsExceptSitesUnchanged=true;report.generatorSHA256=sha(fs.readFileSync(__filename));
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));
const header=[`#define FX_CANDIDATE_SHA "${candidateSHA256}"`,`#define FX_GROUP_VMT_RVA ${groupVmtRva}u`,`#define FX_PARENT_VMT_RVA ${parentVmtRva}u`,`#define FX_IMAGE_LIMIT ${align(last.r+virtualSize,sa)+4096}u`,`#define FX_HOOK_COUNT ${hooks.length}u`,...hooks.map((h,i)=>`static const unsigned char hook_${i}[] = {${[...Buffer.from(h.stubHex,'hex')].join(',')}};\nstatic const unsigned char site_${i}[] = {${[...Buffer.from(h.siteHex,'hex')].join(',')}};`),'typedef struct {const unsigned char *bytes; const unsigned char *siteBytes; U32 length, entry, target, all, account, stackBytes, site;} Hook;','static const Hook hooks[] = {',...hooks.map((h,i)=>`{hook_${i},site_${i},sizeof(hook_${i}),${h.stubRva}u,${h.targetRva}u,${h.allCallsRva}u,${h.accountCallsRva}u,${h.stackBytes}u,${h.siteRva}u},`),'};'].join('\n');fs.writeFileSync(path.join(stage,'account-edge-calls-stub.h'),header+'\n');
console.log(JSON.stringify({candidateSHA256,dest,appendRva,hooks}));
