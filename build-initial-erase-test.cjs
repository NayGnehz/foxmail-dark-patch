'use strict';
// Standalone mapped-code fixture, not an installed/runnable Foxmail candidate.
const fs=require('fs'),p=require('./inspect-pe.cjs'),m=require(process.argv[4]||'./add-initial-erase.cjs');
const align=(n,a)=>Math.ceil(n/a)*a,{b,pe,op,ns,so,sections,imports}=p;
const rva=align(Math.max(...sections.map(s=>s.rva+Math.max(s.vs,s.size))),4096),raw=align(b.length,512),code=[],patches=[];
const byte=(...v)=>code.push(...v),u32=v=>{const x=Buffer.alloc(4);x.writeUInt32LE(v>>>0);byte(...x);};
const nativeErase=m.emit({byte,u32,rva,code,patches,imports});while(code.length%4)byte(0);const brushRva=rva+code.length;u32(0);
for(const q of patches){if(q.brush!==5)throw Error('Unexpected fixup');for(let i=0;i<4;i++)code[q.at+i]=(brushRva>>>(i*8))&255;}
const out=Buffer.alloc(raw+align(code.length,512));b.copy(out);Buffer.from(code).copy(out,raw);m.patchOriginal(out,p.off,nativeErase);
const sh=so+ns*40;out.write('.fxerase',sh,'ascii');out.writeUInt32LE(code.length,sh+8);out.writeUInt32LE(rva,sh+12);out.writeUInt32LE(align(code.length,512),sh+16);out.writeUInt32LE(raw,sh+20);out.writeUInt32LE(0xe0000060,sh+36);
out.writeUInt16LE(ns+1,pe+6);out.writeUInt32LE(align(rva+code.length,4096),op+56);out.writeUInt32LE(0,op+128);out.writeUInt32LE(0,op+132);
fs.writeFileSync(process.argv[3],out);fs.writeFileSync(process.argv[3]+'.json',JSON.stringify({nativeErase,brushRva},null,2));console.log('Mapped-code fixture bytes: '+code.length);
