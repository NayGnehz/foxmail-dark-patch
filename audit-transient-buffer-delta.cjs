'use strict';
// FOXMAIL_RETIRED_BASELINE_CLI: preserve patchBuffer exports; do not consume retired old EXE.
if (require.main === module) { throw new Error('Retired historical baseline CLI. See audit-transient-buffer-delta.json; use the current print/compose entry.'); }
'use strict';
const fs=require('fs'),crypto=require('crypto');
const before=fs.readFileSync('SourceBackupBeforeTransientBuffer-EDF4328F/Foxmail-dark-fixed.exe');
const after=fs.readFileSync('Foxmail-dark-fixed.exe');
const meta=JSON.parse(fs.readFileSync('Foxmail-dark.exe.json','utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function sections(b){const p=b.readUInt32LE(60),s=p+24+b.readUInt16LE(p+20),n=b.readUInt16LE(p+6),out=[];for(let i=0;i<n;i++){const x=s+40*i;out.push({name:b.toString('ascii',x,x+8).replace(/\0.*$/,''),rva:b.readUInt32LE(x+12),raw:b.readUInt32LE(x+20),size:b.readUInt32LE(x+16)});}return out;}
const old=sections(before),next=sections(after),report={baselineSHA256:hash(before),candidateSHA256:hash(after),candidateExperimentalBuffer:meta.nativeTransientBuffer,sections:[],codeChanges:[]};
for(const s of old){const t=next.find(x=>x.name===s.name);if(!t)throw Error('Missing section '+s.name);const a=before.subarray(s.raw,s.raw+s.size),b=after.subarray(t.raw,t.raw+t.size);const identical=a.equals(b);report.sections.push({name:s.name,identical,beforeBytes:a.length,afterBytes:b.length});if(!identical&&!['CODE','.fxdark'].includes(s.name))throw Error('Unexpected changed section '+s.name);if(s.name==='CODE')for(let j=0;j<a.length;j++)if(a[j]!==b[j])report.codeChanges.push({rva:s.rva+j,before:a[j],after:b[j]});}
if(report.baselineSHA256!=='edf4328f8f821ffbea85a0783f5c30f7054bbdf4dcaa37d6a2911a2557820c48')throw Error('Wrong baseline');
if(!meta.nativeTransientBuffer||meta.nativeTransientBuffer.mainClass!=='TFoxMainFrm.UnicodeClass')throw Error('Wrong experimental scope');
fs.writeFileSync('audit-transient-buffer-delta.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({baseline:report.baselineSHA256,candidate:report.candidateSHA256,changedCodeBytes:report.codeChanges.length,unchangedSections:report.sections.filter(s=>s.identical).map(s=>s.name),scope:meta.nativeTransientBuffer.mainClass}));
