'use strict';
// Foxmail 7.2.25.563: the separate FMShadowWnd supplies the popup outline.
// Evidence: window diagnostic shows WS_BORDER + 1px NC; the actual texture is
// MENU_MENU_BG_PNG, loaded by TShadowService at VA 0x89D758.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {readResources}=require('./pe-resource-utils.cjs');
const {pngDecode,pngEncode}=require('./recolor-search-scrollbars.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const textureName='MENU_MENU_BG_PNG';
const originalTextureSHA256='bd9a3a990b04a9efe4481e2a15cb46790c05631ca574bacee6636e3234f09bdd';
const patches=[{va:0x89da13,byteVA:0x89da16,before:'6800008880',after:'6800000880',name:'FMShadowWnd CreateWindow style: remove WS_BORDER only'}];
function patchOriginal(out,off){
 // off accepts RVAs, as in build-dark/inspect-pe; verify this exact callsite
 // and its explicit class literal, never search/replace generic style bytes.
 const guard=(va,hex)=>{const at=off(va-0x400000),want=Buffer.from(hex,'hex');if(!out.subarray(at,at+want.length).equals(want))throw Error('FMShadowWnd guard mismatch '+va.toString(16));};
 guard(0x89da0c,'558bec518945fc6800008880');
 guard(0x89da2c,'ba80da890033c9b8a0000800e88bb9b6ff');
 guard(0x89da80,Buffer.from('FMShadowWnd\0','ascii').toString('hex'));
 out[off(0x49da16)]=0x08;
 return patches;
}
function patchResources(out){
 const rs=readResources(out).resources.filter(r=>r.type===10&&r.name===textureName);
 if(rs.length!==1)throw Error('Expected one menu shadow texture');
 const r=rs[0],original=Buffer.from(out.subarray(r.offset,r.offset+r.size));
 if(sha(original)!==originalTextureSHA256)throw Error('Menu shadow texture changed');
 const im=pngDecode(original),before=Buffer.from(im.rgba);
 if(im.width!==24||im.height!==24)throw Error('Menu shadow texture geometry changed');
 let changed=0;
 for(let i=0;i<im.rgba.length;i+=4){
  const min=Math.min(im.rgba[i],im.rgba[i+1],im.rgba[i+2]),max=Math.max(im.rgba[i],im.rgba[i+1],im.rgba[i+2]);
  // The thin grey ring is RGB A3A7AA (AA edges down to 8F979D).
  // Preserve every alpha, transparent pixel, and the blue-black shadow glow.
  if(im.rgba[i+3]&&min>=100&&max-min<=30){im.rgba[i]=im.rgba[i+1]=im.rgba[i+2]=61;changed++;}
 }
 if(changed!==76)throw Error('Unexpected ring pixel coverage '+changed);
 const encoded=pngEncode(im),check=pngDecode(encoded);
 if(encoded.length>r.size||!check.rgba.equals(im.rgba))throw Error('Menu texture encoding failed');
 for(let i=0;i<before.length;i+=4){if(before[i+3]!==check.rgba[i+3])throw Error('Alpha changed');if(before[i+3]===0&&!before.subarray(i,i+4).equals(check.rgba.subarray(i,i+4)))throw Error('Transparent RGB changed');}
 encoded.copy(out,r.offset);out.fill(0,r.offset+encoded.length,r.offset+r.size);out.writeUInt32LE(encoded.length,r.dataEntry+4);
 return {name:r.name,relative:'Skin\\Controls\\menu_bg.png',offset:r.offset,dataEntry:r.dataEntry,oldSize:r.size,newSize:encoded.length,width:24,height:24,pixelsChanged:changed,alphaPreserved:true,originalSHA256:originalTextureSHA256,newSHA256:sha(encoded),originalBase64:original.toString('base64')};
}
function peOffset(b){const pe=b.readUInt32LE(60),op=pe+24,so=op+b.readUInt16LE(pe+20),ss=[];if(b.readUInt16LE(op)!==0x10b||b.readUInt32LE(op+28)!==0x400000)throw Error('Unexpected PE');for(let i=0;i<b.readUInt16LE(pe+6);i++){const p=so+i*40;ss.push({r:b.readUInt32LE(p+12),f:b.readUInt32LE(p+20),n:b.readUInt32LE(p+16)});}return r=>{const s=ss.find(s=>r>=s.r&&r<s.r+s.n);if(!s)throw Error('RVA unmapped');return s.f+r-s.r;};}
module.exports={patchOriginal,patchResources,patches,textureName,originalTextureSHA256};
if(require.main===module){const[, ,src,dest]=process.argv;if(!src||!dest||path.resolve(src)===path.resolve(dest))throw Error('Distinct source and output required');const before=fs.readFileSync(src),out=Buffer.from(before),off=peOffset(out);patchOriginal(out,off);const resource=patchResources(out);fs.writeFileSync(dest,out);const report={source:src,dest,inputSHA256:sha(before),outputSHA256:sha(out),fileSizeUnchanged:out.length===before.length,patches,resources:[resource]};fs.writeFileSync(dest+'.menu-shadow.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,resources:[{...resource,originalBase64:undefined}]},null,2));}
