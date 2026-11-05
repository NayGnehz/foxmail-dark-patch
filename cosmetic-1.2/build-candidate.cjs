'use strict';
// FOXMAIL_RETIRED_BASELINE_CLI: preserve patchBuffer exports; do not consume retired old EXE.
if (require.main === module) { throw new Error('Retired historical baseline CLI. See docs/cleanup-report-20261105.md; use the current print/compose entry.'); }
'use strict';
// Apply scoped edit underpaint and combo shadow corrections to version 1.1.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),app='D:/Users/Public/Downloads/Foxmail';
const {readResources}=require('../pe-resource-utils.cjs');
const {pngDecode}=require('../recolor-search-scrollbars.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline=fs.readFileSync(path.join(root,'cosmetic-1.1/payload/Foxmail深色.exe'));
if(sha(baseline)!=='a94d69a626b2a01b1ae017e5b1e704e325ad8f5331f0ab2be1c97682c2829d12')throw Error('Unexpected 1.1 baseline');
if(!fs.readFileSync(path.join(app,'Foxmail深色.exe')).equals(baseline))throw Error('Installed version differs from 1.1');
const pristine=fs.readFileSync(path.join(app,'Foxmail.exe'));
if(sha(pristine)!=='54da7a968ad8a12bf80978269edfc57f520af9f19a18e5b78bf48742983dd4df')throw Error('Unsupported pristine reference');
const edits=require('./patch-edit-underpaint.cjs').patchBuffer(baseline);
const combo=require('./patch-advanced-combo-gesture.cjs').patchBuffer(edits.buffer,pristine);
const out=combo.buffer,changes=[...edits.changes,...combo.changes];
if(out.length!==baseline.length)throw Error('PE length changed');
const prior=readResources(baseline).resources,next=readResources(out).resources;
const originalResources=readResources(pristine).resources;
const changedNames=new Set(combo.changes.map(x=>x.name));
const ranges=edits.changes.map(x=>[x.offset,x.offset+x.size]);
let pngChecks=0;
for(const name of changedNames){
 const a=prior.find(r=>r.type===10&&r.name===name),b=next.find(r=>r.type===10&&r.name===name),allocation=originalResources.find(r=>r.type===10&&r.name===name);
 if(!a||!b||!allocation||a.offset!==b.offset||a.offset!==allocation.offset||a.dataEntry!==b.dataEntry||a.dataEntry!==allocation.dataEntry||b.size>allocation.size)throw Error('Resource allocation changed '+name);
 ranges.push([a.offset,a.offset+allocation.size],[a.dataEntry+4,a.dataEntry+8]);
 const old=pngDecode(baseline.subarray(a.offset,a.offset+a.size)),updated=pngDecode(out.subarray(b.offset,b.offset+b.size));
 if(old.width!==updated.width||old.height!==updated.height)throw Error('Dimensions changed '+name);
 if(!Buffer.from(old.phys||[]).equals(Buffer.from(updated.phys||[])))throw Error('PNG density changed '+name);
 const finalRow=(old.height-1)*old.width*4;
 if(!old.rgba.subarray(0,finalRow).equals(updated.rgba.subarray(0,finalRow)))throw Error('Combo pixels outside shadow row changed '+name);
 for(let i=finalRow;i<updated.rgba.length;i+=4)if(!updated.rgba.subarray(i,i+4).equals(Buffer.from([32,32,32,255])))throw Error('Unexpected shadow-row pixel '+name);
 pngChecks++;
}
let changedBytes=0;
for(let i=0;i<out.length;i++)if(out[i]!==baseline[i]){changedBytes++;if(!ranges.some(([a,b])=>i>=a&&i<b))throw Error('Unlisted delta '+i.toString(16));}
if(pngChecks!==4)throw Error('Expected four bounded combo sprite resources');
const pe=out.readUInt32LE(60),op=pe+24,so=op+out.readUInt16LE(pe+20),sectionChecks=[];
for(let i=0;i<out.readUInt16LE(pe+6);i++){
 const p=so+i*40,name=out.toString('ascii',p,p+8).replace(/\0/g,''),raw=out.readUInt32LE(p+20),size=out.readUInt32LE(p+16),identical=out.subarray(raw,raw+size).equals(baseline.subarray(raw,raw+size));
 if(!['CODE','.rsrc'].includes(name)&&!identical)throw Error('Unrelated section changed '+name);
 sectionChecks.push({name,identical});
}
const payload=path.join(__dirname,'payload');fs.mkdirSync(payload,{recursive:true});
const files=[];
function stage(relative,data,pristineSHA256){
 if(path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..'))throw Error('Unsafe path');
 const dest=path.join(payload,relative),installed=path.join(app,relative);
 const old=fs.readFileSync(installed);
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);
 files.push({relative,baselineSHA256:sha(old),candidateSHA256:sha(data),bytes:data.length,...(pristineSHA256?{pristineSHA256}: {})});
}
stage('Foxmail深色.exe',out);
const inventory=JSON.parse(fs.readFileSync(path.join(root,'resource-inventory/external-assets.json'),'utf8').replace(/^\ufeff/,''));
for(const asset of inventory){
 const match=(asset.resourceMatches||[]).find(x=>x.startsWith('10:')&&changedNames.has(x.slice(3)));
 if(!match)continue;
 const r=next.find(r=>r.type===10&&r.name===match.slice(3)),data=out.subarray(r.offset,r.offset+r.size);
 const relative='7.2.25.563/'+asset.relative,current=fs.readFileSync(path.join(app,relative));
 const currentResource=prior.find(x=>x.type===10&&x.name===match.slice(3));
 if(!current.equals(baseline.subarray(currentResource.offset,currentResource.offset+currentResource.size)))throw Error('External skin differs from 1.1 embedded baseline '+relative);
 stage(relative,data,asset.sha256.toLowerCase());
}
const externalCount=files.length-1;if(externalCount!==4)throw Error('Expected four matching external combo sprites, got '+externalCount);
const metadata=JSON.parse(fs.readFileSync(path.join(app,'DarkModeBackup/build-info.json'),'utf8').replace(/^\ufeff/,''));
metadata.resultSHA256=sha(out);metadata.releaseVersion='1.2-candidate';
metadata.cosmeticUpdate={baselineSHA256:sha(baseline),changes,addedHooks:0,changedControlFlow:false,externalSprites:externalCount};
stage('DarkModeBackup/build-info.json',Buffer.from(JSON.stringify(metadata,null,2)));
const helperSHA256=sha(fs.readFileSync(path.join(app,'FoxmailRevealGate.dll')));
if(helperSHA256!=='9deb8e3881ad7c8736e37bb39aaf8cfa73c92eb9ba873e9189f5c27cd99e18a0')throw Error('Gate helper changed');
const audit={baselineSHA256:sha(baseline),candidateSHA256:sha(out),changedBytes,pngChecks,sectionChecks,externalCount,changes,helperUnchanged:true,originalControlFlowUnchanged:true};
fs.writeFileSync(path.join(__dirname,'candidate-validation.json'),JSON.stringify(audit,null,2));
fs.writeFileSync(path.join(__dirname,'install-plan.json'),JSON.stringify({version:'1.2-candidate',target:app,eligibleForInstall:true,helperSHA256,originalSHA256:'54da7a968ad8a12bf80978269edfc57f520af9f19a18e5b78bf48742983dd4df',files},null,2));
console.log(JSON.stringify({candidateSHA256:sha(out),pngChecks,externalCount,changedBytes,files:files.length,allUnrelatedSectionsIdentical:true}));
