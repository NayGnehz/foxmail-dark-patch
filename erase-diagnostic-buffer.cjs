'use strict';
// In-memory diagnostics only: no OS queries, text, pixels, I/O or callbacks.
const FIELDS=['sequence','site','selfVmtRva','self','reason','technology','hdcType','bitsPerPixel','mapMode','rop2','graphicsMode','layout','clipType','fillResult','hdc','messageId'];
const REASONS=['reserved','nullSelf','nullMessage','otherMessage','classMismatch','nullHdc','nonDisplay','missingApi','otherHdcType','noBitmap','bitmapQueryFailed','lowBitDepth','mapMode','rop2','graphicsMode','layout','emptyOrFailedClip','missingBrush','fillFailed','filled','observedMainFormNoFill'];
function create({byte,u32,rva,code},siteCount){
 const refs=[];const at=i=>-128+i*4;
 function dwordField(i,v){byte(0xc7,0x45,at(i)&255);u32(v);}
 function store(i,reg='eax'){byte(0x89,{eax:0x45,ecx:0x4d,edx:0x55}[reg],at(i)&255);}
 function init(site){byte(0x8d,0x7d,0x80,0xb9);u32(16);byte(0x83,0xc8,0xff,0xf3,0xab);dwordField(1,site);dwordField(2,0);dwordField(4,1);byte(0x8b,0x45,0xfc,0x8b,0x55,0xf8);store(3);}
 function reason(n){dwordField(4,n);}
 function ref(name){refs.push({at:code.length,name});u32(0);}
 function record(site){
  byte(0x9c,0x60,0xb8);u32(1);byte(0xf0,0x0f,0xc1,0x83);ref('nextSequenceRva');
  byte(0x89,0xc2,0x42,0x25);u32(255);byte(0xc1,0xe0,6,0x8d,0xbb);ref('ringRva');byte(0x01,0xc7,0xc7,7);u32(0);
  byte(0x57,0x83,0xc7,4,0x8d,0x75,0x84,0xb9);u32(15);byte(0xf3,0xa5,0x5f,0x89,0x17);
  byte(0xf0,0xff,0x83);ref('committedRva');byte(0x8b,0x4d,0x90,0x81,0xc1);u32(site*32);byte(0xf0,0xff,0x84,0x8b);ref('countersRva');byte(0x61,0x9d);
 }
 function finish(){
  while(code.length%16)byte(0);const headerRva=rva+code.length;
  for(const v of [0x58444645,1,256,64,0,0,siteCount,32])u32(v);
  const countersRva=rva+code.length;for(let i=0;i<siteCount*32;i++)u32(0);
  const ringRva=rva+code.length;for(let i=0;i<256*16;i++)u32(0);
  const meta={headerRva,byteLength:32+siteCount*32*4+256*64,nextSequenceRva:headerRva+16,committedRva:headerRva+20,countersRva,ringRva,capacity:256,recordBytes:64,siteCount,counterReasons:32,fields:FIELDS,reasons:REASONS,unqueried:0xffffffff,privacy:'Only numeric control/drawing metadata; no text, email, filenames, pixels or I/O'};
  for(const p of refs){const v=meta[p.name];for(let k=0;k<4;k++)code[p.at+k]=(v>>>(k*8))&255;}
  return meta;
 }
 return{init,store,reason,record,finish};
}
module.exports={create,FIELDS,REASONS};
