'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const b=fs.readFileSync('D:/Users/Public/Downloads/Foxmail/Foxmail深色.exe');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'233e7bdfb5f0d3e688a46b7e9eccbed3572795b5312e7d5c810ad4a8b1b387c6');
const rows=[];
for(const r of readResources(b).resources){
 if(r.type!==10||!/(ADDR|CONTACT)/i.test(r.name)||b.toString('ascii',r.offset,r.offset+4)!=='TPF0')continue;
 const tree=parseDFM(b.subarray(r.offset,r.offset+r.size)),props=[];
 function walk(o,p=''){p+='.'+o.name;for(const q of o.properties)if(/Color$|^On.*(Draw|Paint)|^Header|^TreeOptions/.test(q.name))props.push({path:p,className:o.className,name:q.name,type:q.type,value:q.value,offset:r.offset+q.offset+1});for(const c of o.children)walk(c,p);}
 walk(tree);rows.push({resource:r.name,rootClass:tree.className,properties:props});
}
fs.writeFileSync(path.join(paths.output('version587-address-native'),'dfm-numeric.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.map(x=>({resource:x.resource,rootClass:x.rootClass,properties:x.properties.length}))));
