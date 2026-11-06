'use strict';
// Static software resources only. Never emit Caption, Text or other UI strings.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const expected='ce79d169ad6f908a4607ccc160efb17ce21b6afbcb9b8d1018c17331fff06c4a';
const input=path.join(paths.output('version587-notification'),'Foxmail深色.exe'),b=fs.readFileSync(input);
const sha=crypto.createHash('sha256').update(b).digest('hex');assert.equal(sha,expected,'Unexpected software EXE');
const resources=readResources(b).resources,rows=[];
const allowed=/^(?:Color|[A-Za-z_][A-Za-z0-9_.]*Color|ParentBackground|Transparent|BorderStyle|Ctl3D|ParentCtl3D|BevelInner|BevelOuter|BevelKind)$/;
function paintingProperties(o){
 return o.properties.filter(p=>allowed.test(p.name)).map(p=>{
  // Numeric/boolean properties and Delphi identifiers only; no free text/binary.
  assert([2,3,4,7,8,9].includes(p.type),'Unexpected painting property type');
  return {name:p.name,type:p.type,value:p.value};
 });
}
let dfmResources=0,componentsScanned=0;
for(const r of resources){
 if(r.size<4||b.toString('ascii',r.offset,r.offset+4)!=='TPF0')continue;
 let root;
 try{root=parseDFM(b.subarray(r.offset,r.offset+r.size));}
 catch(e){throw new Error('Cannot parse binary DFM resource '+String(r.name)+' (language '+String(r.lang)+'); no complete usage report written');}
 dfmResources++;
 function walk(o,ancestors){
  componentsScanned++;
  const identity={className:o.className,name:o.name},chain=ancestors.concat(identity);
  if(o.className==='TFMGroupBox')rows.push({resourceType:r.type,resource:r.name,language:r.lang,componentPath:chain.map(x=>x.name).join('/'),className:o.className,ancestors,properties:paintingProperties(o)});
  for(const child of o.children)walk(child,chain);
 }
 walk(root,[]);
}
assert(dfmResources>0&&rows.length>0,'No static TFMGroupBox usages found');
const report={input,softwareSHA256:sha,resourceCount:resources.length,binaryDfmResources:dfmResources,componentsScanned,exactClass:'TFMGroupBox',groupboxCount:rows.length,matchingResourceCount:new Set(rows.map(x=>JSON.stringify([x.resourceType,x.resource,x.language]))).size,scope:'All TPF0 software resources; exact declared class only. Does not enumerate runtime-created controls or infer descendant classes. Omitted properties retain runtime/default uncertainty.',rows};
const dest=path.join(paths.output('version587-account-paint'),'groupbox-usage.json');fs.writeFileSync(dest,JSON.stringify(report,null,2));
console.log(JSON.stringify({dest,binaryDfmResources:dfmResources,groupboxCount:rows.length,matchingResourceCount:report.matchingResourceCount}));
