'use strict';
// Static construction/check only; no running application, content or install access.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const paths=require('../foxmail-paths.cjs'),{readResources}=require('../pe-resource-utils.cjs'),{pngDecode}=require('../recolor-search-scrollbars.cjs');
const native=require('./patch-address-followup.cjs'),sprites=require('./patch-address-sort-sprites.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const stage=paths.output('version587-address-followup'),input=path.join(paths.output('version587-ui-followups'),'Foxmail深色.exe');
const baselineSHA256='3a3f9c385c3be8734c89b8b104cb18f2d2574ed4a790cf51c8ef637abfd44d5d';
const before=fs.readFileSync(input);assert.equal(sha(before),baselineSHA256);
const a=native.patchBuffer(before),z=sprites.patchBuffer(a.buffer),out=z.buffer;
assert.equal(out.length,before.length);
const sourceResources=readResources(before).resources,afterResources=readResources(out).resources;
assert.equal(sourceResources.length,afterResources.length);
const selected=new Set(['ADDRESS_ADDRESS_BAR_PNG','ADDRESS_ADDRESS_BAR_2X_PNG']);
const allowed=a.changes.map(p=>[p.offset,p.offset+p.size]),images=[];
for(let i=0;i<sourceResources.length;i++){
 const s=sourceResources[i],t=afterResources[i];
 assert.deepEqual([s.type,s.name,s.lang,s.offset,s.dataEntry],[t.type,t.name,t.lang,t.offset,t.dataEntry]);
 if(s.type!==10||!selected.has(s.name)){assert.equal(t.size,s.size);assert(before.subarray(s.offset,s.offset+s.size).equals(out.subarray(t.offset,t.offset+t.size)));continue;}
 assert(t.size<=s.size);allowed.push([s.offset,s.offset+s.size],[s.dataEntry+4,s.dataEntry+8]);
 const oldPNG=before.subarray(s.offset,s.offset+s.size),newPNG=out.subarray(t.offset,t.offset+t.size),old=pngDecode(oldPNG),next=pngDecode(newPNG);
 assert.equal(newPNG[25],6);assert.deepEqual([next.width,next.height],[old.width,old.height]);
 assert(old.rgba.subarray(old.rgba.length/2).equals(next.rgba.subarray(next.rgba.length/2)),'Original two blue states must remain pixel-exact');
 let changedPixels=0;for(let p=0;p<old.rgba.length;p+=4){assert.equal(next.rgba[p+3],old.rgba[p+3],'Original alpha must remain exact');if(!next.rgba.subarray(p,p+4).equals(old.rgba.subarray(p,p+4)))changedPixels++;}
 assert(changedPixels>100);const preview=path.join(stage,s.name+'.png');fs.writeFileSync(preview,newPNG);
 images.push({name:s.name,width:next.width,height:next.height,oldSize:s.size,newSize:t.size,oldSHA256:sha(oldPNG),newSHA256:sha(newPNG),changedPixels,originalAlphaAndBlueStatesUnchanged:true,colorType:6,preview});
}
assert.equal(images.length,2);
let changedBytes=0;for(let p=0;p<out.length;p++)if(out[p]!==before[p]){assert(allowed.some(([lo,hi])=>p>=lo&&p<hi),'Unexpected delta outside six color operands/two sprite resources');changedBytes++;}
const pe=before.readUInt32LE(60),op=pe+24,so=op+before.readUInt16LE(pe+20);assert(out.subarray(0,before.readUInt32LE(op+60)).equals(before.subarray(0,before.readUInt32LE(op+60))));
const preservedExecutableSections=[];for(let i=0;i<before.readUInt16LE(pe+6);i++){const p=so+i*40,name=before.toString('ascii',p,p+8).replace(/\0/g,''),raw=before.readUInt32LE(p+20),size=before.readUInt32LE(p+16);if(before.readUInt32LE(p+36)&0x20000000){assert(out.subarray(raw,raw+size).equals(a.buffer.subarray(raw,raw+size)),'Sprites may not change executable sections');if(name!=='CODE'){assert(out.subarray(raw,raw+size).equals(before.subarray(raw,raw+size)));preservedExecutableSections.push(name);}}}
const reverse=Buffer.from(out);for(const[lo,hi]of allowed)before.copy(reverse,lo,lo,hi);assert(reverse.equals(before));
const dest=path.join(stage,'Foxmail深色.exe');fs.writeFileSync(dest,out);
const sourceBindings=['patch-address-followup.cjs','patch-address-sort-sprites.cjs','check-address-followup.cjs'].map(file=>({file,sha256:sha(fs.readFileSync(path.join(__dirname,file)))}));
const report={input,dest,baselineSHA256,candidateSHA256:sha(out),generatorSHA256:sha(fs.readFileSync(__filename)),sourceBindings,native:{changes:a.changes,changedBytes:a.changedBytes,guards:a.guards,acceptedMailPaletteMatched:a.acceptedMailPaletteMatched},spriteChanges:z.changes,images,changedBytes,onlySixColorOperandsAndTwoSprites:true,otherResourcesUnchanged:true,peHeadersAndFileSizeUnchanged:true,preservedExecutableSections,reverseRestoresExactInput:true,helperSHA256:'0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70',installed:false,visualAccepted:false,scope:'Separate address node type 0A group-title gradient, four address selection endpoints equal to accepted shared mail endpoints, and two A-Z neutral-state sprites only. Original text/font, DPI, event routes, glyph geometry/alpha, blue sprite states and all other resources preserved.'};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({candidateSHA256:report.candidateSHA256,changedBytes,nativeChangedBytes:a.changedBytes,images,sourceBindings}));
