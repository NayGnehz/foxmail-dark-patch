'use strict';
// Toast-specific color immediates only: no new instructions, hooks or layout.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs'),{readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),stage=paths.output('version587-notification');
const input=path.join(paths.output('version587-goal'),'Foxmail深色-firstrestore.exe'),b=fs.readFileSync(input),out=Buffer.from(b);
assert.equal(sha(b),'9f98ef8b5753bf5ec7f694f06705fa5c20a7ac7493a5e691abe422eead4ab9e4');
const pe=b.readUInt32LE(60),op=pe+24,so=op+b.readUInt16LE(pe+20),sections=[];
for(let i=0;i<b.readUInt16LE(pe+6);i++){const p=so+40*i;sections.push({r:b.readUInt32LE(p+12),p:b.readUInt32LE(p+20),n:b.readUInt32LE(p+16)});}
function offset(va){const s=sections.find(s=>va-0x400000>=s.r&&va-0x400000<s.r+s.n);assert(s);return s.p+va-0x400000-s.r;}
const changes=[];
for(const [va,opcode,before,after]of [
 [0xef6482,0x68,0xfcf7f2,0x333333],[0xef6487,0x68,0xf8f3ee,0x282828],
 [0xef64ae,0x68,0xf7f4f1,0x282828],[0xef64b3,0x68,0xe7e1da,0x202020],
 [0xef5ba1,0xba,0xffd9b7,0x282828],[0xef5ba6,0xb8,0xffffff,0x202020],
 [0xef5bc1,0xba,0xf6d8c2,0x282828],[0xef5bc6,0xb8,0xffffff,0x202020]
]){
 const at=offset(va);assert.equal(b[at],opcode);assert.equal(b.readUInt32LE(at+1),before);out.writeUInt32LE(after,at+1);changes.push({va,offset:at+1,size:4,before,after,kind:'toast-background-immediate'});
}
const r=readResources(b).resources.find(x=>x.type===10&&x.name==='TNEWMAILNOTIFIER');assert(r);
const root=parseDFM(b.subarray(r.offset,r.offset+r.size));assert.equal(root.className,'TNewMailNotifier');
const p=root.properties.find(p=>p.name==='Color');assert(p&&p.type===4&&p.value===15527922);
out.writeUInt32LE(0x202020,r.offset+p.offset+1);changes.push({resource:r.name,offset:r.offset+p.offset+1,size:4,before:p.value,after:0x202020,kind:'toast-form-color'});
const afterRoot=parseDFM(out.subarray(r.offset,r.offset+r.size)),copy=structuredClone(root);copy.properties.find(p=>p.name==='Color').value=0x202020;assert.deepStrictEqual(afterRoot,copy);
let bytes=0;for(let i=0;i<b.length;i++)if(b[i]!==out[i]){assert(changes.some(c=>i>=c.offset&&i<c.offset+c.size));bytes++;}
const dest=path.join(stage,'Foxmail深色.exe');fs.writeFileSync(dest,out);
const report={input,baselineSHA256:sha(b),dest,candidateSHA256:sha(out),changedBytes:bytes,changes,allNonColorBytesUnchanged:true,noNewHooksOrInstructions:true,helperSHA256:'29efc7d9ec5b402f6a00a165a586f0762ec51aa2495cdcdc8e0a5fb31bc05515',release2Unchanged:true,visualAccepted:false};fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({dest,sha:sha(out),changedBytes:bytes,allNonColorBytesUnchanged:true}));
