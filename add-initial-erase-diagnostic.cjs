'use strict';
// Narrow prefill for observed custom controls which report erasure handled
// without touching the HDC. Continue the complete original handler afterwards.
const SITES=[
 {name:'virtualDrawTree',originalRva:0x58712c,expectedHex:'558bec83c4f8',vmtRvas:[0x56fa20]},
 {name:'settingsButtons',originalRva:0x2a7a7c,expectedHex:'53568bf28bd8',vmtRvas:[0x692008,0x690898]},
 // TXPanel's custom erase can draw borders only and acknowledge the message.
 {name:'customPanels',originalRva:0x61eb20,expectedHex:'558bec83c4f8',vmtRvas:[0x61db24]},
 // TTabForm skips erasure when its internal list is populated. Limit the
 // prefill to the observed settings form, leaving other TTabForm subclasses.
 {name:'optionForm',originalRva:0x6163f8,expectedHex:'558bec83c4f8',vmtRvas:[0x9cd254]}
];
function emit({byte,u32,rva,code,patches,imports}){
 const api=name=>{const a=imports.find(x=>x.name===name);if(!a)throw Error('Missing erase dependency '+name);return a.iat;};
 const dynamicFix=[],sites=[];
 const trace=require('./erase-diagnostic-buffer.cjs').create({byte,u32,rva,code},SITES.length);
 for(const site of SITES){
  const siteId=sites.length,start=code.length,labels={},jumps=[];
  const j=(op,label)=>{byte(...op);jumps.push({at:code.length,label});u32(0);};
  const direct=name=>{byte(0xff,0x93);u32(api(name));};
  const dynamic=name=>{byte(0x8b,0x83);dynamicFix.push({at:code.length,name});u32(0);byte(0xff,0xd0);};
  // Originals EAX/EDX/ECX at -4/-8/-12; saved error -16; HDC -20;
  // RECT -36..-21; BITMAP -60..-37. Only this helper owns these locals.
  byte(0x55,0x8b,0xec,0x81,0xec,128,0,0,0,0x53,0x56,0x57,0x89,0x45,0xfc,0x89,0x55,0xf8,0x89,0x4d,0xf4);
  byte(0xe8,0,0,0,0);const after=code.length;byte(0x5b,0x81,0xeb);u32(rva+after);
  trace.init(siteId);byte(0xc7,0x45,0xc0,0,0,0,0);byte(0x85,0xc0);trace.reason(1);j([0x0f,0x84],'restore');byte(0x8b,0x08,0x29,0xd9);trace.store(2,'ecx');byte(0x85,0xd2);trace.reason(2);j([0x0f,0x84],'restore');byte(0x8b,0x0a);trace.store(15,'ecx');
  byte(0x83,0x3a,0x14);trace.reason(3);j([0x0f,0x85],'restore');byte(0x8b,0x00,0x29,0xd8);
  for(const v of site.vmtRvas){byte(0x3d);u32(v);j([0x0f,0x84],'matched');}
  if(site.name==='optionForm'){byte(0x3d);u32(0xbdc9b0);j([0x0f,0x85],'unmatched');byte(0xc7,0x45,0xc0,1,0,0,0);j([0xe9],'matched');}
  labels.unmatched=code.length;trace.reason(4);j([0xe9],'restore');
  labels.matched=code.length;byte(0x8b,0x42,4);trace.store(14);byte(0x85,0xc0);trace.reason(5);j([0x0f,0x84],'restore');byte(0x89,0x45,0xec);
  direct('GetLastError');byte(0x89,0x45,0xf0);
  byte(0x6a,2,0xff,0x75,0xec);direct('GetDeviceCaps');trace.store(5);trace.reason(6);byte(0x83,0xf8,1);j([0x0f,0x85],'cleanup');
  // Dynamic resolver slots must exist before pushing stdcall args.
  for(const name of ['GetObjectType','GetROP2','GetGraphicsMode','GetLayout']){
   byte(0x83,0xbb);dynamicFix.push({at:code.length,name});u32(0);byte(0);trace.reason(7);j([0x0f,0x84],'cleanup');
  }
  byte(0xff,0x75,0xec);dynamic('GetObjectType');trace.store(6);trace.reason(8);byte(0x83,0xf8,3);j([0x0f,0x84],'screenDC');byte(0x83,0xf8,10);j([0x0f,0x85],'cleanup');
  byte(0x6a,7,0xff,0x75,0xec);direct('GetCurrentObject');trace.reason(9);byte(0x85,0xc0);j([0x0f,0x84],'cleanup');
  byte(0x8d,0x55,0xc4,0x52,0x6a,24,0x50);direct('GetObjectA');trace.reason(10);byte(0x83,0xf8,24);j([0x0f,0x85],'cleanup');
  byte(0x0f,0xb7,0x45,0xd4,0x0f,0xb7,0x55,0xd6,0x0f,0xaf,0xc2);trace.store(7);trace.reason(11);byte(0x83,0xf8,8);j([0x0f,0x86],'cleanup');j([0xe9],'state');
  labels.screenDC=code.length;byte(0x6a,12,0xff,0x75,0xec);direct('GetDeviceCaps');trace.store(7);trace.reason(11);byte(0x83,0xf8,8);j([0x0f,0x86],'cleanup');
  labels.state=code.length;byte(0xff,0x75,0xec);direct('GetMapMode');trace.store(8);trace.reason(12);byte(0x83,0xf8,1);j([0x0f,0x85],'cleanup');
  for(const [name,value]of[['GetROP2',13],['GetGraphicsMode',1],['GetLayout',0]]){byte(0xff,0x75,0xec);dynamic(name);trace.store({GetROP2:9,GetGraphicsMode:10,GetLayout:11}[name]);trace.reason({GetROP2:13,GetGraphicsMode:14,GetLayout:15}[name]);byte(0x83,0xf8,value);j([0x0f,0x85],'cleanup');}
  byte(0x8d,0x45,0xdc,0x50,0xff,0x75,0xec);direct('GetClipBox');trace.store(12);trace.reason(16);byte(0x83,0xf8,2);j([0x0f,0x8c],'cleanup');
  if(site.name==='optionForm'){byte(0x83,0x7d,0xc0,0);j([0x0f,0x84],'fill');trace.reason(20);j([0xe9],'cleanup');labels.fill=code.length;}
  trace.reason(17);
  byte(0x8b,0x83);const brushAt=code.length;u32(0);patches.push({at:brushAt,brush:5});byte(0x85,0xc0);j([0x0f,0x84],'cleanup');byte(0x83,0xf8,0xff);j([0x0f,0x84],'cleanup');
  byte(0x50,0x8d,0x45,0xdc,0x50,0xff,0x75,0xec);direct('FillRect');trace.store(13);trace.reason(18);byte(0x85,0xc0);j([0x0f,0x84],'cleanup');trace.reason(19);
  labels.cleanup=code.length;byte(0xff,0x75,0xf0);direct('SetLastError');
  labels.restore=code.length;trace.record(siteId);byte(0x8b,0x45,0xfc,0x8b,0x55,0xf8,0x8b,0x4d,0xf4,0x5f,0x5e,0x5b,0x8b,0xe5,0x5d);
  byte(...Buffer.from(site.expectedHex,'hex'),0xe9);u32(site.originalRva+6-(rva+code.length+4));
  for(const q of jumps){const delta=labels[q.label]-q.at-4;for(let i=0;i<4;i++)code[q.at+i]=(delta>>>(i*8))&255;}
  sites.push({...site,start,entryRva:rva+start,size:code.length-start});
 }
 const dynamicSlots={},dynamicNames={};
 for(const name of ['GetObjectType','GetROP2','GetGraphicsMode','GetLayout']){while(code.length%4)byte(0);dynamicSlots[name]=rva+code.length;u32(0);dynamicNames[name]=rva+code.length;byte(...Buffer.from(name+'\0','ascii'));}
 const gdiNameRva=rva+code.length;byte(...Buffer.from('gdi32.dll\0','ascii'));
 for(const x of dynamicFix){const v=dynamicSlots[x.name];for(let i=0;i<4;i++)code[x.at+i]=(v>>>(8*i))&255;}
 const diagnostics=trace.finish();
 return{sites,dynamicSlots,dynamicNames,gdiNameRva,diagnostics};
}
function emitInit({byte,u32,imports},meta){
 const api=name=>imports.find(x=>x.name===name).iat;
 byte(0x8d,0x83);u32(meta.gdiNameRva);byte(0x50,0xff,0x93);u32(api('GetModuleHandleA'));byte(0x89,0xc6);
 for(const name of Object.keys(meta.dynamicSlots)){byte(0x8d,0x83);u32(meta.dynamicNames[name]);byte(0x50,0x56,0xff,0x93);u32(api('GetProcAddress'));byte(0x89,0x83);u32(meta.dynamicSlots[name]);}
}
function patchOriginal(out,offset,metadata){
 for(const site of metadata.sites){const at=offset(site.originalRva),expect=Buffer.from(site.expectedHex,'hex');if(!out.subarray(at,at+6).equals(expect))throw Error('Initial erase prologue mismatch: '+site.name);out[at]=0xe9;out.writeInt32LE(site.entryRva-site.originalRva-5,at+1);out[at+5]=0x90;}
}
module.exports={emit,emitInit,patchOriginal};
