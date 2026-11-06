'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
module.exports=function(paths){
 const report=JSON.parse(fs.readFileSync(path.join(paths.output('version587'),'native-map.json'),'utf8'));
 const code=new Map(report.code.map(x=>[x.oldVA,x.newVA])),vmt=new Map(report.vmt.map(x=>[x.oldVA,x.newVA]));
 let source=fs.readFileSync(path.join(paths.project,'add-initial-erase.cjs'),'utf8');
 for(const va of [0x98712c,0x6a7a7c,0xa1eb20,0xa163f8]){assert(code.has(va));source=source.replace(new RegExp('0x'+(va-0x400000).toString(16)+'\\b','g'),'0x'+(code.get(va)-0x400000).toString(16));}
 for(const va of [0x96fa20,0xa92008,0xa90898,0xa1db24,0xdcd254]){assert(vmt.has(va));source=source.replace(new RegExp('0x'+(va-0x400000).toString(16)+'\\b','g'),'0x'+(vmt.get(va)-0x400000).toString(16));}
 const module={exports:{}};vm.runInNewContext(source,{module,Buffer,require:require('module').createRequire(path.join(paths.project,'add-initial-erase.cjs'))},{filename:'587-initial-erase-guarded.cjs'});
 return module.exports;
};
