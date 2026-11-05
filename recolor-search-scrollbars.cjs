'use strict';
// Same-allocation, reversible resource editing. Preserves executable sections, resource RVAs,
// PNG alpha and dimensions; never rebuilds the PE resource section.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const {readResources}=require('./pe-resource-utils.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const signature=Buffer.from('89504e470d0a1a0a','hex');
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(b){let n=0xffffffff;for(const x of b)n=crcTable[(n^x)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function chunk(name,data){const t=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);t.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([t,data])),data.length+8);return out;}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function pngDecode(b){
 if(!b.subarray(0,8).equals(signature))throw Error('Not PNG');
 let width,height,depth,type,interlace,palette,alpha,phys,idat=[];
 for(let p=8;p<b.length;){const n=b.readUInt32BE(p),name=b.toString('ascii',p+4,p+8),d=b.subarray(p+8,p+8+n);if(crc32(b.subarray(p+4,p+8+n))!==b.readUInt32BE(p+8+n))throw Error('PNG CRC mismatch');
  if(name==='IHDR'){width=d.readUInt32BE(0);height=d.readUInt32BE(4);depth=d[8];type=d[9];interlace=d[12];}
  if(name==='IDAT')idat.push(d);if(name==='PLTE')palette=d;if(name==='tRNS')alpha=d;if(name==='pHYs')phys=d;p+=n+12;if(name==='IEND')break;
 }
 if(depth!==8||interlace!==0||![2,3,6].includes(type))throw Error('Unsupported PNG format');
 const bpp=type===6?4:type===2?3:1,stride=width*bpp,raw=zlib.inflateSync(Buffer.concat(idat)),pixels=Buffer.alloc(stride*height);
 if(raw.length!==(stride+1)*height)throw Error('Unexpected PNG dimensions');
 for(let y=0;y<height;y++){const f=raw[y*(stride+1)];if(f>4)throw Error('Bad filter');for(let x=0;x<stride;x++){const at=y*stride+x,a=x>=bpp?pixels[at-bpp]:0,b=y?pixels[at-stride]:0,c=y&&x>=bpp?pixels[at-stride-bpp]:0;const predictor=f===0?0:f===1?a:f===2?b:f===3?Math.floor((a+b)/2):paeth(a,b,c);pixels[at]=(raw[y*(stride+1)+1+x]+predictor)&255;}}
 const rgba=Buffer.alloc(width*height*4);for(let i=0;i<width*height;i++){if(type===3){const k=pixels[i];rgba[i*4]=palette[k*3];rgba[i*4+1]=palette[k*3+1];rgba[i*4+2]=palette[k*3+2];rgba[i*4+3]=alpha&&k<alpha.length?alpha[k]:255;}else{rgba[i*4]=pixels[i*bpp];rgba[i*4+1]=pixels[i*bpp+1];rgba[i*4+2]=pixels[i*bpp+2];rgba[i*4+3]=type===6?pixels[i*bpp+3]:255;}}
 return{width,height,rgba,phys};
}
function filterRows(pixels,width,height,bpp){const stride=width*bpp,out=Buffer.alloc((stride+1)*height);for(let y=0;y<height;y++){let best,bestScore=Infinity,bestFilter;for(let f=0;f<5;f++){const row=Buffer.alloc(stride);let score=0;for(let x=0;x<stride;x++){const at=y*stride+x,a=x>=bpp?pixels[at-bpp]:0,b=y?pixels[at-stride]:0,c=y&&x>=bpp?pixels[at-stride-bpp]:0,p=f===0?0:f===1?a:f===2?b:f===3?Math.floor((a+b)/2):paeth(a,b,c);row[x]=(pixels[at]-p)&255;score+=Math.min(row[x],256-row[x]);}if(score<bestScore){bestScore=score;best=row;bestFilter=f;}}out[y*(stride+1)]=bestFilter;best.copy(out,y*(stride+1)+1);}return out;}
function pngEncode({width,height,rgba,phys}){
 function make(type,pixels,bpp,palette,alpha){const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=type;const parts=[signature,chunk('IHDR',header)];if(phys)parts.push(chunk('pHYs',phys));if(palette)parts.push(chunk('PLTE',palette));if(alpha)parts.push(chunk('tRNS',alpha));parts.push(chunk('IDAT',zlib.deflateSync(filterRows(pixels,width,height,bpp),{level:9})),chunk('IEND',Buffer.alloc(0)));return Buffer.concat(parts);}
 const candidates=[make(6,rgba,4)];const map=new Map(),colors=[],indexes=Buffer.alloc(width*height);
 for(let i=0;i<width*height;i++){const key=rgba.readUInt32BE(i*4);if(!map.has(key)){map.set(key,colors.length);colors.push(key);}if(colors.length>256)break;indexes[i]=map.get(key);}
 if(colors.length<=256){const pal=Buffer.alloc(colors.length*3),alpha=Buffer.alloc(colors.length);colors.forEach((c,i)=>{pal[i*3]=c>>>24;pal[i*3+1]=(c>>>16)&255;pal[i*3+2]=(c>>>8)&255;alpha[i]=c&255;});candidates.push(make(3,indexes,1,pal,alpha));}
 return candidates.reduce((a,b)=>a.length<b.length?a:b);
}
function isSelected(r){return(r.type===10&&/^(COMMON_SEARCH_SEARCH_PANEL(_ACTIVE)?(_2X)?_PNG|ADDRESS_SEARCH_SEARCH_PANEL(_ACTIVE)?(_2X)?_PNG|SKIN_SCROLLBAR_ALL_(HORZSCROLLBAR|VERTSCROLLBAR|SCROLLBAR)_(BARHORZ(DOWN|HOVER|NORMAL)|BARVERT(DOWN|HOVER|NORMAL)|BKGHORZ|BKGVERT|BKGCROSS)_2X_PNG)$/.test(r.name))||(r.type===2&&/^(SKIN_SCROLLBAR_)?ALL_(HORZSCROLLBAR|VERTSCROLLBAR|SCROLLBAR)_(BARHORZ(DOWN|HOVER|NORMAL)|BARVERT(DOWN|HOVER|NORMAL)|BKGHORZ|BKGVERT|BKGCROSS)_BMP$/.test(r.name));}
function mapColor(r,g,b,name){if(r>200&&b>200&&g<100)return null;const low=Math.min(r,g,b),high=Math.max(r,g,b);if(low<100||high-low>100)return null;const lum=(r+g+b)/3,delta=Math.max(-4,Math.min(4,Math.round((lum-210)/15)));let color=/BARHORZ|BARVERT/.test(name)?(/DOWN/.test(name)?[148,148,148]:/HOVER/.test(name)?[128,128,128]:[102,102,102]):/SEARCH/.test(name)?[40,40,40]:[32,32,32];return color.map(v=>v+delta);}
module.exports={pngDecode,pngEncode};
if(require.main===module){
const [, , source,dest]=process.argv;if(!source||!dest||path.resolve(source)===path.resolve(dest))throw Error('Supply distinct input and output');const before=fs.readFileSync(source),out=Buffer.from(before),{resources,op}=readResources(out),report=[],undo=[];
for(const r of resources.filter(isSelected)){
 const original=Buffer.from(before.subarray(r.offset,r.offset+r.size));let changed=0,pixels=0,width,height,encoded;
 if(r.type===10){const image=pngDecode(original);({width,height}=image);pixels=width*height;const alphaBefore=Buffer.from(image.rgba);
  for(let i=0;i<image.rgba.length;i+=4){if(!image.rgba[i+3])continue;const c=mapColor(image.rgba[i],image.rgba[i+1],image.rgba[i+2],r.name);if(c){image.rgba[i]=c[0];image.rgba[i+1]=c[1];image.rgba[i+2]=c[2];changed++;}}
  encoded=pngEncode(image);const check=pngDecode(encoded);if(!check.rgba.equals(image.rgba))throw Error('PNG roundtrip failed');for(let i=3;i<image.rgba.length;i+=4)if(image.rgba[i]!==alphaBefore[i])throw Error('Alpha modified');
  if(encoded.length>r.size)throw Error('PNG exceeds allocation: '+r.name+' '+encoded.length+' > '+r.size);
 }else{
  encoded=Buffer.from(original);const header=encoded.readUInt32LE(0),bits=encoded.readUInt16LE(14);width=encoded.readInt32LE(4);height=Math.abs(encoded.readInt32LE(8));pixels=width*height;
  if(header!==40||bits!==24||encoded.readUInt32LE(16)!==0)throw Error('Unsupported scrollbar DIB');const stride=Math.ceil(width*3/4)*4;if(header+stride*height>encoded.length)throw Error('DIB bounds');
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=header+y*stride+x*3,c=mapColor(encoded[p+2],encoded[p+1],encoded[p],r.name);if(c){encoded[p]=c[2];encoded[p+1]=c[1];encoded[p+2]=c[0];changed++;}}
 }
 if(changed){undo.push({offset:r.offset,name:r.name,originalBase64:original.toString('base64')});encoded.copy(out,r.offset);if(encoded.length<r.size){out.fill(0,r.offset+encoded.length,r.offset+r.size);undo.push({offset:r.dataEntry+4,name:r.name+' data size',originalBase64:before.subarray(r.dataEntry+4,r.dataEntry+8).toString('base64')});out.writeUInt32LE(encoded.length,r.dataEntry+4);}}
 report.push({name:r.name,lang:r.lang,width,height,pixelsChanged:changed,pixels,oldSize:r.size,newSize:encoded.length});
}
for(const [offset,size]of[[op+64,4],[op+128,8]])if(out.subarray(offset,offset+size).some(x=>x)){undo.push({offset,name:'PE checksum/signature metadata',originalBase64:before.subarray(offset,offset+size).toString('base64')});out.fill(0,offset,offset+size);}
if(!report.length)throw Error('No selected resources');
const verify=Buffer.from(out);for(const r of undo)Buffer.from(r.originalBase64,'base64').copy(verify,r.offset);if(!verify.equals(before))throw Error('Reversibility check failed');
const metadata={source,dest,inputSHA256:sha(before),outputSHA256:sha(out),fileSizeUnchanged:out.length===before.length,resources:report,changedRanges:undo};fs.writeFileSync(dest,out);fs.writeFileSync(dest+'.bitmap-undo.json',JSON.stringify(metadata,null,2));fs.writeFileSync(dest+'.bitmap-report.json',JSON.stringify({...metadata,changedRanges:undo.map(({offset,name})=>({offset,name}))},null,2));console.log(JSON.stringify({fileSizeUnchanged:metadata.fileSizeUnchanged,resources:report},null,2));
}
