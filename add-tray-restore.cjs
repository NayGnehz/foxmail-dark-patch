'use strict';
// Used inside the existing ShowWindow IAT wrapper after begin(): EDX=image
// base, saved EDX at ESP, caller return at ESP+4, HWND at +8, command at +12.
// Only the observed main-window tray restoration call is eligible.
const SOURCE_RETURN_RVA=0xBDFEEB;
function emit({byte,u32,code,imports}){
 const start=code.length,fix=[];
 const jump=()=>{byte(0x0f,0x85);fix.push(code.length);u32(0);};
 const api=name=>{const i=imports.find(x=>x.name===name);if(!i)throw Error('Missing tray restore dependency '+name);return i.iat;};
 byte(0x83,0x7c,0x24,12,5);jump();
 byte(0x8b,0x44,0x24,4,0x29,0xd0,0x3d);u32(SOURCE_RETURN_RVA);jump();
 byte(0x53,0x89,0xd3,0xff,0x93);u32(api('GetLastError'));byte(0x50);
 byte(0xff,0x74,0x24,16,0xff,0x93);u32(api('IsIconic'));
 byte(0x85,0xc0,0x74,8,0xc7,0x44,0x24,20);u32(9);
 byte(0xff,0x93); // Pop the saved error into the stdcall argument in place.
 u32(api('SetLastError'));
 byte(0x89,0xda,0x5b);
 const end=code.length;for(const at of fix){const delta=end-at-4;for(let k=0;k<4;k++)code[at+k]=(delta>>>(8*k))&255;}
 return{start,size:end-start,sourceReturnRva:SOURCE_RETURN_RVA,expectedCommand:5,restoredCommand:9};
}
module.exports={emit};
