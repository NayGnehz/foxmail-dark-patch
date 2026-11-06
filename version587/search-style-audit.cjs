'use strict';
// Search software asset inventory and supplied-reference dimensions only.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs'),{pngDecode}=require('../recolor-search-scrollbars.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),stage=paths.output('version587-search-style');
const current=fs.readFileSync(path.join(paths.output('version587-group-border-rgba'),'Foxmail深色.exe'));assert.equal(sha(current),'233e7bdfb5f0d3e688a46b7e9eccbed3572795b5312e7d5c810ad4a8b1b387c6');
const original=fs.readFileSync('D:/Users/Public/Downloads/Foxmail/Foxmail.exe');assert.equal(sha(original),'f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399');
const rows=[];
for(const [version,b]of [['original',original],['current',current]])for(const r of readResources(b).resources.filter(r=>r.type===10&&/^(?:MAIN_SEARCH_(?:SEARCH_LEFT_BTN|ADVANCE_SEARCH_BTN)(?:_2X)?|COMMON_SEARCH_SEARCH_PANEL(?:_ACTIVE)?(?:_2X)?)_PNG$/.test(r.name))){
 const raw=b.subarray(r.offset,r.offset+r.size),im=pngDecode(raw),dest=path.join(stage,version+'-'+r.name+'.png');fs.writeFileSync(dest,raw);
 const colors=new Map();for(let i=0;i<im.rgba.length;i+=4){if(!im.rgba[i+3])continue;const key=[...im.rgba.subarray(i,i+4)].join(',');colors.set(key,(colors.get(key)||0)+1);}
 rows.push({version,name:r.name,offset:r.offset,size:r.size,width:im.width,height:im.height,colorType:raw[25],sha256:sha(raw),pixelSHA256:sha(im.rgba),colors:[...colors].sort((a,b)=>b[1]-a[1]).slice(0,5),dest});
}
const references=['00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000'].map(id=>{const p='C:/Users/Public/AppData/Local/Temp/codex-clipboard-'+id+'.png',raw=fs.readFileSync(p);return {path:p,width:raw.readUInt32BE(16),height:raw.readUInt32BE(20)};});
fs.writeFileSync(path.join(stage,'asset-audit.json'),JSON.stringify({rows,references},null,2));console.log(JSON.stringify({rows,references}));
