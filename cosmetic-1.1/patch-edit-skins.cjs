'use strict';
const fs=require('fs'),crypto=require('crypto');
const skin=require('./patch-edit-input-skins.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fileOffset(b,va){const pe=b.readUInt32LE(60),op=pe+24,base=b.readUInt32LE(op+28),so=op+b.readUInt16LE(pe+20),count=b.readUInt16LE(pe+6);for(let i=0;i<count;i++){const s=so+40*i,r=b.readUInt32LE(s+12),raw=b.readUInt32LE(s+20),size=b.readUInt32LE(s+16);if(va>=base+r&&va<base+r+size)return raw+va-base-r;}throw Error('VA outside file');}
function patchBuffer(input){
 const result=skin.patchBuffer(input),out=result.buffer;
 const guard=Buffer.from('baffffff008b45fc8b8038030000e806171700595dc3','hex'),va=0xfb9173,o=fileOffset(out,va);if(!out.subarray(o,o+guard.length).equals(guard))throw Error('Search layout SetColor guard mismatch');
 out.writeUInt32LE(0x202020,o+1);
 const changes=[];
 for(const c of result.report.changes){changes.push({...c,size:c.oldSize,kind:'resource-PNG'});}
 // Include resource size fields separately for exact allowed-byte-range auditing.
 const {readResources}=require('../pe-resource-utils.cjs');for(const r of readResources(input).resources.filter(x=>result.report.changes.some(c=>c.name===x.name))){changes.push({name:r.name+' resource size',kind:'resource-size',offset:r.dataEntry+4,size:4,before:input.readUInt32LE(r.dataEntry+4),after:out.readUInt32LE(r.dataEntry+4)});}
 changes.push({name:'TMailAppFrame search-layout edtSearch.Color clWhite override',kind:'exact-color-literal',offset:o+1,size:4,va:'0xFB9174',instructionVA:'0xFB9173',before:0xffffff,after:0x202020,guardHex:guard.toString('hex'),targetField:'TMailAppFrame.edtSearch +0x338',setterVA:'0x112A88C'});
 for(let i=0;i<input.length;i++)if(input[i]!==out[i]&&!changes.some(c=>i>=c.offset&&i<c.offset+c.size))throw Error('Out-of-scope byte '+i);
 return{buffer:out,changes};
}
module.exports={patchBuffer};
if(require.main===module){const b=fs.readFileSync(process.argv[2]||'reveal-gate-v2/Foxmail-dark-reveal.exe');if(sha(b)!=='31dee04abb894b72de7cf56292cd2121e9d5ce56816a623f1ee797787cf6f624')throw Error('Unsupported baseline');const r=patchBuffer(b),report={inputSHA256:sha(b),outputSHA256:sha(r.buffer),fileSizeUnchanged:b.length===r.buffer.length,changes:r.changes};fs.writeFileSync('cosmetic-1.1/audit-edit-skins-and-search-fill.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
