'use strict';
const fs=require('fs'),crypto=require('crypto');
const {readResources}=require('../pe-resource-utils.cjs');
const {pngDecode,pngEncode}=require('../recolor-search-scrollbars.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const names=['CONTROLS_EDIT_INPUT_DISABLE_PNG','CONTROLS_EDIT_INPUT_FOCUS_PNG','CONTROLS_EDIT_INPUT_NORMAL_PNG','CONTROLS_EDIT_INPUT_RED_PNG'];
function patchBuffer(input){
 const out=Buffer.from(input),resources=readResources(input).resources,changes=[],undo=[];
 for(const name of names){const matches=resources.filter(r=>r.type===10&&r.name===name);if(matches.length!==1)throw Error('Unexpected input bitmap count '+name);const r=matches[0],im=pngDecode(input.subarray(r.offset,r.offset+r.size));if(im.width!==14||im.height!==25)throw Error('Unexpected edit skin geometry');
  let paleBefore=0,paleAfter=0;const original=Buffer.from(im.rgba);
  for(let i=0;i<im.rgba.length;i+=4){const [red,green,blue,alpha]=original.subarray(i,i+4);if(!alpha)continue;const lum=.2126*red+.7152*green+.0722*blue;if(alpha>200&&Math.min(red,green,blue)>180)paleBefore++;let c;
   if(name.includes('_RED_'))c=(red-green>30&&lum<210)?[150,78,68]:lum>=225?[43,32,32]:[95,58,54];
   else if(name.includes('_FOCUS_'))c=lum>=245?[32,32,32]:[80,140,200];
   else if(name.includes('_DISABLE_'))c=lum>=235?[40,40,40]:[55,55,55];
   else c=lum>=235?[32,32,32]:[65,65,65];
   for(let k=0;k<3;k++)im.rgba[i+k]=c[k];if(alpha>200&&Math.min(...c)>180)paleAfter++;
  }
  const encoded=pngEncode(im),check=pngDecode(encoded);if(encoded.length>r.size)throw Error('Resource capacity '+name);if(!check.rgba.equals(im.rgba))throw Error('PNG roundtrip');for(let i=3;i<im.rgba.length;i+=4)if(im.rgba[i]!==original[i])throw Error('Alpha changed');
  undo.push({name,offset:r.offset,beforeBase64:input.subarray(r.offset,r.offset+r.size).toString('base64')},{name:name+' size',offset:r.dataEntry+4,beforeBase64:input.subarray(r.dataEntry+4,r.dataEntry+8).toString('base64')});encoded.copy(out,r.offset);out.fill(0,r.offset+encoded.length,r.offset+r.size);out.writeUInt32LE(encoded.length,r.dataEntry+4);
  changes.push({name,offset:r.offset,oldSize:r.size,newSize:encoded.length,width:im.width,height:im.height,paleBefore,paleAfter,alphaUnchanged:true});
 }
 const restored=Buffer.from(out);for(const u of undo)Buffer.from(u.beforeBase64,'base64').copy(restored,u.offset);if(!restored.equals(input))throw Error('Undo mismatch');
 return{buffer:out,report:{inputSHA256:sha(input),outputSHA256:sha(out),fileSizeUnchanged:out.length===input.length,scope:'Four resource PNGs and their data-size fields only; no code, DFM, font, tab, reveal-gate or behavior changes',changes},undo};
}
module.exports={patchBuffer};
if(require.main===module){const input=fs.readFileSync(process.argv[2]||'reveal-gate-v2/Foxmail-dark-reveal.exe');if(sha(input)!=='31dee04abb894b72de7cf56292cd2121e9d5ce56816a623f1ee797787cf6f624')throw Error('Unsupported baseline');const result=patchBuffer(input);fs.writeFileSync('cosmetic-1.1/audit-edit-input-skins.json',JSON.stringify(result.report,null,2));console.log(JSON.stringify(result.report,null,2));if(process.argv[3]){if(require('path').resolve(process.argv[2])===require('path').resolve(process.argv[3]))throw Error('Output must be distinct');fs.writeFileSync(process.argv[3],result.buffer);fs.writeFileSync(process.argv[3]+'.edit-input-undo.json',JSON.stringify(result.undo,null,2));}}
