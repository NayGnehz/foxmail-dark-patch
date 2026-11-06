'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const paths=require('../foxmail-paths.cjs'),stage=paths.output('version587-borders'),prior=paths.output('version587-native'),mapping=paths.output('version587');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const info=JSON.parse(fs.readFileSync(path.join(prior,'native-colors-validation.json'),'utf8'));
const input=fs.readFileSync(info.dest);assert.equal(sha(input),info.candidateSHA256);
const maps=JSON.parse(fs.readFileSync(path.join(mapping,'native-map.json'),'utf8')),mp=new Map(maps.code.map(x=>[x.oldVA,x.newVA]));
const pe=input.readUInt32LE(60),op=pe+24,so=op+input.readUInt16LE(pe+20),sections=[];
for(let i=0;i<input.readUInt16LE(pe+6);i++){const q=so+i*40;sections.push({r:input.readUInt32LE(q+12),p:input.readUInt32LE(q+20),n:input.readUInt32LE(q+16)});}
const off=va=>{const s=sections.find(s=>va-0x400000>=s.r&&va-0x400000<s.r+s.n);assert(s);return s.p+va-0x400000-s.r;};
let out=Buffer.from(input);const changes=[];
for(const [oldVA,opcode,before,after,label]of [[0xfb9173,0xba,0xffffff,0x202020,'Search input background'],[0xa2cd81,0xba,0xd0c7be,0x3d3d3d,'Shared dialog footer separator'],[0xc12ca5,0x68,0xd0c5b9,0x3d3d3d,'Bevel first pen'],[0xc12ced,0x68,0xffffff,0x282828,'Bevel highlight pen'],[0xb899df,0xba,0xffffff,0x202020,'Native editor shell background'],[0xb89268,0xba,0xff000005,0x202020,'Native browser-parent background']]){
 assert(mp.has(oldVA));const va=mp.get(oldVA),p=off(va);assert.equal(out[p],opcode);assert.equal(out.readUInt32LE(p+1),before,label);out.writeUInt32LE(after,p+1);changes.push({label,oldVA,newVA:va,offset:p+1,size:4,before,after});
}
const helper=JSON.parse(fs.readFileSync(path.join(mapping,'shared-underpaint-map.json'),'utf8'));
const fn=off(helper.newVA);assert.equal(sha(out.subarray(fn,fn+helper.size)),helper.originalNewSHA256);
const p=off(helper.newSiteVA),before=Buffer.from('817d10ffffff1f7408','hex'),after=Buffer.from('c745e420202000eb23','hex');assert(out.subarray(p,p+9).equals(before));after.copy(out,p);changes.push({label:'Nine verified UI callers shared outline underpaint',offset:p,size:9,newVA:helper.newSiteVA});
const skin=require('../cosmetic-1.1/patch-edit-input-skins.cjs').patchBuffer(out);out=skin.buffer;
for(const u of skin.undo)changes.push({label:u.name,offset:u.offset,size:Buffer.from(u.beforeBase64,'base64').length});
const ranges=changes.map(x=>[x.offset,x.offset+x.size]).sort((a,b)=>a[0]-b[0]);let at=0,bytes=0;
for(let i=0;i<input.length;i++)if(input[i]!==out[i]){while(at<ranges.length&&ranges[at][1]<=i)at++;assert(at<ranges.length&&ranges[at][0]<=i,'Unexpected border delta');bytes++;}
const dest=path.join(stage,'Foxmail深色.exe');fs.writeFileSync(dest,out);
const report={version:'7.2.25.587',inputSHA256:sha(input),candidateSHA256:sha(out),dest,changes,changedBytes:bytes,skin:skin.report,scope:'Six color operands, nine-byte local outline palette branch, four input PNGs with identical alpha and dimensions. No font/events/layout/CEF/transport data changes.',visualAccepted:false};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({sha:sha(out),changes:changes.length,bytes}));
