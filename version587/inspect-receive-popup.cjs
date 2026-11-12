'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const b=fs.readFileSync(path.join(paths.temp,'version587-chooser-first-erase/Foxmail.exe'));
assert.equal(createHash('sha256').update(b).digest('hex'),'daa704320ecb6acbba31df79be7e3b297284c103ee2877e23be51e7d6cd24305');
const stage=paths.output('version587-receive-popup');
for(const r of readResources(b).resources.filter(r=>r.type===10&&/PROGRESS|RECV/.test(r.name)&&b.toString('ascii',r.offset,r.offset+4)==='TPF0')){
 const root=parseDFM(b.subarray(r.offset,r.offset+r.size)),rows=[];
 function walk(n,p=''){p+='.'+n.name;rows.push({path:p,className:n.className,properties:n.properties.filter(x=>/Color|Paint|Erase|Create|Show|Caption|Bevel|Border|Parent|DoubleBuffer/.test(x.name))});n.children.forEach(c=>walk(c,p));}
 walk(root);fs.writeFileSync(path.join(stage,r.name+'.json'),JSON.stringify(root,null,2));console.log(JSON.stringify({name:r.name,rows}));
}
