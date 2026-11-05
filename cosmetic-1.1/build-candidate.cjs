'use strict';
// FOXMAIL_RETIRED_BASELINE_CLI: old candidate producer; source retained.
if (require.main === module) { throw new Error('Retired historical candidate producer. Use the current print/compose entry; see docs/cleanup-report-20261105.md.'); }
'use strict';
// Apply bounded UI palette changes to the frozen 1.0 executable. No new hooks.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),app='D:/Users/Public/Downloads/Foxmail';
const {readResources}=require('../pe-resource-utils.cjs');
const {pngDecode}=require('../recolor-search-scrollbars.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline=fs.readFileSync(path.join(root,'reveal-gate-v2/Foxmail-dark-reveal.exe'));
if(sha(baseline)!=='31dee04abb894b72de7cf56292cd2121e9d5ce56816a623f1ee797787cf6f624')throw Error('Unexpected 1.0 baseline');
if(!fs.readFileSync(path.join(app,'Foxmail深色.exe')).equals(baseline))throw Error('Installed version differs from 1.0');
const tabs=require('./patch-static-tabs-separators.cjs').patchBuffer(baseline);
const edits=require('./patch-edit-skins.cjs').patchBuffer(tabs.buffer);
const out=edits.buffer,changes=[...tabs.changes,...edits.changes];
if(out.length!==baseline.length)throw Error('PE length changed');
const prior=readResources(baseline).resources,next=readResources(out).resources;
const changedNames=new Set(changes.filter(x=>!x.va&&x.kind!=='resource-size').map(x=>x.name));
const ranges=changes.filter(x=>x.va).map(x=>[x.offset,x.offset+4]);
let pngChecks=0;
for(const name of changedNames){
 const a=prior.find(r=>r.type===10&&r.name===name),b=next.find(r=>r.type===10&&r.name===name);
 if(!a||!b||a.offset!==b.offset||a.dataEntry!==b.dataEntry||b.size>a.size)throw Error('Resource allocation changed '+name);
 ranges.push([a.offset,a.offset+a.size],[a.dataEntry+4,a.dataEntry+8]);
 const old=pngDecode(baseline.subarray(a.offset,a.offset+a.size)),updated=pngDecode(out.subarray(b.offset,b.offset+b.size));
 if(old.width!==updated.width||old.height!==updated.height)throw Error('Dimensions changed '+name);
 if(!Buffer.from(old.phys||[]).equals(Buffer.from(updated.phys||[])))throw Error('PNG density changed '+name);
 for(let i=3;i<old.rgba.length;i+=4)if(old.rgba[i]!==updated.rgba[i])throw Error('Alpha changed '+name);
 pngChecks++;
}
let changedBytes=0;
for(let i=0;i<out.length;i++)if(out[i]!==baseline[i]){changedBytes++;if(!ranges.some(([a,b])=>i>=a&&i<b))throw Error('Unlisted delta '+i.toString(16));}
if(pngChecks!==12)throw Error('Expected twelve bounded sprite resources');
const pe=out.readUInt32LE(60),op=pe+24,so=op+out.readUInt16LE(pe+20),sectionChecks=[];
for(let i=0;i<out.readUInt16LE(pe+6);i++){
 const p=so+i*40,name=out.toString('ascii',p,p+8).replace(/\0/g,''),raw=out.readUInt32LE(p+20),size=out.readUInt32LE(p+16),identical=out.subarray(raw,raw+size).equals(baseline.subarray(raw,raw+size));
 if(!['CODE','.rsrc'].includes(name)&&!identical)throw Error('Unrelated section changed '+name);
 sectionChecks.push({name,identical});
}
const payload=path.join(__dirname,'payload');fs.mkdirSync(payload,{recursive:true});
const files=[];
function stage(relative,data){
 if(path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..'))throw Error('Unsafe path');
 const dest=path.join(payload,relative),installed=path.join(app,relative);
 const old=fs.readFileSync(installed);
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);
 files.push({relative,baselineSHA256:sha(old),candidateSHA256:sha(data),bytes:data.length});
}
stage('Foxmail深色.exe',out);
const inventory=JSON.parse(fs.readFileSync(path.join(root,'resource-inventory/external-assets.json'),'utf8').replace(/^\ufeff/,''));
for(const asset of inventory){
 const match=(asset.resourceMatches||[]).find(x=>x.startsWith('10:')&&changedNames.has(x.slice(3)));
 if(!match)continue;
 const r=next.find(r=>r.type===10&&r.name===match.slice(3)),data=out.subarray(r.offset,r.offset+r.size);
 const relative='7.2.25.563/'+asset.relative,current=fs.readFileSync(path.join(app,relative));
 if(sha(current).toLowerCase()!==asset.sha256.toLowerCase())throw Error('External skin changed '+relative);
 stage(relative,data);
}
const externalCount=files.length-1;if(externalCount!==4)throw Error('Expected four matching external capsule sprites, got '+externalCount);
const metadata=JSON.parse(fs.readFileSync(path.join(app,'DarkModeBackup/build-info.json'),'utf8').replace(/^\ufeff/,''));
metadata.resultSHA256=sha(out);metadata.releaseVersion='1.1-candidate';
metadata.cosmeticUpdate={baselineSHA256:sha(baseline),changes,addedHooks:0,changedControlFlow:false,externalSprites:externalCount};
stage('DarkModeBackup/build-info.json',Buffer.from(JSON.stringify(metadata,null,2)));
const helperSHA256=sha(fs.readFileSync(path.join(app,'FoxmailRevealGate.dll')));
if(helperSHA256!=='9deb8e3881ad7c8736e37bb39aaf8cfa73c92eb9ba873e9189f5c27cd99e18a0')throw Error('Gate helper changed');
const audit={baselineSHA256:sha(baseline),candidateSHA256:sha(out),changedBytes,pngChecks,sectionChecks,externalCount,changes,helperUnchanged:true,originalControlFlowUnchanged:true};
fs.writeFileSync(path.join(__dirname,'candidate-validation.json'),JSON.stringify(audit,null,2));
fs.writeFileSync(path.join(__dirname,'install-plan.json'),JSON.stringify({version:'1.1-candidate',target:app,eligibleForInstall:true,helperSHA256,originalSHA256:'54da7a968ad8a12bf80978269edfc57f520af9f19a18e5b78bf48742983dd4df',files},null,2));
console.log(JSON.stringify({candidateSHA256:sha(out),pngChecks,externalCount,changedBytes,files:files.length,allUnrelatedSectionsIdentical:true}));
