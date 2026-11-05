const fs=require('fs');
const b=fs.readFileSync(process.argv[2]);const pe=b.readUInt32LE(0x3c),op=pe+24,ns=b.readUInt16LE(pe+6),so=op+b.readUInt16LE(pe+20),base=b.readUInt32LE(op+28);
const sections=[];for(let i=0;i<ns;i++){let p=so+i*40;sections.push({name:b.toString('ascii',p,p+8).replace(/\0/g,''),vs:b.readUInt32LE(p+8),rva:b.readUInt32LE(p+12),size:b.readUInt32LE(p+16),raw:b.readUInt32LE(p+20)});}
function off(rva){let s=sections.find(s=>rva>=s.rva&&rva<s.rva+Math.max(s.vs,s.size));return s?s.raw+rva-s.rva:rva;}
function str(p){return b.toString('ascii',p,b.indexOf(0,p));}
const imports=[];let imp=off(b.readUInt32LE(op+104));for(let d=imp;b.readUInt32LE(d+12);d+=20){let dll=str(off(b.readUInt32LE(d+12))),iat=b.readUInt32LE(d+16),t=off(b.readUInt32LE(d)||iat);for(let i=0;b.readUInt32LE(t+4*i);i++){let v=b.readUInt32LE(t+4*i);if(v<0x80000000)imports.push({dll,name:str(off(v)+2),iat:iat+4*i});}}
if(require.main===module)console.log(JSON.stringify({pe,op,so,base,sections,imports:imports.filter(x=>/Color|Brush|Fill|Pen|Theme|Protect/.test(x.name))},null,2));
module.exports={b,pe,op,ns,so,base,sections,off,str,imports};
