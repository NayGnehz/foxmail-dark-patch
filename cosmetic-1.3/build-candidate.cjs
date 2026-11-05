'use strict';
// FOXMAIL_RETIRED_BASELINE_CLI: preserve patchBuffer exports; do not consume retired old EXE.
if (require.main === module) { throw new Error('Retired historical baseline CLI. See docs/cleanup-report-20261105.md; use the current print/compose entry.'); }
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(__dirname,'..'),app='D:/Users/Public/Downloads/Foxmail';
const {readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs'),{pngDecode}=require('../recolor-search-scrollbars.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline=fs.readFileSync(path.join(root,'cosmetic-1.2/payload/Foxmail深色.exe'));
assert.equal(sha(baseline),'49da903389c103e64e819e50ce91baf186dcf85da95237505d90137d7291fd5b');
assert(fs.readFileSync(path.join(app,'Foxmail深色.exe')).equals(baseline),'Installed baseline changed');
const pristine=fs.readFileSync(path.join(app,'Foxmail.exe'));
assert.equal(sha(pristine),'54da7a968ad8a12bf80978269edfc57f520af9f19a18e5b78bf48742983dd4df');
const layers=[],changes=[];let out=baseline;
for(const name of ['edit-family-underpaint','address-controls','address-header-separators','editor-chrome','numeric-chrome-borders']){
 const result=require('./patch-'+name+'.cjs').patchBuffer(out,pristine);
 layers.push({name,inputSHA256:sha(out),outputSHA256:sha(result.buffer),changes:result.changes.length});
 changes.push(...result.changes.map(c=>({...c,layer:name})));out=result.buffer;
}
assert.equal(out.length,baseline.length);
const prior=readResources(baseline).resources,next=readResources(out).resources,orig=readResources(pristine).resources;
assert.equal(prior.length,next.length);
const pngNames=new Set(changes.filter(c=>c.kind==='sprite').map(c=>c.name)),ranges=[];
for(const c of changes){if(c.kind==='sprite'){
 const a=orig.find(r=>r.type===10&&r.name===c.name);ranges.push([a.offset,a.offset+a.size],[a.dataEntry+4,a.dataEntry+8]);
}else {assert(Number.isInteger(c.offset));ranges.push([c.offset,c.offset+(c.size||4)]);}}
let changedBytes=0;for(let p=0;p<out.length;p++)if(out[p]!==baseline[p]){changedBytes++;assert(ranges.some(([a,b])=>p>=a&&p<b),'Unlisted byte delta '+p);}
function plain(v){if(Array.isArray(v))return v.map(plain);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['offset','end'].includes(k)).map(([k,x])=>[k,plain(x)]));return v;}
const dfmDeltas=[];let dfmChecks=0,pngChecks=0;
function compare(a,b,res,where=''){
 where+='.'+a.name;assert.equal(a.className,b.className);assert.equal(a.name,b.name);assert.equal(a.properties.length,b.properties.length);assert.equal(a.children.length,b.children.length);
 for(let i=0;i<a.properties.length;i++){const p=a.properties[i],q=b.properties[i];assert.equal(p.name,q.name);
  if(JSON.stringify(plain(p))===JSON.stringify(plain(q)))continue;
  if(p.name==='transparentColor')assert(p.value==='clNone'&&q.value===0x202020&&p.type===7&&q.type===4);
  else {assert.equal(p.type,q.type);assert(['BorderColor','InnerBorderColor','Colors.BorderColor','Colors.GridLineColor'].includes(p.name)||(res==='TDLG_SELADDR'&&where.endsWith('.Splitter1')&&p.name==='Color'),'Unexpected property '+res+where+p.name);assert([0x3d3d3d,0x454545].includes(q.value));}
  dfmDeltas.push({resource:res,path:where,property:p.name,before:p.value,after:q.value});
 }
 for(let i=0;i<a.children.length;i++)compare(a.children[i],b.children[i],res,where);
}
for(let i=0;i<prior.length;i++){
 const a=prior[i],b=next[i],o=orig.find(r=>r.type===a.type&&r.name===a.name&&r.lang===a.lang);
 assert.equal(a.name,b.name);assert.equal(a.offset,b.offset);assert.equal(a.dataEntry,b.dataEntry);
 if(a.type===10&&baseline.toString('ascii',a.offset,a.offset+4)==='TPF0'){compare(parseDFM(baseline.subarray(a.offset,a.offset+a.size)),parseDFM(out.subarray(b.offset,b.offset+b.size)),a.name);dfmChecks++;}
 if(pngNames.has(a.name)){
  assert(o&&b.size<=o.size);const x=pngDecode(baseline.subarray(a.offset,a.offset+a.size)),y=pngDecode(out.subarray(b.offset,b.offset+b.size));
  assert.equal(x.width,y.width);assert.equal(x.height,y.height);assert(Buffer.from(x.phys||[]).equals(Buffer.from(y.phys||[])));
  for(let j=3;j<x.rgba.length;j+=4)assert.equal(x.rgba[j],y.rgba[j]);pngChecks++;
 }
}
assert.equal(dfmChecks,264);assert.equal(pngChecks,12);
const pe=out.readUInt32LE(60),op=pe+24,so=op+out.readUInt16LE(pe+20),sectionChecks=[];
for(let i=0;i<out.readUInt16LE(pe+6);i++){const p=so+i*40,name=out.toString('ascii',p,p+8).replace(/\0/g,''),raw=out.readUInt32LE(p+20),size=out.readUInt32LE(p+16),identical=out.subarray(raw,raw+size).equals(baseline.subarray(raw,raw+size));assert(['CODE','.rsrc'].includes(name)||identical,'Unrelated section '+name);sectionChecks.push({name,identical});}
const exportAudit=JSON.parse(fs.readFileSync(path.join(__dirname,'editor-scrollbar-export-validation.json'),'utf8'));assert(exportAudit.passed&&exportAudit.cases===12&&exportAudit.scriptErrors.length===0);
const files=[],payload=path.join(__dirname,'payload');fs.mkdirSync(payload,{recursive:true});
function stage(relative,data,extra={}){assert(!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..'));const current=fs.readFileSync(path.join(app,relative)),dest=path.join(payload,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);files.push({relative,baselineSHA256:sha(current),candidateSHA256:sha(data),bytes:data.length,...extra});}
stage('Foxmail深色.exe',out);
const inventory=JSON.parse(fs.readFileSync(path.join(root,'resource-inventory/external-assets.json'),'utf8').replace(/^\ufeff/,''));
for(const asset of inventory){const match=(asset.resourceMatches||[]).find(x=>x.startsWith('10:')&&pngNames.has(x.slice(3)));if(!match)continue;
 const a=prior.find(r=>r.type===10&&r.name===match.slice(3)),b=next.find(r=>r.type===10&&r.name===match.slice(3)),relative='7.2.25.563/'+asset.relative;
 assert(fs.readFileSync(path.join(app,relative)).equals(baseline.subarray(a.offset,a.offset+a.size)),'External sprite differs '+relative);
 stage(relative,out.subarray(b.offset,b.offset+b.size),{pristineSHA256:asset.sha256.toLowerCase(),pristineBackup:'OriginalSkin/'+asset.relative});
}
const externalSpriteCount=files.length-1;
for(const asset of require('./stage-editor-screen-assets.cjs').generateExternalFiles(app)){stage(asset.relative,asset.data,{pristineSHA256:asset.baselineSHA256,pristineBackup:'OriginalTemplate/HtmlEditor/Common/Base.css'});}
const metadata=JSON.parse(fs.readFileSync(path.join(app,'DarkModeBackup/build-info.json'),'utf8').replace(/^\ufeff/,''));
metadata.cosmeticHistory=[...(metadata.cosmeticHistory||[]),...(metadata.cosmeticUpdate?[metadata.cosmeticUpdate]:[])];
metadata.resultSHA256=sha(out);metadata.releaseVersion='1.3-candidate';metadata.cosmeticUpdate={baselineSHA256:sha(baseline),layers,dfmChecks,dfmPropertyChanges:dfmDeltas.length,pngChecks,externalSpriteCount,editorExportCases:12,addedHooks:0,changedControlFlow:false};
stage('DarkModeBackup/build-info.json',Buffer.from(JSON.stringify(metadata,null,2)));
const helperSHA256=sha(fs.readFileSync(path.join(app,'FoxmailRevealGate.dll')));assert.equal(helperSHA256,'9deb8e3881ad7c8736e37bb39aaf8cfa73c92eb9ba873e9189f5c27cd99e18a0');
const audit={baselineSHA256:sha(baseline),candidateSHA256:sha(out),changedBytes,dfmChecks,dfmDeltas,pngChecks,externalSpriteCount,sectionChecks,layers,changes,helperUnchanged:true,originalControlFlowUnchanged:true,editorExportCases:12};
fs.writeFileSync(path.join(__dirname,'candidate-validation.json'),JSON.stringify(audit,null,2));
fs.writeFileSync(path.join(__dirname,'install-plan.json'),JSON.stringify({version:'1.3-candidate',target:app,eligibleForInstall:true,fileCount:files.length,helperSHA256,originalSHA256:sha(pristine),files},null,2));
console.log(JSON.stringify({candidateSHA256:sha(out),dfmChecks,dfmPropertyChanges:dfmDeltas.length,pngChecks,externalSpriteCount,changedBytes,files:files.length,allUnrelatedSectionsIdentical:true}));
