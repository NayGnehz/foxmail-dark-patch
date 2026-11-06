'use strict';
// Reserve a small right strip for the existing account group skin border.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const input=path.join(paths.output('version587-account-edge-calls'),'Foxmail深色.exe'),b=fs.readFileSync(input);
const baselineSHA256='1c38639672b9ca1e5de77db307d604d7ac89ad1246c8ed8e44a88bb785ce6913';assert.equal(sha(b),baselineSHA256);
const resources=readResources(b).resources.filter(r=>r.type===10&&r.name==='TACCOUNTOPTIONFRAME');assert.equal(resources.length,1);
const resource=resources[0],before=parseDFM(b.subarray(resource.offset,resource.offset+resource.size));
assert.equal(before.className,'TAccountOptionFrame');assert.equal(before.name,'AccountOptionFrame');
function child(o,name,cls){const rows=o.children.filter(c=>c.name===name&&c.className===cls);assert.equal(rows.length,1);return rows[0];}
const group=child(before,'grpLine','TFMGroupBox'),notebook=child(group,'Notebook','TNotebook');
const prop=(o,name)=>{const ps=o.properties.filter(p=>p.name===name);assert.equal(ps.length,1);return ps[0];};
assert.equal(prop(group,'Width').value,416);assert.equal(prop(notebook,'Left').value,0);assert.equal(prop(notebook,'Top').value,14);
const width=prop(notebook,'Width');assert.equal(width.type,3);assert.equal(width.value,416);assert.equal(width.end-width.offset,3);
for(const o of [before,group,notebook])assert(!o.properties.some(p=>p.name==='OnResize'),'Declared resize event requires inspection');
assert(!notebook.properties.some(p=>['Align','Anchors'].includes(p.name)),'Explicit anchoring/alignment requires inspection');
const out=Buffer.from(b),absoluteOffset=resource.offset+width.offset;
assert.equal(out.subarray(absoluteOffset,absoluteOffset+3).toString('hex'),'03a001');out.writeInt16LE(414,absoluteOffset+1);
const after=parseDFM(out.subarray(resource.offset,resource.offset+resource.size));
const afterWidth=prop(child(child(after,'grpLine','TFMGroupBox'),'Notebook','TNotebook'),'Width');assert.equal(afterWidth.value,414);
afterWidth.value=416;assert.deepEqual(after,before,'Only one parsed DFM scalar may change');
const byteDiff=[];for(let i=0;i<b.length;i++)if(b[i]!==out[i])byteDiff.push({offset:i,before:b[i],after:out[i]});
assert.deepEqual(byteDiff,[{offset:absoluteOffset+1,before:0xa0,after:0x9e}]);
const stage=paths.output('version587-account-right-inset'),dest=path.join(stage,'Foxmail深色.exe'),candidateSHA256=sha(out);
const report={input,dest,baselineSHA256,candidateSHA256,generatorSHA256:sha(fs.readFileSync(__filename)),resource:{type:resource.type,name:resource.name,language:resource.lang,offset:resource.offset,size:resource.size},componentPath:'AccountOptionFrame.grpLine.Notebook',property:'Width',type:width.type,absoluteOffset,valueOffset:absoluteOffset+1,oldWidth:416,newWidth:414,oldNewWidth:[416,414],beforeHex:'03a001',afterHex:out.subarray(absoluteOffset,absoluteOffset+3).toString('hex'),expectedByteDiff:byteDiff,changedBytes:byteDiff.length,parsedDfmOnlyWidthChanged:true,allOtherBytesUnchanged:true,originalEntryUnchanged:true,acceptedEdgeCallsPreserved:true,helperSHA256:'0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70',cssSHA256:'8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8',layoutEvidence:{groupWidth:416,notebookLeft:0,notebookTop:14,noSerializedResizeEvent:true,noExplicitNotebookAlignOrAnchors:true},scope:'One account Notebook serialized width decreases by two logical pixels to expose the existing parent right border. No child content, caption, resources, painting, PE headers or accepted edge-call code otherwise changed.',limitation:'Static DFM contains no resize handler or explicit anchoring; runtime native bounds must verify that later layout code retains the width.',installed:false};
fs.writeFileSync(dest,out);fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
