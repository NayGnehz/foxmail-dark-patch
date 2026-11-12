'use strict';
// Inspect only sealed software resources for the three screenshot regressions.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const paths = require('../foxmail-paths.cjs');
const {readResources} = require('../pe-resource-utils.cjs');
const {parseDFM} = require('../inspect-dfm-palette.cjs');
const sha = b => createHash('sha256').update(b).digest('hex');
const input = path.join(paths.workspace, '_releases/foxmail/5.0/payload/Foxmail深色.exe');
const bytes = fs.readFileSync(input);
assert.equal(sha(bytes), '24665d0450f6a7b5efc9cba26cfc05dc9d0c8a761d6a91a093853d2ea4688f9c');
const resources = readResources(bytes).resources;
const stage = paths.output('version587-contrast-followup');
const trees = {};
for (const name of ['TDLG_SELADDR', 'TFOXCOMPOSEFRAME', 'TADDRESSAPPFRAME']) {
 const resource = resources.find(r => r.type === 10 && r.name === name);
 assert(resource);
 const root = parseDFM(bytes.subarray(resource.offset, resource.offset + resource.size));
 const rows = [];
 function walk(node, parent='') {
  const full = parent + '.' + node.name;
  const properties = node.properties.filter(p => /Color|Font|Paint|Draw|lvAttach|Custom|Parent/.test(p.name));
  if (properties.length) rows.push({path:full, className:node.className, properties});
  for (const child of node.children) walk(child, full);
 }
 walk(root);
 trees[name] = rows;
}
const images = resources.filter(r => /ATTACH.*SEL|SEL.*ATTACH/i.test(String(r.name)))
 .map(r => ({...r, sha256:sha(bytes.subarray(r.offset,r.offset+r.size))}));
const report = {inputSHA256:sha(bytes), trees, images};
fs.writeFileSync(path.join(stage,'resources.json'), JSON.stringify(report,null,2));
console.log(JSON.stringify({addressSearch:trees.TADDRESSAPPFRAME.filter(x=>/Search/.test(x.path))}));
const {pngDecode} = require('../recolor-search-scrollbars.cjs');
for (const r of resources.filter(r => /^COMPOSE_ATTACH_SELECT(?:_2X)?_PNG$/.test(r.name))) {
 const png = bytes.subarray(r.offset,r.offset+r.size);
 fs.writeFileSync(path.join(stage,r.name+'.png'),png);
 const im = pngDecode(png), counts = new Map();
 for(let i=0;i<im.rgba.length;i+=4) {const key=im.rgba.subarray(i,i+4).toString('hex'); counts.set(key,(counts.get(key)||0)+1);}
 console.log(JSON.stringify({name:r.name,width:im.width,height:im.height,colors:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,12)}));
}