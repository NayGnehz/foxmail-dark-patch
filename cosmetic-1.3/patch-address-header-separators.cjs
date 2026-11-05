'use strict';
// Exact TAddrMemberListLoader.OnAdvancedHeaderDraw static separator operands only.
const patches=[{va:0xbdce62,before:0xd2cbc8,after:0x3d3d3d,name:'address member header bottom separator'},{va:0xbdced2,before:0xc9c4bf,after:0x3d3d3d,name:'address member header column divider'}];
function patchBuffer(input){
 const out=Buffer.from(input),pe=out.readUInt32LE(60),op=pe+24,base=out.readUInt32LE(op+28),so=op+out.readUInt16LE(pe+20);if(base!==0x400000||out.readUInt16LE(op)!==0x10b)throw Error('Unexpected executable architecture');
 function off(va,n=5){for(let i=0;i<out.readUInt16LE(pe+6);i++){const p=so+40*i,r=out.readUInt32LE(p+12),s=out.readUInt32LE(p+16);if(va-base>=r&&va-base+n<=r+s)return out.readUInt32LE(p+20)+va-base-r;}throw Error('Unmapped VA');}
 const guards=[[0xbdb1fc,'48b2bd00'],[0xbdba68,'c782e00500009ccdbd00'],[0xbdbca2,'c780e00500009ccdbd00'],[0xbdcd9c,'558bec83c4d0'],[0xbdce67,'e8fc9aa7ff'],[0xbdce7e,'e825a8a7ff'],[0xbdce95,'e892a7a7ff'],[0xbdced7,'e88c9aa7ff'],[0xbdcef1,'e8b2a7a7ff'],[0xbdcf0b,'e81ca7a7ff']];
 for(const [va,hex]of guards){const bytes=Buffer.from(hex,'hex'),p=off(va,bytes.length);if(!out.subarray(p,p+bytes.length).equals(bytes))throw Error('Header callback route guard mismatch at'+va.toString(16));}
 const changes=patches.map(e=>{const p=off(e.va);if(out[p]!==0xba||out.readUInt32LE(p+1)!==e.before)throw Error('Header pen operand guard mismatch');return{...e,offset:p+1};});for(const e of changes)out.writeUInt32LE(e.after,e.offset);
 for(let i=0;i<out.length;i++)if(out[i]!==input[i]&&!changes.some(e=>i>=e.offset&&i<e.offset+4))throw Error('Delta outside two color operands');return{buffer:out,changes};
}
module.exports={patchBuffer,patches};
