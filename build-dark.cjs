// Reversible, per-process color adaptation. No injection, no system changes.
const fs=require('fs'),crypto=require('crypto');
const p=require('./inspect-pe.cjs'); const {b,pe,op,ns,so,sections,imports}=p;
if(b.readUInt16LE(op)!==0x10b || b.readUInt16LE(pe+4)!==0x14c)throw Error('Expected x86 PE');
const align=(n,a)=>Math.ceil(n/a)*a;
const rva=align(Math.max(...sections.map(s=>s.rva+Math.max(s.vs,s.size))),4096);
const raw=align(b.length,512),code=[],patches=[],hooks=[];
const byte=(...v)=>code.push(...v),u32=v=>{const x=Buffer.alloc(4);x.writeUInt32LE(v>>>0);byte(...x);};
const rel32=(opcode,target)=>{byte(opcode);u32(target-(rva+code.length+4));};
const begin=()=>{const start=code.length;byte(0x52,0xe8,0,0,0,0,0x5a,0x81,0xea);u32(rva+start+6);return start;};
const end=(slot)=>{byte(0x8b,0x82);const at=code.length;u32(0);patches.push({at,slot});byte(0x5a,0xff,0xe0);};
const helperCalls=[],edgeRefs=[],displayRefs=[],transientBufferRefs=[];const callMap=kind=>{byte(0xe8);helperCalls.push({at:code.length,kind});u32(0);};
const transientBufferModule=process.env.FOXMAIL_TRANSIENT_BUFFER==='1'?require('./add-transient-buffer.cjs'):null;
let nativeTrayRestore=null;
let transientBufferRange=null;
const bgr=(r,g,bl)=>(bl<<16)|(g<<8)|r;
const bg=bgr(32,32,32),panel=bgr(40,40,40),text=bgr(230,230,230),border=bgr(61,61,61),accent=bgr(38,79,120);
const sys=new Map([[0,panel],[1,bg],[2,panel],[3,panel],[4,panel],[5,bg],[6,border],[7,text],[8,text],[9,text],[10,border],[11,border],[12,panel],[13,accent],[14,0xffffff],[15,panel],[16,border],[17,bgr(138,138,138)],[18,text],[19,text],[20,border],[21,bg],[22,border],[23,text],[24,panel],[26,bgr(118,181,255)],[27,panel],[28,panel],[30,panel]]);
// Known LOGPEN-based header fills and separators use guarded static colors;
// avoid adding a global indirect-pen hook to the hot drawing path.
const found=imports.filter(x=>['GetSysColor','GetSysColorBrush','SetTextColor','SetBkColor','CreateSolidBrush','CreatePen','CreateBrushIndirect','GradientFill','GetStockObject','FillRect','GdipCreateLineBrushFromRect','DeleteObject','RegisterClassA','RegisterClassW','ShowWindow','SetWindowPos',...(process.env.FOXMAIL_NATIVE_GRADIENT==='0'||process.env.FOXMAIL_DARK_EDGES==='0'?[]:['DrawEdge'])].includes(x.name));
for(const imp of found){const slot=hooks.length,start=begin();
 let bypass;
 if(imp.name==='SetTextColor'||imp.name==='SetBkColor'||imp.name==='GradientFill'||imp.name==='FillRect'||imp.name==='DrawEdge'||imp.name==='PatBlt'){
  // Display/memory DCs only; preserve printer DC text/background colors.
  byte(0x8b,0x4c,0x24,8,0x52,0x6a,2,0x51,0xff,0x92);u32(imports.find(x=>x.name==='GetDeviceCaps').iat);byte(0x5a,0x83,0xf8,1,0x0f,0x85);bypass=code.length;u32(0);
 }
 if(imp.name==='ShowWindow'||imp.name==='SetWindowPos'){
  if(imp.name==='ShowWindow')nativeTrayRestore=require('./add-tray-restore.cjs').emit({byte,u32,code,imports});
  displayRefs.push(...require('./add-window-display-theme.cjs').emit({byte,u32,code,imports},imp.name));
  if(imp.name==='ShowWindow'&&transientBufferModule){const emitStart=code.length;transientBufferRefs.push(...transientBufferModule.emit({byte,u32,code,imports,patches},slot));transientBufferRange={emitStart,emitEnd:code.length,originalSlot:slot};}
 }else if(imp.name==='RegisterClassA'||imp.name==='RegisterClassW'){
  require('./add-class-background.cjs').emit({byte,u32,code,patches,imports},slot);
 }else if(imp.name==='DeleteObject'){
  // GetSysColorBrush/GetStockObject return borrowed system-like brushes.
  // They must remain valid when the application attempts to delete them.
  const exits=[];byte(0x8b,0x44,0x24,8,0x85,0xc0,0x0f,0x84);exits.push(code.length);u32(0);
  byte(0x83,0xf8,0xff,0x0f,0x84);exits.push(code.length);u32(0);
  byte(0xb9);u32(30);const loop=code.length;
  byte(0x3b,0x84,0x8a);const at=code.length;u32(0);patches.push({at,table:'brushes'});
  byte(0x74,8,0x49,0x79);byte((loop-code.length-1)&255);byte(0xe9);const miss=code.length;u32(0);
  byte(0xb8);u32(1);byte(0x5a,0xc2,4,0);
  for(const at of [...exits,miss]){const delta=code.length-at-4;for(let k=0;k<4;k++)code[at+k]=(delta>>>(k*8))&255;}
 }else if(imp.name==='DrawEdge'){
  edgeRefs.push(...require('./add-native-edge.cjs').emit({byte,u32,code,patches,imports},slot));
 }else if(imp.name==='GetSysColor'||imp.name==='GetSysColorBrush'){
  byte(0x8b,0x44,0x24,8,0x83,0xf8,30,0x77,16,0x8b,0x84,0x82);const at=code.length;u32(0);patches.push({at,table:imp.name==='GetSysColor'?'colors':'brushes'});
  byte(0x83,0xf8,0xff,0x74,4,0x5a,0xc2,4,0);
 }else if(imp.name==='GetStockObject'){
  for(const [stock,idx] of [[0,5],[1,15],[2,16],[3,21]]){
   byte(0x83,0x7c,0x24,8,stock,0x75,10,0x8b,0x82);const at=code.length;u32(0);patches.push({at,brush:idx});byte(0x5a,0xc2,4,0);
  }
 }else if(imp.name==='FillRect'){
  byte(0x8b,0x44,0x24,16,0x48,0x83,0xf8,30,0x77,16,0x8b,0x84,0x82);const at=code.length;u32(0);patches.push({at,table:'brushes'});
  byte(0x83,0xf8,0xff,0x74,4,0x89,0x44,0x24,16);
 }else if(imp.name==='GdipCreateLineBrushFromRect'){
  for(const arg of [12,16]){
   byte(0x8b,0x44,0x24,arg,0x50,0x25);u32(0xffffff);byte(0x0f,0xc8,0xc1,0xe8,8);callMap('background');
   byte(0x0f,0xc8,0xc1,0xe8,8,0x8b,0x0c,0x24,0x81,0xe1);u32(0xff000000);byte(0x09,0xc8,0x83,0xc4,4,0x89,0x44,0x24,arg);
  }
 }else if(imp.name==='GradientFill'){
  // Only the two-vertex UI rectangle gradients; retain coordinates/alpha and caller data.
  const bypasses=[];byte(0x83,0x7c,0x24,16,2,0x0f,0x85);bypasses.push(code.length);u32(0);
  byte(0x83,0x7c,0x24,28,1,0x0f,0x87);bypasses.push(code.length);u32(0);
  byte(0x8b,0x4c,0x24,12,0x83,0xec,32);
  for(let i=0;i<32;i+=4){byte(0x8b,0x41,i,0x89,0x44,0x24,i);}
  for(const v of [0,16]){
   byte(0x0f,0xb6,0x44,0x24,v+9,0x0f,0xb6,0x4c,0x24,v+11,0xc1,0xe1,8,0x09,0xc8,0x0f,0xb6,0x4c,0x24,v+13,0xc1,0xe1,16,0x09,0xc8);callMap('background');
   for(let c=0;c<3;c++){byte(0x88,0x44,0x24,v+8+c*2,0x88,0x44,0x24,v+9+c*2);if(c<2)byte(0xc1,0xe8,8);}
  }
  byte(0x89,0xe0);for(let i=0;i<4;i++)byte(0xff,0x74,0x24,60);byte(0x50,0xff,0x74,0x24,60,0xff,0x92);const at=code.length;u32(0);patches.push({at,slot});
  byte(0x83,0xc4,32,0x5a,0xc2,24,0);
  for(const at of bypasses){const x=Buffer.alloc(4);x.writeInt32LE(code.length-at-4);for(let k=0;k<4;k++)code[at+k]=x[k];}
 }else if(imp.name==='CreatePenIndirect'){
  // VCL stores its cached line colors in LOGPEN; adapt a local copy only.
  byte(0x8b,0x4c,0x24,8,0x83,0xec,16);
  for(let i=0;i<12;i+=4){byte(0x8b,0x41,i,0x89,0x44,0x24,i);}
  byte(0x8b,0x41,12);callMap('pen');byte(0x89,0x44,0x24,12,0x54,0xff,0x92);const at=code.length;u32(0);patches.push({at,slot});
  byte(0x83,0xc4,16,0x5a,0xc2,4,0);
 }else if(imp.name==='CreateBrushIndirect'){
  byte(0x8b,0x4c,0x24,8,0x83,0x39,0,0x0f,0x85);bypass=code.length;u32(0);
  // Copy LOGBRUSH instead of changing caller-owned color data.
  byte(0x83,0xec,12,0x8b,0x01,0x89,0x04,0x24,0x8b,0x41,4);callMap('background');
  byte(0x89,0x44,0x24,4,0x8b,0x41,8,0x89,0x44,0x24,8,0x54,0xff,0x92);const at=code.length;u32(0);patches.push({at,slot});
  byte(0x83,0xc4,12,0x5a,0xc2,4,0);
 }else{
  const arg=imp.name==='CreateSolidBrush'?8:imp.name==='CreatePen'?16:12;
  byte(0x8b,0x44,0x24,arg);
  callMap(imp.name==='SetTextColor'?'text':imp.name==='CreatePen'?'pen':'background');byte(0x89,0x44,0x24,arg);
 }
 if(bypass!==undefined){const x=Buffer.alloc(4);x.writeInt32LE(code.length-(bypass+4));for(let k=0;k<4;k++)code[bypass+k]=x[k];}
 end(slot);hooks.push({...imp,start,slot});
}
const helpers={};for(const kind of ['background','text','pen']){
 helpers[kind]=code.length;
 const labels={},jumps=[];const jump=(op,label)=>{byte(op);jumps.push({at:code.length,label});byte(0);};
 byte(0x51,0x52,0x53,0x56,0x89,0xc3,0x3d);u32(0xffffff);jump(0x77,'fallback');
 byte(0x89,0xc1,0x81,0xe1);u32(255);
 byte(0x89,0xc2,0xc1,0xea,8,0x81,0xe2);u32(255);byte(0x89,0xc6,0xc1,0xee,16,0x81,0xe6);u32(255);
 // EAX=max channel, ECX=min channel; only adapt neutral / lightly tinted colors.
 byte(0x89,0xc8,0x39,0xd0,0x0f,0x42,0xc2,0x39,0xf0,0x0f,0x42,0xc6,0x39,0xd1,0x0f,0x47,0xca,0x39,0xf1,0x0f,0x47,0xce,0x29,0xc8,0x83,0xf8,64);jump(0x77,'fallback');
 if(kind==='background'){
  byte(0x81,0xf9);u32(170);jump(0x73,'dark');byte(0x83,0xf9,100);jump(0x72,'fallback');byte(0xb8);u32(accent);jump(0xeb,'finish');labels.dark=code.length;
 }else if(kind==='text'){byte(0x01,0xc8,0x3d);u32(160);jump(0x77,'fallback');}else{byte(0x83,0xf9,75);jump(0x72,'fallback');}
 byte(0xb8);u32(kind==='text'?text:kind==='pen'?border:bg);jump(0xeb,'finish');labels.fallback=code.length;byte(0x89,0xd8);labels.finish=code.length;byte(0x5e,0x5b,0x5a,0x59,0xc3);
 for(const j of jumps){const displacement=labels[j.label]-j.at-1;if(displacement>127||displacement<0)throw Error('helper jump overflow');code[j.at]=displacement;}
}
const gradientModule=require('./add-native-gradient.cjs');
const nativeGradient=process.env.FOXMAIL_NATIVE_GRADIENT==='0'?null:gradientModule.emit({byte,u32,rva,code,patches,hooks,imports,callMap});
const nativePopup=null;
const initialEraseModule=require(process.env.FOXMAIL_ERASE_DIAGNOSTICS==='1'?'./add-initial-erase-diagnostic.cjs':'./add-initial-erase.cjs');
const nativeInitialErase=initialEraseModule.emit({byte,u32,rva,code,patches,imports});
const paintPhaseModule=process.env.FOXMAIL_PAINT_DIAGNOSTICS==='1'?require('./add-paint-phase-diagnostic.cjs'):null;
const nativePaintPhase=paintPhaseModule?paintPhaseModule.emit({byte,u32,rva,code,imports}):null;
const displayModule=require('./add-window-display-theme.cjs');
const nativeDisplay=displayModule.emitData({byte,u32,code,rva});
const nativeTransientBuffer=transientBufferModule?transientBufferModule.emitData({byte,u32,code,rva}):null;
for(const ref of transientBufferRefs){const value=nativeTransientBuffer[ref.name];if(!Number.isInteger(value))throw Error('Unknown transient buffer reference '+ref.name);for(let k=0;k<4;k++)code[ref.at+k]=(value>>>(8*k))&255;}
for(const ref of displayRefs){const value=nativeDisplay[ref.name];for(let k=0;k<4;k++)code[ref.at+k]=(value>>>(8*k))&255;}
for(const ref of edgeRefs){const value=nativeGradient.dynamicSlots[ref.name];for(let k=0;k<4;k++)code[ref.at+k]=(value>>>(8*k))&255;}
for(const c of helperCalls){const x=Buffer.alloc(4);x.writeInt32LE(helpers[c.kind]-(c.at+4));for(let k=0;k<4;k++)code[c.at+k]=x[k];}
const entry=code.length;byte(0x60);const baseStart=code.length;byte(0xe8,0,0,0,0,0x5b,0x81,0xeb);u32(rva+baseStart+5);
if(nativeGradient)gradientModule.emitInit({byte,u32},nativeGradient);
displayModule.emitInit({byte,u32,imports},nativeDisplay);
if(nativeTransientBuffer)transientBufferModule.emitInit({byte,u32,imports},nativeTransientBuffer);
initialEraseModule.emitInit({byte,u32,imports},nativeInitialErase);
if(nativePaintPhase)paintPhaseModule.emitInit({byte,u32,imports},nativePaintPhase);
// .idata is made writable in the PE header. Cache originals before installing wrappers.
for(const h of hooks){byte(0x8b,0x83);u32(h.iat);byte(0x89,0x83);const at=code.length;u32(0);patches.push({at,slot:h.slot});}
for(const [idx,color]of sys){byte(0x68);u32(color);byte(0xff,0x93);u32(imports.find(x=>x.name==='CreateSolidBrush').iat);byte(0x89,0x83);let at=code.length;u32(0);patches.push({at,brush:idx});}
for(const h of hooks){byte(0x8d,0x83);u32(rva+h.start);byte(0x89,0x83);u32(h.iat);}
byte(0x61);rel32(0xe9,b.readUInt32LE(op+16));
const slots=align(code.length,4);while(code.length<slots+hooks.length*4)byte(0);for(let i=0;i<31;i++)u32(0xffffffff);for(let i=0;i<31;i++)u32(sys.has(i)?sys.get(i):0xffffffff);
if(nativeTransientBuffer)Object.assign(nativeTransientBuffer,{emitStart:transientBufferRange.emitStart,emitEnd:transientBufferRange.emitEnd,originalShowSlotRva:rva+slots+transientBufferRange.originalSlot*4});
for(const v of patches){let value=rva+slots+(v.table==='colors'?hooks.length*4+31*4:v.table==='brushes'?hooks.length*4:v.brush===undefined?v.slot*4:hooks.length*4+v.brush*4);const x=Buffer.alloc(4);x.writeUInt32LE(value);for(let k=0;k<4;k++)code[v.at+k]=x[k];}
if(so+(ns+1)*40>b.readUInt32LE(op+60))throw Error('No section-header space');
const out=Buffer.alloc(raw+align(code.length,512));b.copy(out);Buffer.from(code).copy(out,raw);
if(nativeGradient)gradientModule.patchOriginal(out,p.off,nativeGradient);
initialEraseModule.patchOriginal(out,p.off,nativeInitialErase);
if(nativePaintPhase)paintPhaseModule.patchOriginal(out,p.off,nativePaintPhase);
const editorCanvasPatches=require('./patch-editor-canvas-background.cjs').patchOriginal(out,p.off);
const sh=so+ns*40;out.write('.fxdark',sh,'ascii');out.writeUInt32LE(code.length,sh+8);out.writeUInt32LE(rva,sh+12);out.writeUInt32LE(align(code.length,512),sh+16);out.writeUInt32LE(raw,sh+20);out.writeUInt32LE(0xe0000060,sh+36);
out.writeUInt16LE(ns+1,pe+6);out.writeUInt32LE(rva+entry,op+16);out.writeUInt32LE(align(rva+code.length,4096),op+56);out.writeUInt32LE(0,op+64);
// Appended absolute fields are RVAs with position independent base recovery; ASLR stays unchanged.
for(let i=0;i<ns;i++)if(sections[i].name==='.idata')out.writeUInt32LE((out.readUInt32LE(so+i*40+36)|0x80000000)>>>0,so+i*40+36);
// The original signature does not cover modified bytes. Remove its invalid directory reference.
out.writeUInt32LE(0,op+128);out.writeUInt32LE(0,op+132);
fs.writeFileSync(process.argv[3],out);
fs.writeFileSync(process.argv[3]+'.json',JSON.stringify({source:process.argv[2],sourceSHA256:crypto.createHash('sha256').update(b).digest('hex'),resultSHA256:crypto.createHash('sha256').update(out).digest('hex'),hooks,slots,entry,originalEntryRVA:b.readUInt32LE(op+16),deviceCapsIAT:imports.find(x=>x.name==='GetDeviceCaps').iat,sectionRVA:rva,codeBytes:code.length,nativeGradient,nativePopup,nativeDisplay,nativeTransientBuffer,nativeInitialErase,nativePaintPhase,nativeTrayRestore,editorCanvasPatches},null,2));
console.log('Built process-local dark color adaptation: '+code.length+' bytes; '+hooks.map(x=>x.name).join(', '));
