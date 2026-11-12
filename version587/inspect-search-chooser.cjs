'use strict';
// Static software metadata only. Screenshots and live mail are never opened here.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs');
const {parseDFM}=require('../inspect-dfm-palette.cjs');
const bytes=fs.readFileSync(path.join(paths.temp,'version587-contrast-followup/Foxmail.exe'));
assert.equal(createHash('sha256').update(bytes).digest('hex'),'77fcfb3a2f4552463ac89534040fce36408643a536a706e2e3cad9a47d33ba19');
const stage=paths.output('version587-search-chooser-followup');
const resources=readResources(bytes).resources;
const controls=[];
for(const r of resources.filter(r=>r.type===10&&bytes.toString('ascii',r.offset,r.offset+4)==='TPF0')){
 const tree=parseDFM(bytes.subarray(r.offset,r.offset+r.size));
 function find(node,parent=''){
  const name=parent+'.'+node.name;
  if(/search/i.test(name)&&/Edit|Search|Combo|ListBox/.test(node.className))controls.push({resource:r.name,path:name,className:node.className,properties:node.properties.filter(p=>/Color|Border|Font|Paint|Draw/.test(p.name))});
  node.children.forEach(c=>find(c,name));
 }
 find(tree);
}
fs.writeFileSync(path.join(stage,'search-controls.json'),JSON.stringify(controls,null,2));
console.log(JSON.stringify({searchRichEdits:controls.filter(c=>c.className==='TFMZRichEdit')}));
const names=resources.filter(r=>r.type===10&&bytes.toString('ascii',r.offset,r.offset+4)==='TPF0'&&/SEARCH|FOXMAIN|SELADDR|FASTADDRF|POPLISTFORM/.test(r.name));
console.log(JSON.stringify({forms:names.map(r=>r.name)}));
for(const r of names){
 const tree=parseDFM(bytes.subarray(r.offset,r.offset+r.size)),rows=[];
 function walk(node,parent=''){
  const name=parent+'.'+node.name;
  if(/TDLG_SELADDR|TFASTADDRF|TPOPLISTFORM/.test(r.name)||/search/i.test(name))rows.push({path:name,className:node.className,properties:node.properties.filter(p=>/Color|Border|Ctl3D|Font|Paint|Erase|Draw|Create|Show|Parent|Visible/.test(p.name))});
  node.children.forEach(c=>walk(c,name));
 }
 walk(tree);fs.writeFileSync(path.join(stage,r.name+'.json'),JSON.stringify(tree,null,2));
 if(r.name==='TPOPLISTFORM')console.log(JSON.stringify({resource:r.name,rows}));
}
