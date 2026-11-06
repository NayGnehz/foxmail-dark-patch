'use strict';
// Format-only fix: identical RGBA pixels, avoiding the indexed PNG row-offset bug.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),zlib=require('zlib'),paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs'),{pngDecode}=require('../recolor-search-scrollbars.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const input=path.join(paths.output('version587-account-right-inset'),'Foxmail深色.exe'),b=fs.readFileSync(input),baselineSHA256='540cf174a53e319529605b0cb3e171550783a6fe6455d29d16e5bc410f6d1f33';assert.equal(sha(b),baselineSHA256);
const originalPath='D:/Users/Public/Downloads/Foxmail/Foxmail.exe',original=fs.readFileSync(originalPath);assert.equal(sha(original),'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399');
const oldResources=readResources(b).resources,originalResources=readResources(original).resources;
function only(rows){assert.equal(rows.length,1);return rows[0];}
const resource=only(oldResources.filter(r=>r.type===10&&r.name==='SKIN_OTHER_BORDER_PNG'));
const originalResource=only(originalResources.filter(r=>r.type===resource.type&&r.name===resource.name&&r.lang===resource.lang));
assert.equal(originalResource.offset,resource.offset);assert.equal(originalResource.size,2922);
const oldPng=b.subarray(resource.offset,resource.offset+resource.size),oldAssetSHA256='dd16157d271700bd887e1eb70f59aaeff4b4678f96259a031b2fe7513c892597';assert.equal(sha(oldPng),oldAssetSHA256);assert.equal(oldPng[24],8);assert.equal(oldPng[25],3);
const image=pngDecode(oldPng);assert.equal(image.width,141);assert.equal(image.height,22);
// Use an explicit RGBA encoder; the shared smallest-PNG encoder chooses indexed.
function crc32(data){let c=0xffffffff;for(const x of data){c^=x;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return(c^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return out;}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(image.width);ihdr.writeUInt32BE(image.height,4);ihdr[8]=8;ihdr[9]=6;
const raw=Buffer.alloc((image.width*4+1)*image.height);for(let y=0;y<image.height;y++)image.rgba.copy(raw,y*(image.width*4+1)+1,y*image.width*4,(y+1)*image.width*4);
const pieces=[oldPng.subarray(0,8),chunk('IHDR',ihdr)];if(image.phys)pieces.push(chunk('pHYs',image.phys));pieces.push(chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0)));const png=Buffer.concat(pieces),decoded=pngDecode(png);
assert.equal(png[25],6);assert.equal(decoded.width,image.width);assert.equal(decoded.height,image.height);assert(decoded.rgba.equals(image.rgba),'Every decoded RGBA byte must remain identical');
assert(png.length<=originalResource.size,'Must fit the original unchanged resource allocation');
assert(b.subarray(resource.offset+resource.size,resource.offset+originalResource.size).every(x=>x===0),'Only zeroed reserve may be reused');
for(const r of oldResources)if(r!==resource)assert(r.offset+r.size<=resource.offset||r.offset>=resource.offset+originalResource.size,'Original resource capacity must not overlap another current asset');
const absentExternal=[
 'D:/Users/Public/Downloads/Foxmail/7.2.25.587/skin/other/Border.png',
 'D:/Users/Public/Downloads/Foxmail/skin/other/Border.png'
];for(const p of absentExternal)assert(!fs.existsSync(p),'External group skin now exists; reevaluate precedence');
const externalControls='D:/Users/Public/Downloads/Foxmail/7.2.25.587/Skin/Controls/Border.png';assert.equal(sha(fs.readFileSync(externalControls)),oldAssetSHA256);
const out=Buffer.from(b);png.copy(out,resource.offset);out.writeUInt32LE(png.length,resource.dataEntry+4);
const allowed=[[resource.offset,resource.offset+Math.max(resource.size,png.length)],[resource.dataEntry+4,resource.dataEntry+8]];let changedBytes=0;
for(let i=0;i<b.length;i++)if(b[i]!==out[i]){changedBytes++;assert(allowed.some(([a,z])=>a<=i&&i<z),'Non-asset bytes changed');}
const pe=b.readUInt32LE(60),op=pe+24,so=op+b.readUInt16LE(pe+20),executableSections=[];
for(let i=0;i<b.readUInt16LE(pe+6);i++){const p=so+i*40;if(b.readUInt32LE(p+36)&0x20000000){const offset=b.readUInt32LE(p+20),size=b.readUInt32LE(p+16);assert(out.subarray(offset,offset+size).equals(b.subarray(offset,offset+size)));executableSections.push(b.toString('ascii',p,p+8).replace(/\0/g,''));}}
const newResources=readResources(out).resources;assert.equal(newResources.length,oldResources.length);
for(let i=0;i<oldResources.length;i++){const a=oldResources[i],c=newResources[i];assert.equal(a.name,c.name);assert.equal(a.type,c.type);assert.equal(a.lang,c.lang);assert.equal(a.offset,c.offset);if(a===resource)assert.equal(c.size,png.length);else{assert.equal(a.size,c.size);assert(out.subarray(c.offset,c.offset+c.size).equals(b.subarray(a.offset,a.offset+a.size)));}}
const stage=paths.output('version587-group-border-rgba'),dest=path.join(stage,'Foxmail深色.exe'),asset=path.join(stage,'Border.rgba.png'),candidateSHA256=sha(out),newAssetSHA256=sha(png),pixelSHA256=sha(image.rgba);
const report={input,dest,baselineSHA256,candidateSHA256,generatorSHA256:sha(fs.readFileSync(__filename)),asset,oldAssetSHA256,newAssetSHA256,oldSize:oldPng.length,newSize:png.length,resource:{type:resource.type,name:resource.name,language:resource.lang,offset:resource.offset,dataEntry:resource.dataEntry,originalCapacity:originalResource.size},image:{width:image.width,height:image.height,oldColorType:3,newColorType:6,bitDepth:8,oldPixelSHA256:pixelSHA256,newPixelSHA256:sha(decoded.rgba),rgbaBytes:image.rgba.length,allPixelAndAlphaBytesIdentical:true},targets:[{relative:'Foxmail深色.exe',input,dest,oldSHA256:baselineSHA256,newSHA256:candidateSHA256}],externalControls:{path:externalControls,oldSHA256:oldAssetSHA256,newSHA256:oldAssetSHA256,unchanged:true,reason:'Not the groupbox loader path: B6AB44 is skin\\other\\Border.png. No external other/Border exists in the installed program/version software roots.'},absentExternalGroupPaths:absentExternal,priorityEvidence:'B6A855 passes skin\\other\\Border.png via B6AB44. 868F64 calls FileExists(6DC638): present -> TFileStream(6F4050), absent -> TResourceStream(64B448). Historical fixed software cache resource module was 00400000. Convert the embedded SKIN_OTHER_BORDER_PNG only; leave external Controls/Border unchanged.',codeUnchanged:true,executableSectionsVerified:executableSections,allOtherResourcesUnchanged:true,peHeadersUnchanged:out.subarray(0,b.readUInt32LE(op+60)).equals(b.subarray(0,b.readUInt32LE(op+60))),fileSizeUnchanged:out.length===b.length,changedBytes,helperSHA256:'0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70',scope:'Lossless format-only conversion of one existing groupbox skin resource from indexed PNG to RGBA PNG. Original pixel/alpha bytes, dimensions, code, accepted account border fixes, helper and external skin assets unchanged.',installed:false};
assert(report.peHeadersUnchanged);fs.writeFileSync(dest,out);fs.writeFileSync(asset,png);fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
