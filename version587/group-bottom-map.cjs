'use strict';
// Fixed software border pixels/geometry only; no target process or UI capture.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs'),{pngDecode}=require('../recolor-search-scrollbars.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const current=fs.readFileSync(path.join(paths.output('version587-account-right-inset'),'Foxmail深色.exe'));
assert.equal(sha(current),'540cf174a53e319529605b0cb3e171550783a6fe6455d29d16e5bc410f6d1f33');
const original=fs.readFileSync('D:/Users/Public/Downloads/Foxmail/Foxmail.exe');assert.equal(sha(original),'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399');
const get=b=>{const rows=readResources(b).resources.filter(r=>r.type===10&&r.name==='SKIN_OTHER_BORDER_PNG');assert.equal(rows.length,1);const r=rows[0];return b.subarray(r.offset,r.offset+r.size);};
const pe=current.readUInt32LE(60),op=pe+24,so=op+current.readUInt16LE(pe+20),sections=[];
for(let i=0;i<current.readUInt16LE(pe+6);i++){const p=so+i*40;sections.push({r:current.readUInt32LE(p+12),p:current.readUInt32LE(p+20),n:current.readUInt32LE(p+16)});}
const off=va=>{const r=va-0x400000,s=sections.find(s=>r>=s.r&&r<s.r+s.n);assert(s);return s.p+r-s.r;};
const globals=[0x12e6b64,0x12e6b68].map(va=>({va,original:original.readUInt32LE(off(va)),current:current.readUInt32LE(off(va))}));
const thunks=[0x408c68,0x408788,0x408aa8].map(va=>{assert.equal(current.readUInt16LE(off(va)),0x25ff);return {va,iat:current.readUInt32LE(off(va)+2)};});let clipIat=null;const visibleIats={};
const str=p=>current.toString('ascii',p,current.indexOf(0,p));
for(let d=off(current.readUInt32LE(op+104)+0x400000);current.readUInt32LE(d+12);d+=20){const iat=current.readUInt32LE(d+16),t=off((current.readUInt32LE(d)||iat)+0x400000);for(let i=0;current.readUInt32LE(t+i*4);i++){const value=current.readUInt32LE(t+i*4),hit=thunks.find(x=>x.iat===0x400000+iat+i*4);if(hit){assert(value<0x80000000);hit.api=str(off(0x400000+value)+2);}if(value<0x80000000){const name=str(off(value+0x400000)+2);if(name==='GetClipBox')clipIat=0x400000+iat+i*4;if(['RectVisible','PtVisible'].includes(name))visibleIats[name]=0x400000+iat+i*4;}}}
function report(label,b){
 const im=pngDecode(b);assert.equal(im.width,141);assert.equal(im.height,22);
 const pixel=(x,y)=>[...im.rgba.subarray((y*im.width+x)*4,(y*im.width+x)*4+4)];
 const rows=[];for(let y=0;y<im.height;y++){
  const runs=[];for(let x=0;x<im.width;x++){const p=pixel(x,y),last=runs.at(-1);if(last&&JSON.stringify(last.rgba)===JSON.stringify(p))last.end=x;else runs.push({start:x,end:x,rgba:p});}rows.push({y,runs});
 }
 return {label,size:b.length,sha256:sha(b),bitDepth:b[24],colorType:b[25],width:im.width,height:im.height,rows};
}
const items=[report('originalEmbedded',get(original)),report('currentEmbedded',get(current)),report('sourceExternal',fs.readFileSync(path.join(paths.project,'ExternalSkinUpdate/Skin/Controls/Border.png')))];
const dest=path.join(paths.output('version587-group-bottom'),'border-pixel-map.json');fs.writeFileSync(dest,JSON.stringify(items,null,2));
console.log(JSON.stringify({dest,globals,thunks,clipIat,visibleIats,items:items.map(x=>({label:x.label,sha256:x.sha256,bitDepth:x.bitDepth,colorType:x.colorType,width:x.width,height:x.height,bottom:x.rows.at(-1)}))}));
