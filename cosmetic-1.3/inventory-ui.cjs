'use strict';
// FOXMAIL_RETIRED_BASELINE_CLI: preserve patchBuffer exports; do not consume retired old EXE.
if (require.main === module) { throw new Error('Retired historical baseline CLI. See docs/cleanup-report-20261105.md; use the current print/compose entry.'); }
'use strict';
// Static application resources only; never reads mail, credentials or live controls.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {readResources}=require('../pe-resource-utils.cjs');
const {parseDFM}=require('../inspect-dfm-palette.cjs');
const {pngDecode}=require('../recolor-search-scrollbars.cjs');
const b=fs.readFileSync(path.join(__dirname,'../cosmetic-1.2/payload/Foxmail深色.exe'));
const digest=crypto.createHash('sha256').update(b).digest('hex');
if(digest!=='49da903389c103e64e819e50ce91baf186dcf85da95237505d90137d7291fd5b')throw Error('Unexpected baseline');
const rs=readResources(b).resources,forms=[],controlClasses={},parseFailures=[],paleSprites=[];
const colorProps=/^(transparentColor|BorderColor|BorderColorHot|BorderColorDown|BorderLightColor|BorderDarkColor|FrameColor|LineColor|headerBkgColor|Color)$/i;
const borderProps=/^(BevelInner|BevelOuter|BorderStyle|Ctl3D|ParentCtl3D|isWhiteBorder)$/i;
function pale(v){if(typeof v==='number'&&v>=0&&v<=0xffffff){const c=[v&255,v>>>8&255,v>>>16&255];return Math.min(...c)>170&&Math.max(...c)-Math.min(...c)<70;}return /^(clWhite|clWindow|clBtnHighlight|cl3DLight|clSilver|clBtnFace)$/.test(v);}
for(const r of rs){
 const data=b.subarray(r.offset,r.offset+r.size);
 if(r.type===10&&data.toString('ascii',0,4)==='TPF0'){
  try{
   const t=parseDFM(data),rows=[];
   function walk(o,p){p=p?p+'.'+o.name:o.name;controlClasses[o.className]=(controlClasses[o.className]||0)+1;
    const props=o.properties.filter(x=>colorProps.test(x.name)||borderProps.test(x.name)).map(x=>({name:x.name,type:x.type,value:x.value,pale:pale(x.value)}));
    if(props.length)rows.push({path:p,className:o.className,properties:props});
    o.children.forEach(c=>walk(c,p));
   }walk(t,'');forms.push({resource:r.name,rootClass:t.className,controls:rows});
  }catch(error){parseFailures.push({resource:r.name,error:error.message});}
 }
 if(r.type===10&&typeof r.name==='string'&&/^(CONTROLS_|ADDRESS_|COMPOSE_|SETTINGS_|COMMON_)/.test(r.name)&&data.subarray(0,8).toString('hex')==='89504e470d0a1a0a'){
  try{const im=pngDecode(data);let light=0,opaque=0;for(let p=0;p<im.rgba.length;p+=4){if(im.rgba[p+3]>200){opaque++;if(Math.min(...im.rgba.subarray(p,p+3))>185)light++;}}
   if(light)paleSprites.push({resource:r.name,width:im.width,height:im.height,paleOpaquePixels:light,opaquePixels:opaque,ratio:light/Math.max(1,opaque)});
  }catch(error){parseFailures.push({resource:r.name,error:error.message});}
 }
}
const report={baselineSHA256:digest,scope:'Static UI color/style properties and named UI PNG pixels only; no captions, field text, accounts or content extracted',forms,controlClasses,parseFailures,paleSprites};
fs.writeFileSync(path.join(__dirname,'ui-inventory.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({dfmResources:forms.length,distinctControlClasses:Object.keys(controlClasses).length,parseFailures:parseFailures.length,paleUiSprites:paleSprites.length,topClasses:Object.entries(controlClasses).sort((a,b)=>b[1]-a[1]).slice(0,16)}));
