'use strict';
const fs=require('fs'),mod=require('./add-transient-buffer.cjs');
const code=[],patches=[],imports=['GetClassNameA','GetWindowLongW','SetWindowLongW','IsWindowVisible','IsWindow','RedrawWindow','GetLastError','SetLastError','GetModuleHandleA','GetProcAddress'].map((name,i)=>({name,iat:0x100+i*4}));
const byte=(...v)=>code.push(...v),u32=v=>{const b=Buffer.alloc(4);b.writeUInt32LE(v>>>0);byte(...b);},rva=0x1000;
const ctx={byte,u32,code,patches,imports,rva};
const start=code.length;byte(0x52,0xe8,0,0,0,0,0x5a,0x81,0xea);u32(rva+6);
const refs=mod.emit(ctx,0);byte(0x8b,0x82);patches.push({at:code.length,slot:0});u32(0);byte(0x5a,0xff,0xe0);
const end=code.length,m=mod.emitData(ctx);for(const p of refs){const b=Buffer.alloc(4);b.writeUInt32LE(m[p.name]);for(let k=0;k<4;k++)code[p.at+k]=b[k];}for(const p of patches){const b=Buffer.alloc(4);b.writeUInt32LE(0x180);for(let k=0;k<4;k++)code[p.at+k]=b[k];}
const init=rva+code.length;byte(0x53,0xe8,0,0,0,0,0x5b,0x81,0xeb);u32(init+6);mod.emitInit(ctx,m);byte(0x5b,0xc3);
const probe=rva+code.length;byte(0x55,0x8b,0xec,0x53,0x56,0x57,0xbb);u32(0x12345678);byte(0xbe);u32(0x23456789);byte(0xbf);u32(0x3456789a);byte(0xba);u32(0x456789ab);byte(0xff,0x75,12,0xff,0x75,8,0xe8);u32(rva+start-(rva+code.length+4));
byte(0x89,0xd1,0xe8,0,0,0,0,0x5a,0x81,0xea);u32(rva+code.length-3); // address popped is immediately after CALL
// Patch preceding base subtraction explicitly.
const subAt=code.length-4;const popped=rva+subAt-3;for(let k=0;k<4;k++)code[subAt+k]=(popped>>>(8*k))&255;
byte(0x89,0x8a);u32(0x214); // Record original EDX before using ECX as scratch.
byte(0x89,0x82);u32(0x200);byte(0x89,0x9a);u32(0x204);byte(0x89,0xb2);u32(0x208);byte(0x89,0xba);u32(0x20c);byte(0x8d,0x4d,0xf4,0x29,0xe1,0x89,0x8a);u32(0x210);byte(0x5f,0x5e,0x5b,0x8b,0xe5,0x5d,0xc2,8,0);
const out=Buffer.alloc(rva+code.length);Buffer.from(code).copy(out,rva);fs.writeFileSync('transient-buffer-fixture.bin',out);
fs.writeFileSync('transient-buffer-fixture.txt',[`hook,${rva+start}`,`hookEnd,${rva+end}`,`init,${init}`,`probe,${probe}`,`original,384`,...Object.entries(m).filter(([k,v])=>typeof v==='number').map(([k,v])=>`${k},${v}`),...imports.map(i=>`${i.name},${i.iat}`)].join('\n'));
console.log(JSON.stringify({bytes:out.length,hookBytes:end-start,metadata:m}));
// Optional: prove the integrated PE block equals the emitter, then run that block in the fixture.
if(process.argv[2]){
 const pe=require('./inspect-pe.cjs'),meta=JSON.parse(fs.readFileSync(process.argv[3],'utf8')),t=meta.nativeTransientBuffer;
 if(!t)throw Error('Candidate has no transient buffering metadata');
 const actual=Buffer.from(pe.b.subarray(pe.off(meta.sectionRVA+t.emitStart),pe.off(meta.sectionRVA+t.emitEnd)));
 const realCode=Array(t.emitStart).fill(0),realPatches=[];
 const realByte=(...v)=>realCode.push(...v),realU32=v=>{const b=Buffer.alloc(4);b.writeUInt32LE(v>>>0);realByte(...b);};
 const realRefs=mod.emit({byte:realByte,u32:realU32,code:realCode,patches:realPatches,imports:pe.imports},0);
 for(const p of realRefs){const b=Buffer.alloc(4);b.writeUInt32LE(t[p.name]);for(let k=0;k<4;k++)realCode[p.at+k]=b[k];}
 for(const p of realPatches){const b=Buffer.alloc(4);b.writeUInt32LE(t.originalShowSlotRva);for(let k=0;k<4;k++)realCode[p.at+k]=b[k];}
 const expected=Buffer.from(realCode.slice(t.emitStart));if(!actual.equals(expected))throw Error('Integrated candidate differs from emitter');
 const normalized=Buffer.from(actual);
 // Rewrite only known relocation operands, retaining every actual candidate instruction byte.
 for(const p of realRefs)normalized.writeUInt32LE(m[p.name],p.at-t.emitStart);
 for(const p of realPatches)normalized.writeUInt32LE(0x180,p.at-t.emitStart);
 for(let i=0;i<actual.length-5;i++)if(actual[i]===0xff&&actual[i+1]===0x93){const source=pe.imports.find(x=>x.iat===actual.readUInt32LE(i+2));if(source){const target=imports.find(x=>x.name===source.name);if(!target)throw Error('Unmapped candidate API '+source.name);normalized.writeUInt32LE(target.iat,i+2);}}
 const moduleStart=13,moduleEnd=end-9;if(!normalized.equals(Buffer.from(code.slice(moduleStart,moduleEnd))))throw Error('Candidate normalization differs from standalone block');
 normalized.copy(out,rva+moduleStart);fs.writeFileSync('transient-buffer-integrated-fixture.bin',out);
 console.log('PASS actual integrated PE transient block: '+actual.length+' instruction bytes, exact equality before relocation; normalized actual bytes written to integrated fixture');
}
