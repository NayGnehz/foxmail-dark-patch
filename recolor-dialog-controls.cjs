'use strict';
// Explicit Foxmail control skins (TFMXButton, TFMCheckBox, TFMRadioButton,
// TFMComboBox) and the advanced-search state sprite. No application code changes.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {readResources}=require('./pe-resource-utils.cjs');
const {pngDecode,pngEncode}=require('./recolor-search-scrollbars.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const selected=/^(CONTROLS_FMXBUTTON_BUTTON(_BLUE)?_(NORMAL|HOVER|PRESS|FOCUS|DISABLE)_PNG|CONTROLS_CHECKBOX_CHECKBOX_(HOVER|SELECT|SELECT_DISABLE|UNSELECT|UNSELECT_DISABLE)(_2X)?_PNG|CONTROLS_RADIOBUTTON_RADIO_(HOVER|SELECT|SELECT_DISABLE|UNSELECT|UNSELECT_DISABLE)(_2X)?_PNG|CONTROLS_COMBOBOX_(CUSTOM_COMBO_(NORMAL|HOVER)(_2X)?|SELECT_(NORMAL|HOVER|PRESS|DISABLE)|SELECT_ICON_(NORMAL|DISABLE)_ARROW(_2X)?)_PNG|MAIN_SEARCH_(ADVANCE_SEARCH_BTN|SEARCH_LEFT_BTN)(_2X)?_PNG|SKIN_OTHER_BORDER_PNG)$/;
function palette(name){
 if(/DISABLE/.test(name))return{fill:[40,40,40],edge:[60,60,60],ink:[130,130,130],accent:[115,115,115]};
 if(/PRESS/.test(name))return{fill:[37,37,37],edge:[90,145,190],ink:[230,230,230],accent:[117,191,255]};
 if(/HOVER/.test(name))return{fill:[56,56,56],edge:[100,100,100],ink:[230,230,230],accent:[117,191,255]};
 if(/FOCUS/.test(name))return{fill:[51,51,51],edge:[117,191,255],ink:[230,230,230],accent:[117,191,255]};
 return{fill:[45,45,45],edge:[75,75,75],ink:[230,230,230],accent:[117,191,255]};
}
function mapPixel(name,im,x,y,r,g,b){
 const p=palette(name),low=Math.min(r,g,b),high=Math.max(r,g,b),lum=.2126*r+.7152*g+.0722*b;
 if(name==='SKIN_OTHER_BORDER_PNG')return lum<210?[61,61,61]:[32,32,32];
 if(name.startsWith('MAIN_SEARCH_ADVANCE_')){
  if(im.width%6||im.height%2)throw Error('Unexpected advanced-search sprite layout');
  const w=im.width/6,h=im.height/2,col=Math.floor(x/w),row=Math.floor(y/h),sx=x%w,sy=y%h;
  const glyph=sx>=w*0.22&&sx<=w*0.73&&sy>=h*0.22&&sy<=h*0.78;
  if(glyph&&((col<2&&lum<180&&high-low<60)||(col>=2&&low>195&&high-low<65)))return[230,230,230];
  const fill=[[40,40,40],[56,56,56],[37,37,37],[51,51,51],[38,79,120],[32,53,76]][col];
  // Outer skin outlines remain distinct; focused row uses a subdued blue edge.
  if((sx<2||sy<2||sx>w-3||sy>h-3)&&lum<210)return row?[95,135,175]:[65,65,65];
  return fill;
 }
 if(/SELECT_ICON_/.test(name))return p.ink;
 if(/CUSTOM_COMBO_/.test(name)){
  const scale=im.height/23;
  if(x>=im.width-18*scale&&x<=im.width-5*scale&&y>=6*scale&&y<=18*scale&&lum<190)return p.ink;
 }
 if(/CHECKBOX_|RADIOBUTTON_/.test(name)){
  // The blue mark/ring conveys checked state, so keep it lighter than the fill.
  if(b-r>40&&r<170&&b>=g&&g>=r)return p.accent;
  if(lum<180)return /DISABLE/.test(name)?[80,80,80]:[150,150,150];
  return /DISABLE/.test(name)?[36,36,36]:[40,40,40];
 }
 // TFMXButton and combo skins contain only a stretchable background and outline.
 if(lum<190)return p.edge;
 const delta=Math.max(-3,Math.min(3,Math.round((lum-230)/8)));
 return p.fill.map(v=>v+delta);
}
function patch(source,dest,originalPath){
 if(!originalPath||path.resolve(source)===path.resolve(dest))throw Error('Usage: INPUT OUTPUT ORIGINAL_EXE (distinct paths)');
 const before=fs.readFileSync(source),out=Buffer.from(before),original=fs.readFileSync(originalPath);
 if(sha(original)!=='54da7a968ad8a12bf80978269edfc57f520af9f19a18e5b78bf48742983dd4df')throw Error('Unsupported original Foxmail build');
 const current=readResources(out),originalResources=readResources(original).resources,report=[],undo=[];
 for(const r of current.resources.filter(r=>r.type===10&&selected.test(r.name))){
  const orig=originalResources.find(x=>x.type===r.type&&x.name===r.name&&x.lang===r.lang);
  if(!orig||orig.offset!==r.offset||orig.dataEntry!==r.dataEntry)throw Error('Resource layout changed '+r.name);
  const src=original.subarray(orig.offset,orig.offset+orig.size),originalImage=pngDecode(src),redrawn=r.name.startsWith('MAIN_SEARCH_');
  const im=redrawn?pngDecode(fs.readFileSync(path.join(__dirname,'SearchControls',r.name+'.png'))):originalImage,originalPixels=Buffer.from(originalImage.rgba);
  if(redrawn)im.phys=originalImage.phys;
  if(im.width!==originalImage.width||im.height!==originalImage.height)throw Error('Search image dimensions changed');
  if(!redrawn)for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const i=(y*im.width+x)*4;if(!im.rgba[i+3])continue;const c=mapPixel(r.name,im,x,y,im.rgba[i],im.rgba[i+1],im.rgba[i+2]);for(let k=0;k<3;k++)im.rgba[i+k]=c[k];}
  const encoded=pngEncode(im),check=pngDecode(encoded);
  if(encoded.length>orig.size||!check.rgba.equals(im.rgba))throw Error('PNG capacity/roundtrip failure '+r.name);
  if(!redrawn)for(let i=3;i<im.rgba.length;i+=4)if(im.rgba[i]!==originalPixels[i])throw Error('Alpha changed '+r.name);
  // Use the original allocation, which still exists when an earlier resource
  // stage shortened only the resource data-size field (advanced-search sprites).
  undo.push({offset:r.offset,name:r.name,originalBase64:before.subarray(r.offset,r.offset+orig.size).toString('base64')});
  encoded.copy(out,r.offset);out.fill(0,r.offset+encoded.length,r.offset+orig.size);
  undo.push({offset:r.dataEntry+4,name:r.name+' size',originalBase64:before.subarray(r.dataEntry+4,r.dataEntry+8).toString('base64')});out.writeUInt32LE(encoded.length,r.dataEntry+4);
  report.push({name:r.name,width:im.width,height:im.height,oldSize:r.size,newSize:encoded.length,allocation:orig.size,searchIconRedrawn:redrawn});
 }
 if(report.length!==47)throw Error('Unexpected selected control count '+report.length);
 const restored=Buffer.from(out);for(const u of undo)Buffer.from(u.originalBase64,'base64').copy(restored,u.offset);if(!restored.equals(before))throw Error('Undo mismatch');
 const pe=before.readUInt32LE(60),so=pe+24+before.readUInt16LE(pe+20),ns=before.readUInt16LE(pe+6);
 for(let i=0;i<ns;i++){const s=so+i*40,name=before.toString('ascii',s,s+8).replace(/\0/g,''),raw=before.readUInt32LE(s+20),size=before.readUInt32LE(s+16);if(name!=='.rsrc'&&!before.subarray(raw,raw+size).equals(out.subarray(raw,raw+size)))throw Error('Non-resource section modified '+name);}
 const meta={source,dest,original:originalPath,inputSHA256:sha(before),outputSHA256:sha(out),fileSizeUnchanged:before.length===out.length,controlSkinAlphaPreserved:true,searchIconsRedrawn:true,resources:report,changedRanges:undo};
 fs.writeFileSync(dest,out);fs.writeFileSync(dest+'.bitmap-undo.json',JSON.stringify(meta,null,2));fs.writeFileSync(dest+'.bitmap-report.json',JSON.stringify({...meta,changedRanges:undo.map(({offset,name})=>({offset,name}))},null,2));
 return{resourcesChanged:report.length,fileSizeUnchanged:meta.fileSizeUnchanged,controlSkinAlphaPreserved:true,searchIconsRedrawn:true,outputSHA256:meta.outputSHA256};
}
module.exports={patch};
if(require.main===module){console.log(JSON.stringify(patch(...process.argv.slice(2)),null,2));}
