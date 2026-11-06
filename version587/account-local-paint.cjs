'use strict';
// Suppress the inherited themed frame in TFMGroupBox's alternate Paint route.
// Its custom WM_PAINT/ERASE/NC handlers and child painting remain byte-identical.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),stage=paths.output('version587-account-paint');
const input=path.join(paths.output('version587-notification'),'Foxmail深色.exe'),b=fs.readFileSync(input),out=Buffer.from(b);
assert.equal(sha(b),'ce79d169ad6f908a4607ccc160efb17ce21b6afbcb9b8d1018c17331fff06c4a');
const pe=b.readUInt32LE(60),op=pe+24,so=op+b.readUInt16LE(pe+20),ss=[];
for(let i=0;i<b.readUInt16LE(pe+6);i++){const p=so+40*i;ss.push({r:b.readUInt32LE(p+12),p:b.readUInt32LE(p+20),n:b.readUInt32LE(p+16)});}
const off=va=>{const s=ss.find(s=>va-0x400000>=s.r&&va-0x400000<s.r+s.n);assert(s);return s.p+va-0x400000-s.r;};
const vmt=0xb6a5e8,slot=vmt+0xc8,old=0x87aebc,replacement=0x11365b0;
assert.equal(b.readUInt32LE(off(vmt-76)),vmt);assert.equal(b.readUInt32LE(off(vmt-40)),536);
assert.equal(b.readUInt32LE(off(slot)),old);
assert(b.subarray(off(old),off(old)+12).equals(Buffer.from('558bec518945fca1a4bc2e01','hex').subarray(0,12)),'Inherited paint body changed');
assert(b.subarray(off(replacement),off(replacement)+10).equals(Buffer.from('558bec518945fc595dc3','hex')),'Empty TCustomControl.Paint changed');
out.writeUInt32LE(replacement,off(slot));let changed=0;for(let i=0;i<b.length;i++)if(b[i]!==out[i]){assert(i>=off(slot)&&i<off(slot)+4);changed++;}assert.equal(changed,4);
const handlers=[0xb6abc0,0xb6ab78,0xb6ab9c,0xb6a808].map(va=>({va,unchanged:b.subarray(off(va),off(va)+32).equals(out.subarray(off(va),off(va)+32))}));assert(handlers.every(x=>x.unchanged));
const dest=path.join(stage,'Foxmail深色.exe');fs.writeFileSync(dest,out);
const report={input,baselineSHA256:sha(b),dest,candidateSHA256:sha(out),vmt,slot,old,replacement,changedBytes:changed,handlers,allOtherBytesUnchanged:true,noNewHooksOrInstructions:true,helperSHA256:'29efc7d9ec5b402f6a00a165a586f0762ec51aa2495cdcdc8e0a5fb31bc05515',scope:'TFMGroupBox inherited Paint dispatch only. Ordinary custom WM_PAINT (including PaintControls), WM_ERASEBKGND and WM_NCPAINT unchanged. Alternate native theme frame suppressed; visual efficacy unproven.',visualAccepted:false};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({dest,sha:sha(out),changedBytes:changed,normalHandlersUnchanged:true}));
