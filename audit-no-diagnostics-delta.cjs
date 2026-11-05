'use strict';
// FOXMAIL_RETIRED_BASELINE_CLI: preserve patchBuffer exports; do not consume retired old EXE.
if (require.main === module) { throw new Error('Retired historical baseline CLI. See audit-no-diagnostics-delta.json; use the current print/compose entry.'); }
'use strict';
const fs=require('fs'),crypto=require('crypto'),assert=require('assert');
const baselinePath='SourceBackupBeforeTransientBuffer-EDF4328F/Foxmail-dark-fixed.exe';
const oldMeta=JSON.parse(fs.readFileSync('SourceBackupBeforeTransientBuffer-EDF4328F/Foxmail-dark.exe.json','utf8'));
const meta=JSON.parse(fs.readFileSync('Foxmail-dark.exe.json','utf8'));
const old=fs.readFileSync(baselinePath),next=fs.readFileSync('Foxmail-dark-fixed.exe');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(hash(old),'edf4328f8f821ffbea85a0783f5c30f7054bbdf4dcaa37d6a2911a2557820c48');
assert.equal(meta.nativePaintPhase,null);assert.equal(meta.nativeTransientBuffer,null);
assert(!meta.nativeInitialErase.diagnostics);
assert.deepEqual(meta.nativeDisplay.attributes,oldMeta.nativeDisplay.attributes);
assert.equal(meta.nativeDisplay.transitionPolicy,oldMeta.nativeDisplay.transitionPolicy);
assert.deepEqual(meta.nativeInitialErase.sites.map(s=>[s.name,s.originalRva,s.expectedHex,s.vmtRvas]),oldMeta.nativeInitialErase.sites.map(s=>[s.name,s.originalRva,s.expectedHex,s.vmtRvas]));
function sections(b){let pe=b.readUInt32LE(60),at=pe+24+b.readUInt16LE(pe+20);return Array.from({length:b.readUInt16LE(pe+6)},(_,i)=>{let p=at+i*40;return {name:b.toString('ascii',p,p+8).replace(/\0.*$/,''),rva:b.readUInt32LE(p+12),raw:b.readUInt32LE(p+20),size:b.readUInt32LE(p+16)};});}
const a=sections(old),b=sections(next),allowed=new Set();
for(const p of oldMeta.nativePaintPhase.patches){const n=p.patchType==='prologue6'?6:5;for(let i=0;i<n;i++)allowed.add(p.originalRva+i);}
for(const p of meta.nativeInitialErase.sites)for(let i=0;i<6;i++)allowed.add(p.originalRva+i);
for(let i=0;i<6;i++)allowed.add(0x4b62d4+i);
let changed=0;const report=[];
for(const s of a){const t=b.find(x=>x.name===s.name);assert(t);const before=old.subarray(s.raw,s.raw+s.size),after=next.subarray(t.raw,t.raw+t.size);const same=before.equals(after);report.push({name:s.name,identical:same,oldSize:s.size,newSize:t.size});if(!['CODE','.fxdark'].includes(s.name))assert(same,'Unexpected section change '+s.name);if(s.name==='CODE'){assert.equal(s.size,t.size);for(let i=0;i<s.size;i++)if(before[i]!==after[i]){assert(allowed.has(s.rva+i),'Unexpected code change '+(s.rva+i).toString(16));changed++;}}}
for(const p of oldMeta.nativePaintPhase.patches){const s=b.find(s=>p.originalRva>=s.rva&&p.originalRva<s.rva+s.size);const at=s.raw+p.originalRva-s.rva;assert(next.subarray(at,at+p.expectedHex.length/2).equals(Buffer.from(p.expectedHex,'hex')),'Diagnostic site not restored '+p.name);}
const out={baselineSHA256:hash(old),candidateSHA256:hash(next),changedCodeBytes:changed,restoredDiagnosticSites:oldMeta.nativePaintPhase.patches.length,diagnosticsRemoved:true,windowCompositingUnchanged:true,sections:report};
fs.writeFileSync('audit-no-diagnostics-delta.json',JSON.stringify(out,null,2));
console.log(JSON.stringify(out));
