'use strict';
// One bounded static resource scan of the cached accepted 233e software image.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs'),{pngDecode}=require('../recolor-search-scrollbars.cjs');
const input=path.join(paths.output('version587-group-border-rgba'),'Foxmail深色.exe'),b=fs.readFileSync(input),sha=x=>crypto.createHash('sha256').update(x).digest('hex');assert.equal(sha(b),'233e7bdfb5f0d3e688a46b7e9eccbed3572795b5312e7d5c810ad4a8b1b387c6');
const stage=paths.output('version587-address-sort'),rs=readResources(b).resources,images=[],controls=[];
for(const r of rs.filter(r=>r.type===10&&/(ADDR|SORT|ORDER)/i.test(r.name)&&/_PNG$/.test(r.name))){
 const bytes=b.subarray(r.offset,r.offset+r.size),im=pngDecode(bytes),colors=new Map();let opaqueLight=0,visible=0;
 for(let p=0;p<im.rgba.length;p+=4){if(!im.rgba[p+3])continue;visible++;if(Math.min(...im.rgba.subarray(p,p+3))>180&&im.rgba[p+3]>220)opaqueLight++;const key=[...im.rgba.subarray(p,p+4)].join(',');colors.set(key,(colors.get(key)||0)+1);}
 const row={name:r.name,width:im.width,height:im.height,colorType:bytes[25],visible,opaqueLight,dominant:[...colors].sort((a,b)=>b[1]-a[1]).slice(0,3),sha256:sha(bytes)};images.push(row);
 if(/^ADDRESS_ADDRESS_BAR(?:_2X)?_PNG$/.test(r.name)){const dest=path.join(stage,r.name+'.png');fs.writeFileSync(dest,bytes);row.extracted=dest;}
}
for(const r of rs.filter(r=>r.type===10&&['TADDRESSAPPFRAME','TADDRMEMBER','TDLG_SELADDR'].includes(r.name))){
 const tree=parseDFM(b.subarray(r.offset,r.offset+r.size));function walk(o,p=''){p+='.'+o.name;if(/Sort|Order|AZ|A2Z/i.test(p)||/Button|Image/.test(o.className))controls.push({resource:r.name,path:p,className:o.className,properties:o.properties.filter(x=>/Caption|Image|Picture|On|Width|Height|Visible/.test(x.name)).map(x=>({name:x.name,value:x.value}))});o.children.forEach(c=>walk(c,p));}walk(tree);
}
fs.writeFileSync(path.join(stage,'audit.json'),JSON.stringify({input,inputSHA256:sha(b),images,controls},null,2));console.log(JSON.stringify({images:images.filter(x=>/^ADDRESS_ADDRESS_BAR/.test(x.name)),controls:controls.filter(x=>/tbxbtnMenu/.test(x.path))}));
