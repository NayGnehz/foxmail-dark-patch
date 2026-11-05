'use strict';
// Isolated experiment. It bounds WS_EX_COMPOSITED to a hidden main-window ShowWindow call.
// Synchronous painting does not guarantee DWM has presented every surface.
const COMPOSITED=0x02000000;
function emit({byte,u32,code,imports,patches},slot){
 const refs=[],labels={},jumps=[];
 const mark=n=>labels[n]=code.length;
 const j=(op,n)=>{byte(...op);jumps.push({at:code.length,n});u32(0);};
 const data=n=>{refs.push({at:code.length,name:n});u32(0);};
 const api=n=>{let x=imports.find(x=>x.name===n);if(!x)throw Error('Missing '+n);return x.iat;};
 const call=n=>{byte(0xff,0x93);u32(api(n));};
 const get=imports.some(x=>x.name==='GetWindowLongW')?'GetWindowLongW':'GetWindowLongA';
 const set=imports.some(x=>x.name==='SetWindowLongW')?'SetWindowLongW':'SetWindowLongA';
 const hwnd=()=>byte(0xff,0x75,12);
 const getex=()=>{byte(0x6a,0xec);hwnd();call(get);};
 const original=()=>{byte(0xff,0x75,16);hwnd();byte(0xff,0x93);patches.push({at:code.length,slot});u32(0);};
 // No API on the reentrant path; the existing tail jump retains its exact semantics.
 byte(0x83,0xba);data('busyRva');byte(0);j([0x0f,0x85],'fallback');
 byte(0x83,0xba);data('slotRva');byte(0);j([0x0f,0x84],'fallback');
 byte(0x55,0x8b,0xec,0x81,0xec);u32(160);byte(0x53,0x56,0x57,0x89,0xd3);
 call('GetLastError');byte(0x89,0x45,0xfc);
 byte(0xb8);u32(1);byte(0x87,0x83);data('busyRva');byte(0x85,0xc0);j([0x0f,0x85],'raceFallback');
 byte(0xc7,0x45,0xec);u32(0); // owned
 for(const cmd of [1,3,4,5,9]){byte(0x83,0x7d,16,cmd);j([0x0f,0x84],'commandOK');}j([0xe9],'releaseFallback');
 mark('commandOK');hwnd();call('IsWindow');byte(0x85,0xc0);j([0x0f,0x84],'releaseFallback');
 hwnd();call('IsWindowVisible');byte(0x85,0xc0);j([0x0f,0x85],'releaseFallback');
 byte(0x6a,0xf0);hwnd();call(get);byte(0xa9);u32(0x40000000);j([0x0f,0x85],'releaseFallback');
 getex();byte(0x89,0x45,0xf0,0xa9);u32(COMPOSITED|0x80000|0x200000);j([0x0f,0x85],'releaseFallback');
 // Exact ASCII class name; length match and terminator are both checked.
 byte(0x68);u32(128);byte(0x8d,0x85);u32(-160);byte(0x50);hwnd();call('GetClassNameA');
 const name=Buffer.from('TFoxMainFrm.UnicodeClass\0','ascii');byte(0x83,0xf8,name.length-1);j([0x0f,0x85],'releaseFallback');
 for(let i=0;i<name.length;i++){byte(0x80,0xbd);u32(-160+i);byte(name[i]);j([0x0f,0x85],'releaseFallback');}
 byte(0x6a,0xe6);hwnd();byte(0xff,0x93);data('slotRva');byte(0xa9);u32(0xe0);j([0x0f,0x85],'releaseFallback');
 byte(0x6a,0);call('SetLastError');byte(0x8b,0x45,0xf0,0x0d);u32(COMPOSITED);byte(0x50,0x6a,0xec);hwnd();call(set);
 // Zero previous style is valid; success is established by GetLastError and readback.
 call('GetLastError');byte(0x89,0x45,0xe8);getex();byte(0xa9);u32(COMPOSITED);j([0x0f,0x84],'invoke');byte(0xc7,0x45,0xec);u32(1);
 mark('invoke');byte(0xff,0x75,0xfc);call('SetLastError');original();byte(0x89,0x45,0xf8);call('GetLastError');byte(0x89,0x45,0xf4);
 byte(0x83,0x7d,0xec,0);j([0x0f,0x84],'finish');
 byte(0x83,0x7d,0xe8,0);j([0x0f,0x85],'restore');
 hwnd();call('IsWindow');byte(0x85,0xc0);j([0x0f,0x84],'finish');hwnd();call('IsWindowVisible');byte(0x85,0xc0);j([0x0f,0x84],'restore');
 byte(0x68);u32(0x181);byte(0x6a,0,0x6a,0);hwnd();call('RedrawWindow');
 mark('restore');byte(0xbe);u32(2);
 mark('restoreAttempt');hwnd();call('IsWindow');byte(0x85,0xc0);j([0x0f,0x84],'finish');getex();byte(0xa9);u32(COMPOSITED);j([0x0f,0x84],'finish');
 byte(0x25);u32(~COMPOSITED);byte(0x50,0x6a,0xec);hwnd();call(set);getex();byte(0xa9);u32(COMPOSITED);j([0x0f,0x84],'finish');byte(0x4e);j([0x0f,0x85],'restoreAttempt');
 byte(0xff,0x83);data('restoreFailuresRva');
 mark('finish');byte(0xc7,0x83);data('busyRva');u32(0);byte(0xff,0x75,0xf4);call('SetLastError');byte(0x8b,0x45,0xf8,0x89,0xda,0x5f,0x5e,0x5b,0x8b,0xe5,0x5d,0x5a,0xc2,8,0);
 mark('releaseFallback');byte(0xc7,0x83);data('busyRva');u32(0);
 mark('raceFallback');byte(0xff,0x75,0xfc);call('SetLastError');byte(0x89,0xda,0x5f,0x5e,0x5b,0x8b,0xe5,0x5d);
 mark('fallback');for(const x of jumps){const d=labels[x.n]-x.at-4;for(let k=0;k<4;k++)code[x.at+k]=(d>>>(8*k))&255;}return refs;
}
function emitData({byte,u32,code,rva}){
 while(code.length%4)byte(0);const m={};for(const n of ['slotRva','busyRva','restoreFailuresRva']){m[n]=rva+code.length;u32(0);}
 m.dllNameRva=rva+code.length;byte(...Buffer.from('user32.dll\0'));m.nameRva=rva+code.length;byte(...Buffer.from('GetClassLongA\0'));
 return {...m,experimental:true,mainClass:'TFoxMainFrm.UnicodeClass',commands:[1,3,4,5,9],redrawFlags:0x181,restoreAttempts:2};
}
function emitInit({byte,u32,imports},m){
 const api=n=>{const x=imports.find(x=>x.name===n);if(!x)throw Error('Missing '+n);return x.iat;};
 byte(0x8d,0x83);u32(m.dllNameRva);byte(0x50,0xff,0x93);u32(api('GetModuleHandleA'));
 byte(0x8d,0x8b);u32(m.nameRva);byte(0x51,0x50,0xff,0x93);u32(api('GetProcAddress'));byte(0x89,0x83);u32(m.slotRva);
}
module.exports={emit,emitData,emitInit};
