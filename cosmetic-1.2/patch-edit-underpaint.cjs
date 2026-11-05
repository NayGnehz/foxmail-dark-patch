'use strict';
// FOXMAIL_RETIRED_BASELINE_CLI: preserve patchBuffer exports; do not consume retired old EXE.
if (require.main === module) { throw new Error('Retired historical baseline CLI. See docs/cleanup-report-20261105.md; use the current print/compose entry.'); }
'use strict';
const fs=require('fs'),crypto=require('crypto'),{readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const expanded=require('./patch-expanded-search-underpaint.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const names=['edtEmailProxyServer','edtEmailProxyUserID','edtEmailProxyPort','edtEmailProxyPassword'];
function semantic(o){if(Array.isArray(o))return o.map(semantic);if(o&&typeof o==='object')return Object.fromEntries(Object.entries(o).filter(([k])=>!['offset','end'].includes(k)).map(([k,v])=>[k,semantic(v)]));return o;}
function patchBuffer(input){
 const result=expanded.patchBuffer(input),buffer=result.buffer,changes=result.changes,rs=readResources(buffer).resources.filter(r=>r.type===10&&r.name==='TNETWORKOPTIONFRAME');if(rs.length!==1)throw Error('Network DFM count');const r=rs[0],before=Buffer.from(buffer.subarray(r.offset,r.offset+r.size)),tree=parseDFM(before),edits=[];
 function walk(o,path){path+='.'+o.name;if(names.includes(o.name)){
  if(path!=='.NetworkOptionFrame.grpLine.gbEmailProxy.'+o.name||!['TFMEdit','TFMNumberEdit'].includes(o.className))throw Error('Unexpected control path/class '+path);
  const ps=o.properties.filter(p=>p.name==='transparentColor');if(ps.length!==1||ps[0].type!==7||ps[0].value!=='clNone')throw Error('Network transparentColor guard '+path);const p=ps[0];if(!before.subarray(p.offset,p.end).equals(Buffer.from('0706636c4e6f6e65','hex')))throw Error('Encoded value guard');edits.push({name:o.name,path,offset:p.offset,end:p.end,before:'clNone',after:0x202020});p.type=4;p.value=0x202020;
 }o.children.forEach(c=>walk(c,path));}walk(tree,'');if(edits.length!==4)throw Error('Four network edits required');
 let data=before;const encoded=Buffer.alloc(5);encoded[0]=4;encoded.writeInt32LE(0x202020,1);for(const e of [...edits].sort((a,b)=>b.offset-a.offset))data=Buffer.concat([data.subarray(0,e.offset),encoded,data.subarray(e.end)]);
 if(data.length!==before.length-12)throw Error('DFM shrink invariant');const reparsed=parseDFM(data);if(JSON.stringify(semantic(reparsed))!==JSON.stringify(semantic(tree)))throw Error('Unexpected DFM semantic change');data.copy(buffer,r.offset);buffer.fill(0,r.offset+data.length,r.offset+r.size);buffer.writeUInt32LE(data.length,r.dataEntry+4);
 changes.push({name:'TNETWORKOPTIONFRAME four edit transparentColor underpaint properties',kind:'resource-DFM',offset:r.offset,size:r.size,beforeSize:r.size,afterSize:data.length,edits},{name:'TNETWORKOPTIONFRAME resource size',kind:'resource-size',offset:r.dataEntry+4,size:4,before:r.size,after:data.length});
 for(let p=0;p<input.length;p++)if(input[p]!==buffer[p]&&!changes.some(c=>p>=c.offset&&p<c.offset+c.size))throw Error('Unexpected byte delta '+p);return{buffer,changes};
}
module.exports={patchBuffer};
if(require.main===module){const input=fs.readFileSync('cosmetic-1.1/payload/Foxmail深色.exe');if(sha(input)!=='a94d69a626b2a01b1ae017e5b1e704e325ad8f5331f0ab2be1c97682c2829d12')throw Error('Unsupported baseline');const result=patchBuffer(input),report={baselineSHA256:sha(input),outputSHA256:sha(result.buffer),fileSizeUnchanged:input.length===result.buffer.length,changes:result.changes};fs.writeFileSync('cosmetic-1.2/audit-edit-underpaint.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
