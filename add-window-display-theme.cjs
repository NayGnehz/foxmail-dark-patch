'use strict';
// Public dark appearance attributes, applied to top-level windows before showing.
// Leave transition policy at the OS/application default; do not set attribute3.
// Original ShowWindow/SetWindowPos args, return values and error behavior remain.
function emit({byte,u32,code,imports},name){
 const refs=[],labels={},jumps=[];const j=(op,l)=>{byte(...op);jumps.push({at:code.length,l});u32(0);};
 const data=n=>{refs.push({at:code.length,name:n});u32(0);};const api=n=>{const x=imports.find(x=>x.name===n);if(!x)throw Error('Missing '+n);return x.iat;};
 if(name==='ShowWindow'){byte(0x83,0x7c,0x24,12,0);j([0x0f,0x84],'fallback');}
 else{byte(0xf7,0x44,0x24,32);u32(0x40);j([0x0f,0x84],'fallback');}
 byte(0x83,0xba);data('slotRva');byte(0);j([0x0f,0x84],'fallback');
 byte(0x83,0xba);data('busyRva');byte(0);j([0x0f,0x85],'fallback');
 byte(0xc7,0x82);data('busyRva');u32(1);
 byte(0x55,0x8b,0xec,0x83,0xec,12,0x53,0x89,0xd3,0xff,0x93);u32(api('GetLastError'));byte(0x89,0x45,0xfc);
 byte(0x6a,0xf0,0xff,0x75,12,0xff,0x93);u32(api(imports.some(x=>x.name==='GetWindowLongW')?'GetWindowLongW':'GetWindowLongA'));
 byte(0xa9);u32(0x40000000);j([0x0f,0x85],'cleanup');
 byte(0xc7,0x45,0xf8);u32(1);byte(0xc7,0x45,0xf4);u32(0xfffffffe);
 for(const [attr,local]of[[20,-8],[34,-12]]){byte(0x6a,4,0x8d,0x45,local&255,0x50,0x6a,attr,0xff,0x75,12,0xff,0x93);data('slotRva');}
 labels.cleanup=code.length;byte(0xc7,0x83);data('busyRva');u32(0);byte(0xff,0x75,0xfc,0xff,0x93);u32(api('SetLastError'));
 byte(0x89,0xda,0x5b,0x8b,0xe5,0x5d);labels.fallback=code.length;
 for(const x of jumps){const d=labels[x.l]-x.at-4;for(let k=0;k<4;k++)code[x.at+k]=(d>>>(8*k))&255;}
 return refs;
}
function emitData({byte,u32,code,rva}){
 while(code.length%4)byte(0);const slotRva=rva+code.length;u32(0);const busyRva=rva+code.length;u32(0);
 const dllNameRva=rva+code.length;byte(...Buffer.from('dwmapi.dll\0','utf16le'));const nameRva=rva+code.length;byte(...Buffer.from('DwmSetWindowAttribute\0','ascii'));
 return{slotRva,busyRva,dllNameRva,nameRva,transitionPolicy:'system-default-no-attribute3-write',attributes:{immersiveDarkMode:20,borderColor:34,borderColorNone:0xfffffffe}};
}
function emitInit({byte,u32,imports},m){
 const api=n=>imports.find(x=>x.name===n).iat;
 byte(0x68);u32(0x800);byte(0x6a,0,0x8d,0x83);u32(m.dllNameRva);byte(0x50,0xff,0x93);u32(api('LoadLibraryExW'));
 byte(0x8d,0x8b);u32(m.nameRva);byte(0x51,0x50,0xff,0x93);u32(api('GetProcAddress'));byte(0x89,0x83);u32(m.slotRva);
}
module.exports={emit,emitData,emitInit};
