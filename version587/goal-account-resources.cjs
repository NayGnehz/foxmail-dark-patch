'use strict';
// Software DFM only: numeric painting properties and component identities.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs'),{readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const file=path.join(paths.output('version587-goal'),'Foxmail深色-firstrestore.exe'),b=fs.readFileSync(file);
assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'9f98ef8b5753bf5ec7f694f06705fa5c20a7ac7493a5e691abe422eead4ab9e4');
const report=[];
for(const r of readResources(b).resources.filter(x=>x.type===10&&/ACCOUNT.*(OPTION|SET)|OPTION.*ACCOUNT|TOPTIONFORM/i.test(x.name)&&b.toString('ascii',x.offset,x.offset+4)==='TPF0')){
 const root=parseDFM(b.subarray(r.offset,r.offset+r.size)),rows=[];
 function walk(o,parent){
  const props=o.properties.filter(x=>/^(Left|Top|Width|Height|Align|Anchors|Shape|Style|Transparent|ParentBackground|ParentColor|Color|BorderStyle|Bevel.*|.*Color|Ctl3D)$/.test(x.name)).map(x=>({name:x.name,type:x.type,value:x.value}));
  rows.push({className:o.className,name:o.name,parent,properties:props});o.children.forEach(x=>walk(x,o.name));
 }
 walk(root,null);report.push({resource:r.name,components:rows});
}
assert(report.length);const dest=path.join(paths.output('version587-goal'),'account-resource-paint.json');fs.writeFileSync(dest,JSON.stringify(report,null,2));
console.log(JSON.stringify({dest,resources:report.map(x=>({resource:x.resource,components:x.components.length,backgroundFlags:x.components.filter(y=>y.properties.some(p=>['Transparent','ParentBackground'].includes(p.name)))}))},null,2));
