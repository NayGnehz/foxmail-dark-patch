'use strict';
// Continuous dark search skin; keep original atlas layout and glyph silhouettes.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),zlib=require('zlib'),paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs'),{pngDecode}=require('../recolor-search-scrollbars.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),stage=paths.output('version587-search-style');
const input=path.join(paths.output('version587-group-border-rgba'),'Foxmail深色.exe'),baselineSHA256='233e7bdfb5f0d3e688a46b7e9eccbed3572795b5312e7d5c810ad4a8b1b387c6',b=fs.readFileSync(input);assert.equal(sha(b),baselineSHA256);
const original=fs.readFileSync('D:/Users/Public/Downloads/Foxmail/Foxmail.exe');assert.equal(sha(original),'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399');
const selected=name=>/^(?:MAIN_SEARCH_(?:SEARCH_LEFT_BTN|ADVANCE_SEARCH_BTN)(?:_2X)?|COMMON_SEARCH_SEARCH_PANEL(?:_ACTIVE)?(?:_2X)?)_PNG$/.test(name),resources=readResources(b).resources,originalResources=readResources(original).resources,chosen=resources.filter(r=>r.type===10&&selected(r.name));assert.equal(chosen.length,8);
function crc(data){let c=0xffffffff;for(const v of data){c^=v;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return(c^0xffffffff)>>>0;}
function chunk(n,d){const t=Buffer.from(n),v=Buffer.alloc(d.length+12);v.writeUInt32BE(d.length);t.copy(v,4);d.copy(v,8);v.writeUInt32BE(crc(Buffer.concat([t,d])),d.length+8);return v;}
function encode(im){const h=Buffer.alloc(13);h.writeUInt32BE(im.width);h.writeUInt32BE(im.height,4);h[8]=8;h[9]=6;const raw=Buffer.alloc((im.width*4+1)*im.height);for(let y=0;y<im.height;y++)im.rgba.copy(raw,y*(im.width*4+1)+1,y*im.width*4,(y+1)*im.width*4);return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',h),...(im.phys?[chunk('pHYs',im.phys)]:[]),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
function shape(x,y,w,h,kind,inset){const r=h/2-inset;if(y<inset||y>=h-inset)return false;if(kind==='left'){if(x<inset)return false;return x>=h/2||Math.hypot(x-h/2,y-h/2)<=r;}if(kind==='right'){if(x>=w-inset)return false;return x<w-h/2||Math.hypot(x-(w-h/2),y-h/2)<=r;}return x>=inset&&x<w-inset&&(x>=h/2&&x<w-h/2||Math.hypot(x-h/2,y-h/2)<=r||Math.hypot(x-(w-h/2),y-h/2)<=r);}
function coverage(x,y,w,h,kind,inset){let n=0;for(let j=0;j<4;j++)for(let i=0;i<4;i++)if(shape(x+(i+.5)/4,y+(j+.5)/4,w,h,kind,inset))n++;return n/16;}
const blend=(a,v,t)=>a.map((c,i)=>Math.round(c*(1-t)+v[i]*t));
function style(source,name){
 const scale=name.includes('_2X')?2:1,isPanel=name.startsWith('COMMON_'),isLeft=name.includes('SEARCH_LEFT_BTN'),kind=isPanel?'panel':isLeft?'left':'right',cols=isPanel?1:isLeft?2:6,rows=isPanel?1:isLeft?1:2,w=source.width/cols,h=source.height/rows;
 assert(Number.isInteger(w)&&h===29*scale);if(!isPanel)assert(w===(isLeft?24:31)*scale);
 const out={width:source.width,height:source.height,phys:source.phys,rgba:Buffer.alloc(source.rgba.length)},glyphs=[];
 const at=(x,y)=>(y*source.width+x)*4,pixel=(x,y)=>[...source.rgba.subarray(at(x,y),at(x,y)+3)];
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const focus=isPanel?name.includes('_ACTIVE'):isLeft?col===1:row===1,hover=isLeft?col===1:col%3===1,pressed=!isPanel&&!isLeft&&col%3===2,open=!isPanel&&!isLeft&&col>=3;
  const fill=isLeft?[32,32,32]:pressed?[51,51,51]:hover||open?[40,40,40]:[32,32,32],border=focus?[96,96,96]:[61,61,61],icon=pressed?[240,240,240]:hover||open?[214,214,214]:[184,184,184],background=[40,40,40];
  const roi=isLeft?[5*scale,5*scale,22*scale,24*scale]:[8*scale,8*scale,24*scale,22*scale],darkGlyph=isLeft||col<2;let core;
  if(!isPanel){const candidates=[];for(let y=roi[1];y<roi[3];y++)for(let x=roi[0];x<roi[2];x++)candidates.push(pixel(col*w+x,row*h+y));candidates.sort((a,b)=>(a[0]+a[1]+a[2]-b[0]-b[1]-b[2])*(darkGlyph?1:-1));core=candidates[0];}
  let glyphPixels=0;const glyphMask=Buffer.alloc(w*h);
  if(!isPanel)for(let y=roi[1];y<roi[3];y++)for(let x=roi[0];x<roi[2];x++){
   const bg=pixel(col*w+(isLeft?w-2*scale:4*scale),row*h+y),p=pixel(col*w+x,row*h+y),d=core.map((v,i)=>v-bg[i]),den=d.reduce((n,v)=>n+v*v,0),alpha=den?Math.max(0,Math.min(1,d.reduce((n,v,i)=>n+v*(p[i]-bg[i]),0)/den)):0;
   if(alpha>.02)glyphMask[y*w+x]=Math.round(alpha*255);
  }
  // Original left tiles also contain border pixels in the ROI. Keep the one
  // connected magnifier silhouette; do not import stray pieces of that border.
  if(isLeft){const seen=new Set(),components=[];for(let i=0;i<glyphMask.length;i++)if(glyphMask[i]&&!seen.has(i)){const q=[i];seen.add(i);for(let j=0;j<q.length;j++){const p=q[j],x=p%w,y=Math.floor(p/w);for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){const n=yy*w+xx;if(glyphMask[n]&&!seen.has(n)){seen.add(n);q.push(n);}}}components.push(q);}components.sort((a,b)=>b.length-a.length);assert(components.length);const keep=new Set(components[0]);for(let i=0;i<glyphMask.length;i++)if(!keep.has(i))glyphMask[i]=0;}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const outer=coverage(x,y,w,h,kind,0),inner=coverage(x,y,w,h,kind,scale);let color=blend(background,border,outer);color=blend(color,fill,inner);
   if(glyphMask[y*w+x]){color=blend(color,icon,glyphMask[y*w+x]/255);glyphPixels++;}
   const p=at(col*w+x,row*h+y);out.rgba[p]=color[0];out.rgba[p+1]=color[1];out.rgba[p+2]=color[2];out.rgba[p+3]=255;
  }
  if(!isPanel){assert(glyphPixels>10*scale*scale&&glyphPixels<220*scale*scale,'Glyph mask outside expected original silhouette');glyphs.push({row,col,glyphPixels,maskSHA256:sha(glyphMask),core,icon,fill,focus});}
 }
 return {image:out,atlas:{scale,kind,cols,rows,tileWidth:w,tileHeight:h,glyphs}};
}
const out=Buffer.from(b),changes=[],allowed=[];
for(const r of chosen){const originalResource=originalResources.find(q=>q.type===r.type&&q.name===r.name&&q.lang===r.lang);assert(originalResource&&originalResource.offset===r.offset);const source=pngDecode(original.subarray(originalResource.offset,originalResource.offset+originalResource.size)),before=pngDecode(b.subarray(r.offset,r.offset+r.size)),styled=style(source,r.name),png=encode(styled.image),check=pngDecode(png);assert.equal(before.width,source.width);assert.equal(before.height,source.height);assert.equal(png[25],6);assert(check.rgba.equals(styled.image.rgba));assert(png.length<=originalResource.size);assert(b.subarray(r.offset+r.size,r.offset+originalResource.size).every(x=>x===0));for(const q of resources)if(q!==r)assert(q.offset+q.size<=r.offset||q.offset>=r.offset+originalResource.size);
 png.copy(out,r.offset);out.writeUInt32LE(png.length,r.dataEntry+4);const dest=path.join(stage,r.name+'.png');fs.writeFileSync(dest,png);allowed.push([r.offset,r.offset+Math.max(png.length,r.size)],[r.dataEntry+4,r.dataEntry+8]);changes.push({name:r.name,language:r.lang,offset:r.offset,dataEntry:r.dataEntry,oldSize:r.size,newSize:png.length,originalCapacity:originalResource.size,oldSHA256:sha(b.subarray(r.offset,r.offset+r.size)),newSHA256:sha(png),pixelSHA256:sha(check.rgba),width:check.width,height:check.height,colorType:6,atlas:styled.atlas,dest});}
let changedBytes=0;for(let i=0;i<b.length;i++)if(b[i]!==out[i]){changedBytes++;assert(allowed.some(([a,z])=>a<=i&&i<z),'Unexpected non-search resource delta');}
const reread=readResources(out).resources;assert.equal(reread.length,resources.length);for(let i=0;i<resources.length;i++){const a=resources[i],z=reread[i];assert.equal(a.offset,z.offset);assert.equal(a.name,z.name);if(!selected(a.name)){assert.equal(a.size,z.size);assert(out.subarray(a.offset,a.offset+a.size).equals(b.subarray(a.offset,a.offset+a.size)));}}
const pe=b.readUInt32LE(60),op=pe+24,so=op+b.readUInt16LE(pe+20);for(let i=0;i<b.readUInt16LE(pe+6);i++){const p=so+i*40;if(b.readUInt32LE(p+36)&0x20000000){const o=b.readUInt32LE(p+20),n=b.readUInt32LE(p+16);assert(out.subarray(o,o+n).equals(b.subarray(o,o+n)));}}assert(out.subarray(0,b.readUInt32LE(op+60)).equals(b.subarray(0,b.readUInt32LE(op+60))));
const dest=path.join(stage,'Foxmail深色.exe'),candidateSHA256=sha(out),report={input,dest,baselineSHA256,candidateSHA256,generatorSHA256:sha(fs.readFileSync(__filename)),helperSHA256:'0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70',changes,changedBytes,codeUnchanged:true,otherResourcesUnchanged:true,peHeadersUnchanged:true,fileSizeUnchanged:out.length===b.length,originalAtlasDimensionsAndStateOrderPreserved:true,glyphsDerivedFromOriginal:true,palette:{input:'#202020',outer:'#282828',border:'#3D3D3D',focus:'#606060',icon:'#B8B8B8',hoverIcon:'#D6D6D6'},scope:'Eight existing main search button/common search panel PNGs only. Original atlas size, state ordering and original glyph silhouettes retained; continuous rounded outer edge, flat inner joins, neutral dark palette. All RGBA6; no code, DFM, hit-test, DPI, font, HTML or address-book-specific resource changes.',installed:false};
fs.writeFileSync(dest,out);fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({candidateSHA256,dest,changedBytes,changes:changes.map(x=>({name:x.name,oldSize:x.oldSize,newSize:x.newSize,atlas:x.atlas}))}));
