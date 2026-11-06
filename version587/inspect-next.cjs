'use strict';
// Software resources only; never inspects live account/profile files.
const fs=require('fs'),path=require('path');
const paths=require('../foxmail-paths.cjs'),{readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const b=fs.readFileSync(path.join(paths.output('version587-reveal'),'Foxmail深色.exe'));
const rows=[];
for(const r of readResources(b).resources){
 if(r.type!==10||b.toString('ascii',r.offset,r.offset+4)!=='TPF0')continue;
 const walk=(o,p)=>{p+='.'+o.name;
  const props=o.properties.filter(x=>/Color|Border|Bevel|Paint|Draw|Selected|Selection|Gradient/.test(x.name)).map(x=>({name:x.name,type:x.type,value:x.value}));
  if(/ACCOUNTOPTION/.test(r.name)||props.some(x=>/Select|Highlight/i.test(x.name)))rows.push({resource:r.name,path:p,className:o.className,properties:props});
  o.children.forEach(c=>walk(c,p));
 };walk(parseDFM(b.subarray(r.offset,r.offset+r.size)),'');
}
fs.writeFileSync(path.join(paths.output('version587-next'),'ui-inventory.json'),JSON.stringify(rows,null,2));
for(const x of rows.filter(x=>/ACCOUNTOPTION/.test(x.resource)))console.log(JSON.stringify(x));
console.log('Selection resources:');console.log(readResources(b).resources.filter(x=>/SELECT|SELITEM|LIST_.*(FOCUS|PRESS|ACTIVE)|TREE_.*(FOCUS|PRESS|ACTIVE)|GROUPBOX/i.test(String(x.name))).map(x=>({type:x.type,name:x.name,size:x.size})).slice(0,150));
