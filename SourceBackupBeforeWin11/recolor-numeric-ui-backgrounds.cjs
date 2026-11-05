'use strict';
// Explicitly selected application-chrome sprites only. No DLL loading or process access.
// Edits stay inside the existing .rsrc allocations, preserving the appended .fxdark section.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {readResources}=require('./pe-resource-utils.cjs');
const {pngDecode,pngEncode}=require('./recolor-search-scrollbars.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const numeric=new Set([118,139,140,141,142,155,156,157,158,161,162,163]);
const named=/^(MAIN_SEARCH_(ADVANCE_SEARCH_BTN|ADD_CONDITION_BTN|SEARCH_LEFT_BTN)(_2X)?_PNG|COMMON_TOOLBAR_TOOLBAR_BUTTON_(HOVER|PRESS)(_2X)?_PNG)$/;
function selected(r){return r.type==='PNG'&&numeric.has(r.name)||r.type===10&&named.test(String(r.name));}
function pureBackground(r){return r.type==='PNG'&&[118,139,140,141,142,155,156,157,158].includes(r.name)||String(r.name).startsWith('COMMON_TOOLBAR_TOOLBAR_BUTTON_');}
function mapColor(r,g,b,pure){
 const lo=Math.min(r,g,b),hi=Math.max(r,g,b),blue=b>=r&&g>=r&&b-r>20;
 if(lo<(pure?100:170)||hi-lo>(pure?140:100))return null;
 const delta=Math.max(-4,Math.min(4,Math.round(((r+g+b)/3-225)/12)));
 const base=blue?[42,57,75]:[38,43,50];
 return base.map(v=>v+delta);
}
function patch(source,dest){
 if(path.resolve(source)===path.resolve(dest))throw Error('Distinct input/output required');
 const before=fs.readFileSync(source),out=Buffer.from(before),{resources,op}=readResources(out),report=[],undo=[];
 for(const r of resources.filter(selected)){
  const old=Buffer.from(before.subarray(r.offset,r.offset+r.size)),image=pngDecode(old),pixels=Buffer.from(image.rgba);let changed=0;
  for(let p=0;p<image.rgba.length;p+=4){if(!image.rgba[p+3])continue;const c=mapColor(image.rgba[p],image.rgba[p+1],image.rgba[p+2],pureBackground(r));if(c){image.rgba[p]=c[0];image.rgba[p+1]=c[1];image.rgba[p+2]=c[2];changed++;}}
  if(!changed){report.push({type:r.type,name:r.name,skipped:'No selected pale background pixels'});continue;}
  const encoded=pngEncode(image),decoded=pngDecode(encoded);if(!decoded.rgba.equals(image.rgba))throw Error('PNG roundtrip failed');
  for(let p=3;p<pixels.length;p+=4)if(image.rgba[p]!==pixels[p])throw Error('Alpha changed');
  if(encoded.length>r.size)throw Error('PNG exceeds existing allocation: '+r.name+' '+encoded.length+' > '+r.size);
  undo.push({offset:r.offset,name:r.type+'/'+r.name,originalBase64:old.toString('base64')});
  encoded.copy(out,r.offset);out.fill(0,r.offset+encoded.length,r.offset+r.size);
  if(encoded.length!==r.size){undo.push({offset:r.dataEntry+4,name:r.name+' data size',originalBase64:before.subarray(r.dataEntry+4,r.dataEntry+8).toString('base64')});out.writeUInt32LE(encoded.length,r.dataEntry+4);}
  report.push({type:r.type,name:r.name,lang:r.lang,width:image.width,height:image.height,pixelsChanged:changed,oldSize:r.size,newSize:encoded.length});
 }
 if(!report.length)throw Error('No selected background resources');
 // Same metadata convention as the earlier reversible resource helpers.
 for(const [offset,size]of[[op+64,4],[op+128,8]])if(out.subarray(offset,offset+size).some(x=>x)){undo.push({offset,name:'PE checksum/signature metadata',originalBase64:before.subarray(offset,offset+size).toString('base64')});out.fill(0,offset,offset+size);}
 const verify=Buffer.from(out);for(const r of undo)Buffer.from(r.originalBase64,'base64').copy(verify,r.offset);if(!verify.equals(before))throw Error('Reversibility failed');
 // Require every raw section except .rsrc to be byte-identical.
 const pe=before.readUInt32LE(0x3c),so=pe+24+before.readUInt16LE(pe+20),sectionCount=before.readUInt16LE(pe+6),sectionChecks=[];
 for(let i=0;i<sectionCount;i++){const s=so+40*i,name=before.toString('ascii',s,s+8).replace(/\0/g,''),raw=before.readUInt32LE(s+20),size=before.readUInt32LE(s+16);if(name!=='.rsrc'&&!before.subarray(raw,raw+size).equals(out.subarray(raw,raw+size)))throw Error('Non-resource section changed: '+name);sectionChecks.push(name);}
 const metadata={source,dest,inputSHA256:sha(before),outputSHA256:sha(out),fileSizeUnchanged:before.length===out.length,alphaPreserved:true,sectionChecks,resources:report,changedRanges:undo};
 fs.writeFileSync(dest,out);fs.writeFileSync(dest+'.bitmap-undo.json',JSON.stringify(metadata,null,2));fs.writeFileSync(dest+'.bitmap-report.json',JSON.stringify({...metadata,changedRanges:undo.map(({offset,name})=>({offset,name}))},null,2));
 return {output:dest,resourcesChanged:report.filter(r=>r.pixelsChanged).length,pixelsChanged:report.reduce((n,r)=>n+(r.pixelsChanged||0),0),...Object.fromEntries(['fileSizeUnchanged','alphaPreserved','sectionChecks','outputSHA256'].map(k=>[k,metadata[k]]))};
}
if(require.main===module){const [,,source,dest]=process.argv;if(!source||!dest)throw Error('Usage: node recolor-numeric-ui-backgrounds.cjs input.exe output.exe');console.log(JSON.stringify(patch(source,dest),null,2));}
module.exports={patch};
