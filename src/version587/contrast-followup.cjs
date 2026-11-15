'use strict';
// Screenshot contrast follow-up on the verified tray guard. Software files only.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {createHash} = require('node:crypto');
const paths = require('../foxmail-paths.cjs');
const {readResources} = require('../pe-resource-utils.cjs');
const {parseDFM} = require('../inspect-dfm-palette.cjs');
const {pngDecode,pngEncodeRGBA} = require('../recolor-search-scrollbars.cjs');
const {verifyByteDelta} = require('./verify-byte-delta.cjs');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const baselineSHA256 = 'eee4f4bd6d0241aad5e86bfaf121fd2b4a4a1a32c45d04d9584f798f699f82be';
const nativeColors = [
 [0xbebdb7,0x68,0xf8f5f1,0x282828,'address search header gradient start'],
 [0xbebdbc,0x68,0xece5de,0x202020,'address search header gradient end'],
 [0xbebe2b,0xba,0xc3bcb5,0x3d3d3d,'address search header lower border'],
 [0xbebec0,0x68,0xf7f4f0,0x282828,'To/Cc/Bcc header gradient start'],
 [0xbebec5,0x68,0xe8e2db,0x202020,'To/Cc/Bcc header gradient end']
];
const sprites = [
 ['COMPOSE_ATTACH_SELECT_PNG',220,40,'75f8ed7ab0a4e2b14a08f6c8e00ef351e541b5d4ed08862a675254813a0019dd'],
 ['COMPOSE_ATTACH_SELECT_2X_PNG',440,80,'11205777b620342157e9db2678aa4321fabc09e51599401e82fd17a8102ee546']
];
function recolorSelection(png,width,height) {
 const image=pngDecode(png), before=Buffer.from(image.rgba);
 assert.equal(image.width,width);assert.equal(image.height,height);
 let changed=0,minContrast=Infinity;
 const linear=v=>(v/=255)<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;
 const luminance=c=>linear(c[0])*.2126+linear(c[1])*.7152+linear(c[2])*.0722;
 for(let i=0;i<image.rgba.length;i+=4) {
  if(!before[i+3])continue;
  // This atlas contains background only. Retain alpha/rounding and the
  // original continuous pale-blue gradient, mapped to accepted mail colors.
  const t=Math.max(0,Math.min(1,(before[i]-213)/11));
  const color=before[i]<200?[61,100,135]:[40+Math.round(9*t),68+Math.round(13*t),95+Math.round(16*t)];
  for(let c=0;c<3;c++)image.rgba[i+c]=color[c];
  changed++;
  if(before[i+3]===255) minContrast=Math.min(minContrast,(linear(230)+.05)/(luminance(color)+.05));
 }
 for(let i=3;i<before.length;i+=4)assert.equal(image.rgba[i],before[i],'Selection alpha changed');
 assert(minContrast>=4.5,'Attachment selection text contrast');
 const encoded=pngEncodeRGBA(image);
 assert(pngDecode(encoded).rgba.equals(image.rgba));
 return{encoded,image,changed,minContrast};
}
function patchVisuals(input) {
 const out=Buffer.from(input),{resources,pe,op}=readResources(input);
 const table=op+input.readUInt16LE(pe+20),ranges=[],changes=[],assets=[];
 const sections=Array.from({length:input.readUInt16LE(pe+6)},(_,i)=>{
  const p=table+i*40;return{name:input.toString('ascii',p,p+8).replace(/\0/g,''),rva:input.readUInt32LE(p+12),raw:input.readUInt32LE(p+20),size:input.readUInt32LE(p+16)};
 });
 const off=va=>{const s=sections.find(s=>va>=0x400000+s.rva&&va+5<=0x400000+s.rva+s.size);assert.equal(s?.name,'CODE');return s.raw+va-0x400000-s.rva;};
 for(const[va,opcode,before,after,label]of nativeColors) {
  const at=off(va);assert.equal(input[at],opcode,label);assert.equal(input.readUInt32LE(at+1),before,label);
  out.writeUInt32LE(after,at+1);ranges.push([at+1,at+5]);changes.push({va,offset:at+1,before,after,label});
 }
 const chooser=resources.find(r=>r.type===10&&r.name==='TDLG_SELADDR');
 const chooserTree=parseDFM(input.subarray(chooser.offset,chooser.offset+chooser.size));
 let headers=0;function check(node){for(const p of node.properties)if(p.name==='OnCustomPaint'&&p.value==='pnlToTopCustomPaint')headers++;node.children.forEach(check);}check(chooserTree);assert.equal(headers,4);
 const resource=resources.find(r=>r.type===10&&r.name==='TADDRESSAPPFRAME');
 const original=input.subarray(resource.offset,resource.offset+resource.size),tree=parseDFM(original);
 let target;function walk(node,prefix=''){const name=prefix+'.'+node.name;if(name==='.AddressAppFrame.TBXDock1.tbRight.xpnl1.Panel_QiuckSearchBack.edtSearch'){assert.equal(node.className,'TFMZRichEdit');target=node.properties.find(p=>p.name==='Font.Color');}for(const child of node.children)walk(child,name);}walk(tree);
 assert.equal(target?.type,7);assert.equal(target.value,'clWindowText');
 const color=Buffer.from('04e6e6e600','hex');
 const dfm=Buffer.concat([original.subarray(0,target.offset),color,original.subarray(target.end)]);
 parseDFM(dfm);assert(dfm.length<original.length);
 dfm.copy(out,resource.offset);out.fill(0,resource.offset+dfm.length,resource.offset+resource.size);out.writeUInt32LE(dfm.length,resource.dataEntry+4);
 ranges.push([resource.offset,resource.offset+resource.size],[resource.dataEntry+4,resource.dataEntry+8]);
 changes.push({resource:resource.name,property:'edtSearch.Font.Color',before:'clWindowText',after:0xe6e6e6,oldSize:original.length,newSize:dfm.length});
 for(const[name,width,height,hash]of sprites) {
  const r=resources.find(r=>r.type===10&&r.name===name);assert(r);
  const png=input.subarray(r.offset,r.offset+r.size);assert.equal(sha(png),hash);
  const result=recolorSelection(png,width,height);assert(result.encoded.length<=r.size);
  result.encoded.copy(out,r.offset);out.fill(0,r.offset+result.encoded.length,r.offset+r.size);out.writeUInt32LE(result.encoded.length,r.dataEntry+4);
  ranges.push([r.offset,r.offset+r.size],[r.dataEntry+4,r.dataEntry+8]);
  changes.push({resource:name,width,height,beforeSHA256:hash,afterSHA256:sha(result.encoded),oldSize:r.size,newSize:result.encoded.length,pixels:result.changed,alphaChanged:0,minTextContrast:result.minContrast});
  assets.push({name,data:result.encoded});
 }
 const changedBytes=verifyByteDelta(input,out,ranges);
 assert.equal(out.length,input.length);
 const reverse=Buffer.from(out);for(const[start,end]of ranges)input.copy(reverse,start,start,end);assert(reverse.equals(input));
 return{buffer:out,changes,assets,changedBytes,ranges};
}
if(require.main===module) {
 const base=path.join(paths.temp,'version587-msaa-tray-guard','Foxmail.exe'),before=fs.readFileSync(base);assert.equal(sha(before),baselineSHA256);
 const recipient=require('./compose-recipient-contrast.cjs').patchBuffer(before);
 const recipientStage=path.join(paths.temp,'version587-compose-recipient-msaa');
 const abi=JSON.parse(fs.readFileSync(path.join(recipientStage,'abi-validation.json'),'utf8').replace(/^\uFEFF/,''));
 assert.equal(abi.passed,true);assert.equal(abi.cases,1280);assert.equal(abi.candidateSHA256,sha(recipient.buffer));
 assert.equal(abi.generatorSHA256,sha(fs.readFileSync(path.join(__dirname,'compose-recipient-contrast.cjs'))));
 assert(recipient.buffer.equals(fs.readFileSync(path.join(recipientStage,'Foxmail深色.exe'))));
 const shadow=require('./compose-toolbar-shadow.cjs').patchBuffer(recipient.buffer);
 const visual=patchVisuals(shadow.buffer),stage=paths.output('version587-contrast-followup'),dest=path.join(stage,'Foxmail.exe');
 // The previously tested tray guard sites/payload must survive every new layer.
 const guardReport=JSON.parse(fs.readFileSync(path.join(paths.temp,'version587-msaa-tray-guard/build.json'),'utf8'));
 const pe=before.readUInt32LE(60),op=pe+24,table=op+before.readUInt16LE(pe+20);
 for(let i=0;i<before.readUInt16LE(pe+6);i++) {
  const h=table+i*40,rva=before.readUInt32LE(h+12),raw=before.readUInt32LE(h+20),size=before.readUInt32LE(h+16);
  for(const site of guardReport.sites)if(site.rva>=rva&&site.rva<rva+size){const at=raw+site.rva-rva;assert.equal(visual.buffer.subarray(at,at+site.after.length/2).toString('hex'),site.after);}
 }
 assert(visual.buffer.subarray(before.length-512,before.length).equals(before.subarray(before.length-512)),'Tray guard payload changed');
 assert(visual.buffer.subarray(recipient.stubRaw,recipient.stubRaw+recipient.stub.length).equals(recipient.stub),'Recipient wrapper changed');
 fs.writeFileSync(dest,visual.buffer);
 for(const asset of visual.assets)fs.writeFileSync(path.join(stage,asset.name+'.png'),asset.data);
 const external='7.2.25.587/PngImages/attach_select.png',png=visual.assets.find(x=>x.name==='COMPOSE_ATTACH_SELECT_PNG').data;
 const report={baselineSHA256,candidateSHA256:sha(visual.buffer),dest,recipientSHA256:sha(recipient.buffer),recipientABI:abi,shadowChanges:shadow.changes,visualChanges:visual.changes,visualChangedBytes:visual.changedBytes,trayGuardUnchanged:true,recipientStubUnchanged:true,externalAssets:[{relative:external,originalSHA256:sprites[0][3],sha256:sha(png),length:png.length,source:path.join(stage,'COMPOSE_ATTACH_SELECT_PNG.png')}],sources:Object.fromEntries(['contrast-followup.cjs','compose-recipient-contrast.cjs','compose-toolbar-shadow.cjs'].map(name=>[name,sha(fs.readFileSync(path.join(__dirname,name)))])),installed:false};
 fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({candidateSHA256:report.candidateSHA256,dest,changes:report.visualChanges,externalAssets:report.externalAssets}));
}
module.exports={patchVisuals,recolorSelection};