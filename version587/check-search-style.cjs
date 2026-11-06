'use strict';
// Pixel-level joins and state atlas; synthetic skin only.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs'),{pngDecode,pngEncode}=require('../recolor-search-scrollbars.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),stage=paths.output('version587-search-style'),plan=JSON.parse(fs.readFileSync(path.join(stage,'validation.json'))),images=new Map();
assert.equal(sha(fs.readFileSync(path.join(__dirname,'search-style.cjs'))),plan.generatorSHA256);let checks=0;
for(const c of plan.changes){const b=fs.readFileSync(c.dest),im=pngDecode(b);assert.equal(b[25],6);assert.equal(sha(b),c.newSHA256);assert.equal(im.width,c.width);assert.equal(im.height,c.height);assert.equal(im.width,c.atlas.tileWidth*c.atlas.cols);assert.equal(im.height,c.atlas.tileHeight*c.atlas.rows);assert(im.rgba.every((v,i)=>i%4!==3||v===255));images.set(c.name,im);checks+=7;}
const rgba=(im,x,y)=>[...im.rgba.subarray((y*im.width+x)*4,(y*im.width+x)*4+4)];
for(const scale of [1,2])for(const focus of [0,1]){
 const suffix=scale===2?'_2X':'',panel=images.get('COMMON_SEARCH_SEARCH_PANEL'+(focus?'_ACTIVE':'')+suffix+'_PNG'),left=images.get('MAIN_SEARCH_SEARCH_LEFT_BTN'+suffix+'_PNG'),right=images.get('MAIN_SEARCH_ADVANCE_SEARCH_BTN'+suffix+'_PNG'),lw=24*scale,rw=31*scale,h=29*scale;
 for(let y=0;y<h;y++){
  assert.deepEqual(rgba(left,focus*lw+lw-1,y),rgba(panel,Math.floor(panel.width/2),y));
  assert.deepEqual(rgba(right,0,focus*h+y),rgba(panel,Math.floor(panel.width/2),y));
  checks+=2;
 }
 assert.deepEqual(rgba(panel,Math.floor(panel.width/2),Math.floor(h/2)),[32,32,32,255]);checks++;
}
assert.equal(sha(fs.readFileSync(plan.input)),plan.baselineSHA256);assert.equal(sha(fs.readFileSync(plan.dest)),plan.candidateSHA256);checks+=2;
// Assemble two empty control bars from the software resources, no real UI/text.
const w=360,h=68,preview={width:w,height:h,rgba:Buffer.alloc(w*h*4)};for(let p=0;p<preview.rgba.length;p+=4){preview.rgba[p]=40;preview.rgba[p+1]=40;preview.rgba[p+2]=40;preview.rgba[p+3]=255;}
for(const focus of [0,1]){const panel=images.get('COMMON_SEARCH_SEARCH_PANEL'+(focus?'_ACTIVE':'')+'_PNG'),left=images.get('MAIN_SEARCH_SEARCH_LEFT_BTN_PNG'),right=images.get('MAIN_SEARCH_ADVANCE_SEARCH_BTN_PNG'),y0=focus*39,cap=Math.floor(panel.width/2);for(let y=0;y<29;y++)for(let x=0;x<w;x++){let color=rgba(panel,x<cap?x:x>=w-cap?panel.width-(w-x):cap,y);if(x<24)color=rgba(left,focus*24+x,y);if(x>=w-31)color=rgba(right,x-(w-31),focus*29+y);const p=((y0+y)*w+x)*4;Buffer.from(color).copy(preview.rgba,p);}}
const previewPath=path.join(stage,'search-preview.png');fs.writeFileSync(previewPath,pngEncode(preview));
const result={passed:true,candidateSHA256:plan.candidateSHA256,checks,sourceSHA256:plan.generatorSHA256,checkSHA256:sha(fs.readFileSync(__filename)),preview:previewPath,scope:'All eight output PNGs decode as RGBA6 with original atlas dimensions/order; normal/focus left and right inner joins match the common panel pixel-for-pixel at 1x/2x; field center matches native #202020; fixed input/output identities verified. No Foxmail/UIA/user content execution.'};fs.writeFileSync(path.join(stage,'pixel-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
