'use strict';
// Scoped static cosmetic layer for Foxmail 7.2.25.563; no hooks or branch changes.
const {readResources}=require('../pe-resource-utils.cjs');
const {pngDecode,pngEncode}=require('../recolor-search-scrollbars.cjs');
const selected=/^CONTROLS_FMCAPSULEBUTTON_(CAPSULE_BUTTON2?|ROUND_BUTTON2?)(_2X)?_PNG$/;
const literals=[
 {va:0xa2cd81,opcode:0xba,before:0xd0c7be,after:0x3d3d3d,name:'shared dialog bottom separator pen'},
 {va:0xc12ca5,opcode:0x68,before:0xd0c5b9,after:0x3d3d3d,name:'TFMBevel first line pen'},
 {va:0xc12ced,opcode:0x68,before:0xffffff,after:0x282828,name:'TFMBevel second line pen'}
];
function patchBuffer(input){
 const out=Buffer.from(input),r=readResources(out),changes=[];
 const pe=out.readUInt32LE(60),op=pe+24,so=op+out.readUInt16LE(pe+20),base=out.readUInt32LE(op+28);
 if(base!==0x400000||out.readUInt16LE(op)!==0x10b)throw Error('Unexpected executable architecture');
 const sections=Array.from({length:out.readUInt16LE(pe+6)},(_,i)=>{const p=so+i*40;return{name:out.toString('ascii',p,p+8).replace(/\0/g,''),rva:out.readUInt32LE(p+12),raw:out.readUInt32LE(p+20),size:out.readUInt32LE(p+16)};});
 const off=va=>{const s=sections.find(s=>va-base>=s.rva&&va-base+5<=s.rva+s.size);if(!s)throw Error('Unmapped VA');return s.raw+va-base-s.rva;};
 // Check exact route bytes before touching immediate palette operands.
 for(const [va,hex]of [[0xdcd97c,'558bec83c4f4'],[0xdcd991,'e866f3c5ff'],[0xa2cd86,'e8dd9bc2ff'],[0xc12bcf,'e8943da4ff'],[0xc12cb3,'e8d0feffff'],[0xc12cfb,'e888feffff']]){const p=off(va);if(!out.subarray(p,p+hex.length/2).equals(Buffer.from(hex,'hex')))throw Error('Route guard mismatch '+va.toString(16));}
 for(const e of literals){const p=off(e.va);if(out[p]!==e.opcode||![e.before,e.after].includes(out.readUInt32LE(p+1)))throw Error('Literal mismatch '+e.name);out.writeUInt32LE(e.after,p+1);changes.push({...e,offset:p+1});}
 const resources=r.resources.filter(x=>x.type===10&&selected.test(x.name));if(resources.length!==8)throw Error('Expected exactly eight capsule sprites');
 // Each sprite packs two states horizontally: BUTTON selected|normal, BUTTON2 normal|selected.
 for(const res of resources){const im=pngDecode(out.subarray(res.offset,res.offset+res.size)),oldPixels=Buffer.from(im.rgba);let count=0;for(let p=0;p<im.rgba.length;p+=4){if(!im.rgba[p+3])continue;const rgb=[...im.rgba.subarray(p,p+3)],lo=Math.min(...rgb),hi=Math.max(...rgb);if(lo<100||hi-lo>80)continue;const lum=(rgb[0]+rgb[1]+rgb[2])/3,x=(p/4)%im.width,second=/BUTTON2(?:_2X)?_PNG$/.test(res.name),selectedHalf=second?x>=im.width/2:x<im.width/2;const fill=selectedHalf&&lum>=140?[51,72,90]:!selectedHalf&&lum>=190?[40,40,40]:[61,61,61];for(let c=0;c<3;c++)im.rgba[p+c]=fill[c];count++;}const encoded=pngEncode(im);if(encoded.length>res.size)throw Error('Sprite exceeds allocation '+res.name);const check=pngDecode(encoded);if(!check.rgba.equals(im.rgba))throw Error('PNG roundtrip failed');for(let p=3;p<im.rgba.length;p+=4)if(im.rgba[p]!==oldPixels[p])throw Error('Alpha changed');encoded.copy(out,res.offset);out.fill(0,res.offset+encoded.length,res.offset+res.size);out.writeUInt32LE(encoded.length,res.dataEntry+4);changes.push({name:res.name,offset:res.offset,width:im.width,height:im.height,pixelsChanged:count,beforeSize:res.size,afterSize:encoded.length});}
 // Only three immediate operands in original code and eight resource allocations/data sizes may differ.
 const allowed=changes.filter(x=>x.va).map(x=>[x.offset,x.offset+4]);for(const res of resources)allowed.push([res.offset,res.offset+res.size],[res.dataEntry+4,res.dataEntry+8]);for(let p=0;p<out.length;p++)if(out[p]!==input[p]&&!allowed.some(([a,b])=>p>=a&&p<b))throw Error('Unexpected byte delta '+p.toString(16));
 return {buffer:out,changes};
}
module.exports={patchBuffer,literals};
