// Isolated fixture builder; never runs or installs Foxmail.
const fs=require('fs'),p=require('./inspect-pe.cjs'),m=require('./add-paint-phase-diagnostic.cjs');
const align=(n,a)=>Math.ceil(n/a)*a,rva=align(Math.max(...p.sections.map(s=>s.rva+Math.max(s.vs,s.size))),4096),raw=align(p.b.length,512),code=[];
const byte=(...v)=>code.push(...v),u32=v=>{const b=Buffer.alloc(4);b.writeUInt32LE(v>>>0);byte(...b);};
const meta=m.emit({byte,u32,rva,code,imports:p.imports});
const initRva=rva+code.length;byte(0x60,0xe8,0,0,0,0);const after=code.length;byte(0x5b,0x81,0xeb);u32(rva+after);m.emitInit({byte,u32,imports:p.imports},meta);byte(0x61,0xc3);
const out=Buffer.alloc(raw+align(code.length,512));p.b.copy(out);Buffer.from(code).copy(out,raw);m.patchOriginal(out,p.off,meta);
const sh=p.so+p.ns*40;out.write('.fxprobe',sh);out.writeUInt32LE(code.length,sh+8);out.writeUInt32LE(rva,sh+12);out.writeUInt32LE(align(code.length,512),sh+16);out.writeUInt32LE(raw,sh+20);out.writeUInt32LE(0xe0000060,sh+36);out.writeUInt16LE(p.ns+1,p.pe+6);out.writeUInt32LE(align(rva+code.length,4096),p.op+56);
fs.writeFileSync(process.argv[3],out);fs.writeFileSync(process.argv[3]+'.json',JSON.stringify({nativePaintPhase:meta,initRva},null,2));console.log('Built isolated diagnostic fixture '+code.length+' bytes');
