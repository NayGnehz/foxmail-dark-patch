'use strict';
// Static, same-allocation patch for the two audited A-Z button sprites.
// No CLI, file access, application access, or deployment side effects.
const assert = require('assert');
const crypto = require('crypto');
const zlib = require('zlib');
const {readResources} = require('../pe-resource-utils.cjs');
const {pngDecode} = require('../recolor-search-scrollbars.cjs');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const targets = [
  {name:'ADDRESS_ADDRESS_BAR_PNG', width:32, height:64,
    hash:'4c96fe2b23c14683f9e26e6de2b61d3ceb371b0802d6eb0d68dedf1e012d0bdd'},
  {name:'ADDRESS_ADDRESS_BAR_2X_PNG', width:64, height:128,
    hash:'cf6af1a987ee0bdaf04f5fc1d69526cebe5eb53aba8271baf168689d100b96df'}
];
const signature = Buffer.from('89504e470d0a1a0a','hex');
const crcTable = Array.from({length:256},(_,n) => {
  for(let i=0;i<8;i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length); out.write(type,4,4,'ascii'); data.copy(out,8);
  let crc = 0xffffffff;
  for(const v of out.subarray(4,out.length-4)) crc = crcTable[(crc ^ v)&255] ^ (crc >>> 8);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0,out.length-4);
  return out;
}
function paeth(a,b,c) {
  const p=a+b-c, x=Math.abs(p-a), y=Math.abs(p-b), z=Math.abs(p-c);
  return x<=y && x<=z ? a : y<=z ? b : c;
}
// Always RGBA6: native skin loading has already required this format.
function encodeRGBA(im) {
  const stride=im.width*4, raw=Buffer.alloc((stride+1)*im.height);
  for(let y=0;y<im.height;y++) {
    let best, bestFilter=0, bestScore=Infinity;
    for(let f=0;f<5;f++) {
      const row=Buffer.alloc(stride); let score=0;
      for(let x=0;x<stride;x++) {
        const at=y*stride+x, a=x>=4?im.rgba[at-4]:0,
          b=y?im.rgba[at-stride]:0, c=y&&x>=4?im.rgba[at-stride-4]:0;
        const prediction=f===0?0:f===1?a:f===2?b:f===3?Math.floor((a+b)/2):paeth(a,b,c);
        row[x]=(im.rgba[at]-prediction)&255; score+=Math.min(row[x],256-row[x]);
      }
      if(score<bestScore) {best=row;bestFilter=f;bestScore=score;}
    }
    raw[y*(stride+1)]=bestFilter; best.copy(raw,y*(stride+1)+1);
  }
  const hdr=Buffer.alloc(13); hdr.writeUInt32BE(im.width); hdr.writeUInt32BE(im.height,4);
  hdr[8]=8; hdr[9]=6;
  return Buffer.concat([signature,chunk('IHDR',hdr),
    ...(im.phys?[chunk('pHYs',im.phys)]:[]),
    chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function linear(v) {v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}
function contrast(a,b) {return (Math.max(linear(a),linear(b))+0.05)/(Math.min(linear(a),linear(b))+0.05);}
function patchBuffer(input) {
  assert(Buffer.isBuffer(input),'Expected a PE Buffer');
  const out=Buffer.from(input), resources=readResources(input).resources, changes=[];
  for(const target of targets) {
    const matches=resources.filter(r=>r.type===10 && r.name===target.name);
    assert.equal(matches.length,1,'Expected one audited language: '+target.name);
    const r=matches[0], original=input.subarray(r.offset,r.offset+r.size);
    assert.equal(sha(original),target.hash,'Unexpected original sprite: '+target.name);
    assert.equal(original[25],6,'Original sprite must be RGBA6');
    const im=pngDecode(original), before=Buffer.from(im.rgba);
    assert.equal(im.width,target.width); assert.equal(im.height,target.height);
    const stateHeight=im.height/4, scale=im.width/32, states=[];
    let pixelsChanged=0;
    for(let state=0;state<2;state++) {
      const background=state===0?32:40, foreground=state===0?216:232;
      const info={state,background,foreground,pixelsChanged:0,glyphCorePixels:0,
        backgroundPixels:0,minGlyphContrast:Infinity};
      for(let y=state*stateHeight;y<(state+1)*stateHeight;y++) for(let x=0;x<im.width;x++) {
        const i=(y*im.width+x)*4;
        if(!before[i+3]) continue;
        const lum=(before[i]*2126+before[i+1]*7152+before[i+2]*722)/10000;
        // Original core ink is darker than the pale fill. Inverting this
        // continuous ramp preserves its antialiasing instead of flattening
        // all light pixels into the same dark color (which would erase A-Z).
        const coverage=Math.max(0,Math.min(1,(255-lum)/105));
        const ink=Math.round(background+(foreground-background)*coverage);
        if(before[i]!==ink || before[i+1]!==ink || before[i+2]!==ink) {
          info.pixelsChanged++; pixelsChanged++;
        }
        im.rgba[i]=im.rgba[i+1]=im.rgba[i+2]=ink;
        const localY=y-state*stateHeight;
        // This interior box excludes the outer border; only opaque original
        // dark ink counts towards the required readable glyph-core guard.
        if(x>=4*scale && x<28*scale && localY>=3*scale && localY<13*scale &&
           before[i+3]===255 && lum<=170) {
          info.glyphCorePixels++;
          info.minGlyphContrast=Math.min(info.minGlyphContrast,contrast(ink,background));
        }
        if(before[i+3]===255 && lum>=245) info.backgroundPixels++;
      }
      assert(info.glyphCorePixels>0 && info.backgroundPixels>0,'Missing glyph/background separation');
      assert(info.minGlyphContrast>=7,'A-Z glyph contrast below 7:1');
      states.push(info);
    }
    for(let i=3;i<before.length;i+=4) assert.equal(im.rgba[i],before[i],'Alpha changed');
    assert(im.rgba.subarray(im.width*stateHeight*2*4).equals(before.subarray(im.width*stateHeight*2*4)),
      'Lower two blue states changed');
    const encoded=encodeRGBA(im), roundTrip=pngDecode(encoded);
    assert(roundTrip.rgba.equals(im.rgba),'PNG round trip failed');
    assert.equal(encoded[25],6); assert(encoded.length<=r.size,'PNG exceeds original allocation');
    encoded.copy(out,r.offset); out.fill(0,r.offset+encoded.length,r.offset+r.size);
    out.writeUInt32LE(encoded.length,r.dataEntry+4);
    changes.push({name:r.name,lang:r.lang,offset:r.offset,dataEntry:r.dataEntry,
      width:im.width,height:im.height,stateHeight,colorType:6,
      oldSize:r.size,newSize:encoded.length,sourceSHA256:target.hash,targetSHA256:sha(encoded),
      pixelsChanged,alphaChanged:0,lowerStatesChanged:0,states});
  }
  assert.equal(out.length,input.length);
  return {buffer:out,changes};
}
module.exports={patchBuffer};
