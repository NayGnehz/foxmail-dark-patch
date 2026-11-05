'use strict';
// Foxmail 7.2.25.563 x86. Select the existing classic group-box renderer
// locally; its system-color brushes are already adapted by the dark palette.
// No global theme flags, control sizing, call targets, or stack changes.
const fs=require('fs'),crypto=require('crypto');
const patches=[
 {va:0x6a3bbd,name:'TCustomGroupBox.Paint',before:'84c00f847c010000',after:'30c00f847c010000',destination:0x6a3d41},
 {va:0x87adfe,name:'TTntGroupBox.Paint',before:'84c07409',after:'30c07409',destination:0x87ae0b},
 {va:0x8b5964,name:'TTBPopupWindow border',before:'752b680f2000006a05',after:'eb2b680f2000006a05',destination:0x8b5991}
];
const guards=[
 [0x6a3bb3,'e8e898ffffe80f9affff'], // ThemeServices.ThemesEnabled calls
 [0x6a3d41,'ba383f6a008bc7'],       // Classic label measurement path
 [0x6a3d7c,'ba140000ff'],[0x6a3da0,'ba100000ff'],[0x6a3daf,'ba060000ff'],
 [0x87adf4,'e8a726e2ffe8ce27e2ff'],
 [0x87ae0b,'55e84ffdffff59'],       // Existing nested classic paint routine
 [0x87abf0,'ba140000ff'],[0x87ac18,'ba100000ff'],[0x87ac2a,'ba060000ff'],
 [0x8b592c,'558bec83c4e0'],[0x8a98df,'545442506f70757057696e646f77'],[0x8b5975,'e86630b5ff']
];
function applyGroupBoxBorders(input,reverse=false){
 const b=Buffer.from(input),pe=b.readUInt32LE(60),op=pe+24,so=op+b.readUInt16LE(pe+20);
 if(b.readUInt16LE(0)!==0x5a4d||b.readUInt16LE(op)!==0x10b||b.readUInt32LE(op+28)!==0x400000)throw Error('Unexpected PE');
 const sections=Array.from({length:b.readUInt16LE(pe+6)},(_,i)=>{const p=so+i*40;return {r:b.readUInt32LE(p+12),f:b.readUInt32LE(p+20),s:b.readUInt32LE(p+16)};});
 const off=(va,n=1)=>{const r=va-0x400000,s=sections.find(s=>r>=s.r&&r+n<=s.r+s.s);if(!s)throw Error('Unmapped patch address');return s.f+r-s.r;};
 for(const [va,hex]of guards){const expected=Buffer.from(hex,'hex');if(!b.subarray(off(va,expected.length),off(va)+expected.length).equals(expected))throw Error('Groupbox context mismatch at '+va.toString(16));}
 const pending=[];
 for(const p of patches){const before=Buffer.from(reverse?p.after:p.before,'hex'),after=Buffer.from(reverse?p.before:p.after,'hex'),at=off(p.va,before.length),current=b.subarray(at,at+before.length);if(!current.equals(before)&&!current.equals(after))throw Error('Groupbox branch mismatch '+p.name);if(!current.equals(after))pending.push({at,p,after});}
 for(const x of pending)x.after.copy(b,x.at);
 return {buffer:b,changed:pending.map(x=>({name:x.p.name,rva:x.p.va-0x400000,va:x.p.va,destination:x.p.destination})),patches};
}
module.exports={applyGroupBoxBorders,patches};
if(require.main===module){const [source,dest,mode]=process.argv.slice(2);if(!source||!dest||source===dest)throw Error('Supply distinct source/dest');const before=fs.readFileSync(source),result=applyGroupBoxBorders(before,mode==='--reverse');fs.writeFileSync(dest,result.buffer);const hash=b=>crypto.createHash('sha256').update(b).digest('hex');const report={source,dest,reverse:mode==='--reverse',sourceSHA256:hash(before),resultSHA256:hash(result.buffer),changed:result.changed,description:'Local group-box classic paint path; existing system palette; no global theme changes'};fs.writeFileSync(dest+'.groupbox-borders.json',JSON.stringify(report,null,2));console.log(JSON.stringify({changed:result.changed.length,dest}));}
