'use strict';
// Replace the verified per-scanline LOGPEN vertical-gradient loop with one
// native GradientFill. The Delphi register ABI and the original CL=0 path stay intact.
const ORIGINAL=0x4b62d4, COLOR_TO_RGB=0x255d60;
function emit(env){
  const {byte,u32,rva,code,patches,hooks,imports,callMap}=env;
  const start=code.length, labels={}, fixups=[], dataFixups=[];
  const jump=(op,label)=>{byte(...op);fixups.push({at:code.length,label});u32(0);};
  const callRva=target=>{byte(0xe8);u32(target-(rva+code.length+4));};
  const device=imports.find(h=>h.name==='GetDeviceCaps');
  const mapMode=imports.find(h=>h.name==='GetMapMode');
  const moveTo=imports.find(h=>h.name==='MoveToEx');
  const gradient=hooks.find(h=>h.name==='GradientFill');
  const initImports=['GetProcAddress','GetModuleHandleA'].map(name=>imports.find(h=>h.name===name));
  if(!device||!mapMode||!moveTo||!gradient||initImports.some(x=>!x))throw new Error('Missing native gradient dependencies');
  const dataRef=name=>{dataFixups.push({at:code.length,name});u32(0);};
  // Locals: HDC -4; RECT* -8; original ECX -12; vertices -48..-17; mesh -56..-49.
  byte(0x55,0x8b,0xec,0x83,0xec,64,0x53,0x56,0x57);
  byte(0x89,0x45,0xfc,0x89,0x55,0xf8,0x89,0x4d,0xf4,0x80,0xf9,1);jump([0x0f,0x85],'fallback');
  // Compute image base, position-independent under ASLR.
  byte(0xe8,0,0,0,0);const afterCall=code.length;byte(0x5b,0x81,0xeb);u32(rva+afterCall);
  byte(0x6a,2,0x50,0xff,0x93);u32(device.iat);
  byte(0x83,0xf8,1);jump([0x0f,0x85],'fallback');
  byte(0xff,0x75,0xfc,0xff,0x93);u32(mapMode.iat);
  byte(0x83,0xf8,1);jump([0x0f,0x85],'fallback');
  // Fast path only for ordinary copy-pen, compatible, non-RTL DCs.
  for(const [name,expected] of [['GetROP2',13],['GetGraphicsMode',1],['GetLayout',0]]){
    byte(0x8b,0x83);dataRef(name);byte(0x85,0xc0);jump([0x0f,0x84],'fallback');
    byte(0xff,0x75,0xfc,0xff,0xd0,0x83,0xf8,expected);jump([0x0f,0x85],'fallback');
  }
  byte(0x8b,0x55,0xf8,0x8b,0x42,8,0x3b,0x02);jump([0x0f,0x8e],'fallback');
  byte(0x8b,0x42,12,0x3b,0x42,4);jump([0x0f,0x8e],'fallback');
  // Vertex coordinates retain logical units, and GradientFill retains clipping.
  for(const [src,dst] of [[0,-48],[4,-44],[8,-32],[12,-28]])byte(0x8b,0x42,src,0x89,0x45,dst&255);
  for(const [arg,local] of [[12,-40],[8,-24]]){
    byte(0x8b,0x45,arg);callRva(COLOR_TO_RGB);
    // Map endpoints once, rather than remapping every intermediate scanline pen.
    callMap('background');
    byte(0x89,0xc1,0xc1,0xe1,8,0x66,0x89,0x4d,local&255);
    byte(0x66,0x25,0,0xff,0x66,0x89,0x45,(local+2)&255);
    // Retrieve original color: AX was masked above, so use ECX's shifted B channel.
    byte(0xc1,0xe9,16,0x66,0x81,0xe1,0,0xff,0x66,0x89,0x4d,(local+4)&255);
    byte(0x66,0xc7,0x45,(local+6)&255,0,0);
  }
  byte(0xc7,0x45,0xc8,0,0,0,0,0xc7,0x45,0xcc,1,0,0,0);
  // GradientFill(HDC, vertices,2, mesh,1, GRADIENT_FILL_RECT_V).
  byte(0x6a,1,0x6a,1,0x8d,0x45,0xc8,0x50,0x6a,2,0x8d,0x45,0xd0,0x50,0xff,0x75,0xfc,0xff,0x93);
  const slotAt=code.length;u32(0);patches.push({at:slotAt,slot:gradient.slot});
  byte(0x85,0xc0);jump([0x0f,0x84],'fallback');
  // LineTo in the original ends at (right,bottom-1). Retain that DC side effect.
  byte(0x8b,0x45,0xe4,0x48,0x6a,0,0x50,0xff,0x75,0xe0,0xff,0x75,0xfc,0xff,0x93);u32(moveTo.iat);
  labels.done=code.length;
  byte(0x5f,0x5e,0x5b,0x8b,0xe5,0x5d,0xc2,8,0);
  labels.fallback=code.length;
  // Restore all original register arguments even if the capability query clobbered them.
  byte(0x8b,0x45,0xfc,0x8b,0x55,0xf8,0x8b,0x4d,0xf4,0x5f,0x5e,0x5b,0x8b,0xe5,0x5d);
  // First six original bytes, then original+6 (push ESI/push EDI onwards).
  byte(0x55,0x8b,0xec,0x83,0xc4,0xb8,0xe9);u32(ORIGINAL+6-(rva+code.length+4));
  const dynamicSlots={},dynamicNames={};
  for(const name of ['GetROP2','GetGraphicsMode','GetLayout']){
    while(code.length%4)byte(0);
    dynamicSlots[name]=rva+code.length;u32(0);
    dynamicNames[name]=rva+code.length;byte(...Buffer.from(name+'\0','ascii'));
  }
  const gdiNameRva=rva+code.length;byte(...Buffer.from('gdi32.dll\0','ascii'));
  for(const f of dataFixups){const value=dynamicSlots[f.name];for(let n=0;n<4;n++)code[f.at+n]=(value>>>(n*8))&255;}
  for(const f of fixups){const d=labels[f.label]-(f.at+4);for(let n=0;n<4;n++)code[f.at+n]=(d>>>(n*8))&255;}
  return{start,entryRva:rva+start,fallbackRva:rva+labels.fallback,originalRva:ORIGINAL,colorToRgbRva:COLOR_TO_RGB,size:code.length-start,dynamicSlots,dynamicNames,gdiNameRva,initImports};
}
function emitInit(env,meta){
  const {byte,u32}=env;
  const module=meta.initImports.find(x=>x.name==='GetModuleHandleA');
  const proc=meta.initImports.find(x=>x.name==='GetProcAddress');
  // EBX is the image base; outer startup PUSHAD protects application registers.
  byte(0x8d,0x83);u32(meta.gdiNameRva);byte(0x50,0xff,0x93);u32(module.iat);byte(0x89,0xc6);
  for(const name of Object.keys(meta.dynamicSlots)){
    byte(0x8d,0x83);u32(meta.dynamicNames[name]);byte(0x50,0x56,0xff,0x93);u32(proc.iat);
    byte(0x89,0x83);u32(meta.dynamicSlots[name]);
  }
}
function patchOriginal(out,offset,metadata){
  const at=offset(ORIGINAL),expected=Buffer.from('558bec83c4b8','hex');
  if(!out.subarray(at,at+6).equals(expected))throw new Error('Native gradient prologue mismatch');
  out[at]=0xe9;out.writeInt32LE(metadata.entryRva-(ORIGINAL+5),at+1);out[at+5]=0x90;
}
module.exports={emit,emitInit,patchOriginal};
