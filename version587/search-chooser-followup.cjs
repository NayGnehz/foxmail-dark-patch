'use strict';
// Local colors and serialized properties on the user-accepted contrast EXE.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs');
const {parseDFM}=require('../inspect-dfm-palette.cjs');
const {verifyByteDelta}=require('./verify-byte-delta.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const baselineSHA256='77fcfb3a2f4552463ac89534040fce36408643a536a706e2e3cad9a47d33ba19';
const colors=[
 [0xd01be3,0x39587d,0x6f5131,'selected search tag brush'],
 [0xd01bf3,0x39587d,0x6f5131,'selected search tag pen'],
 [0xd01c05,0xf2ddc7,0x202020,'unselected search tag brush'],
 [0xd01c15,0xf2ddc7,0x606060,'unselected search tag pen'],
 [0xbe9dfb,0xfefaf9,0x202020,'chooser runtime form background'],
 [0xbe9e08,0xdce2d7,0x3d3d3d,'chooser runtime folder border'],
 [0xbe9e1b,0xbdb8b3,0x3d3d3d,'chooser runtime recipient border'],
 [0xbe9e2e,0xd1cac7,0x282828,'chooser Cc label background'],
 [0xbe9e41,0xd1cac7,0x282828,'chooser Bcc label background'],
 [0xbebd51,0xffffff,0x202020,'chooser member item erase brush'],
 [0xbec005,0xffffff,0x202020,'chooser recipient item erase brush']
];
function integer(value){const b=Buffer.alloc(5);b[0]=4;b.writeInt32LE(value,1);return b;}
function ident(value){return Buffer.concat([Buffer.from([7,value.length]),Buffer.from(value,'ascii')]);}
function semantic(value){
 if(Array.isArray(value))return value.map(semantic);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['offset','end'].includes(key)).map(([key,v])=>[key,semantic(v)]));
 return value;
}
function flatten(root){
 const nodes=new Map(),props=new Map();
 function walk(node,parent=''){
  const name=parent+'.'+node.name;nodes.set(name,{className:node.className,flags:node.flags,childPosition:semantic(node.childPosition)});
  for(const p of node.properties){const key=name+'|'+p.name;assert(!props.has(key));props.set(key,semantic(p.value));}
  node.children.forEach(c=>walk(c,name));
 }
 walk(root);return{nodes,props};
}
function patchBuffer(before){
 assert.equal(sha(before),baselineSHA256);
 const out=Buffer.from(before),{resources,pe,op}=readResources(before),ranges=[],changes=[];
 const table=op+before.readUInt16LE(pe+20);
 const sections=Array.from({length:before.readUInt16LE(pe+6)},(_,i)=>{const h=table+40*i;return{name:before.toString('ascii',h,h+8).replace(/\0/g,''),rva:before.readUInt32LE(h+12),raw:before.readUInt32LE(h+20),size:before.readUInt32LE(h+16)};});
 function off(va){const s=sections.find(s=>va-0x400000>=s.rva&&va-0x400000+5<=s.rva+s.size);assert.equal(s?.name,'CODE');return s.raw+va-0x400000-s.rva;}
 for(const[va,old,value,label]of colors){const at=off(va);assert.equal(before[at],0xba,label);assert.equal(before.readUInt32LE(at+1),old,label);out.writeUInt32LE(value,at+1);ranges.push([at+1,at+5]);changes.push({va,offset:at+1,before:old,after:value,label});}
 const forms=[];
 function editForm(name,configure){
  const matches=resources.filter(r=>r.type===10&&r.name===name);assert.equal(matches.length,1);
  const r=matches[0],data=before.subarray(r.offset,r.offset+r.size),root=parseDFM(data),nodes=new Map(),edits=[],expected=new Map();
  function walk(node,parent=''){const name=parent+'.'+node.name;nodes.set(name,node);node.children.forEach(c=>walk(c,name));}walk(root);
  function set(nodePath,className,property,old,value,encoded=integer(value)){
   const node=nodes.get(nodePath);assert.equal(node?.className,className,nodePath);
   const p=node.properties.find(p=>p.name===property);assert(p,nodePath+'.'+property);assert.deepEqual(p.value,old);
   edits.push({start:p.offset,end:p.end,data:encoded});expected.set(nodePath+'|'+property,value);
  }
  function add(nodePath,className,property,value,encoded=integer(value)){
   const node=nodes.get(nodePath);assert.equal(node?.className,className,nodePath);assert(!node.properties.some(p=>p.name===property));
   const at=node.properties.at(-1).end;assert.equal(data[at],0);
   edits.push({start:at,end:at,data:Buffer.concat([Buffer.from([property.length]),Buffer.from(property,'ascii'),encoded])});expected.set(nodePath+'|'+property,value);
  }
  configure({set,add,root:'.'+root.name});
  const pieces=[];let cursor=0;
  for(const e of edits.sort((a,b)=>a.start-b.start)){assert(e.start>=cursor);pieces.push(data.subarray(cursor,e.start),e.data);cursor=e.end;}
  pieces.push(data.subarray(cursor));const dfm=Buffer.concat(pieces);
  assert(dfm.length<=data.length,name+' exceeds its original resource allocation');
  const oldShape=flatten(root),shape=flatten(parseDFM(dfm));assert.deepEqual(shape.nodes,oldShape.nodes);
  for(const[key,value]of oldShape.props)assert.deepEqual(shape.props.get(key),expected.has(key)?expected.get(key):value,key);
  for(const[key,value]of expected)assert.deepEqual(shape.props.get(key),value,key);
  assert.equal(shape.props.size,oldShape.props.size+[...expected.keys()].filter(k=>!oldShape.props.has(k)).length);
  dfm.copy(out,r.offset);out.fill(0,r.offset+dfm.length,r.offset+r.size);out.writeUInt32LE(dfm.length,r.dataEntry+4);
  ranges.push([r.offset,r.offset+r.size],[r.dataEntry+4,r.dataEntry+8]);
  forms.push({name,offset:r.offset,dataEntry:r.dataEntry,oldSize:r.size,newSize:dfm.length,properties:[...expected].map(([key,value])=>({key,before:oldShape.props.has(key)?oldShape.props.get(key):'<default>',after:value}))});
 }
 for(const[name,root,toolbar]of [['TMAILAPPFRAME','MailAppFrame','RightToolbar'],['TMAILARCHIVEAPPFRAME','MailArchiveAppFrame','RightToolbar']]){
  editForm(name,({set})=>set('.'+root+'.TBXDock1.'+toolbar+'.xpnl1.Panel_QiuckSearchBack.edtSearch','TFMZRichEdit','Font.Color','clWindowText',0xe6e6e6));
 }
 editForm('TDLG_SELADDR',({set,add,root})=>{
  set(root,'TDlg_SelAddr','Font.Color','clWindowText',0xe6e6e6);
  // Numeric DEFAULT_CHARSET is semantically identical and frees enough space
  // for explicit first-frame colors without moving or extending the resource.
  set(root,'TDlg_SelAddr','Font.Charset','DEFAULT_CHARSET',1,Buffer.from([2,1]));
  for(const[group,tree]of [['pnlMemberList','vtMembers'],['pnlTo','vtTo'],['pnlCc','vtCc'],['pnlBcc','vtBcc']]){
   const node=root+'.P_Right.'+group+'.'+tree;
   set(node,'TVirtualStringTree','Header.Font.Color','clWindowText',0xe6e6e6);
   add(node,'TVirtualStringTree','Color',0x202020);
  }
 });
 editForm('TPOPLISTFORM',({set,add,root})=>{
  set(root,'TPopListForm','Color','clWindow',0x3d3d3d);
  set(root,'TPopListForm','Font.Color','clWindowText',0xe6e6e6);
  set(root,'TPopListForm','Font.Charset','DEFAULT_CHARSET',1,Buffer.from([2,1]));
  add(root,'TPopListForm','BorderWidth',1,Buffer.from([2,1]));
  const node=root+'.VDT';
  set(node,'TVirtualDrawTree','Header.Font.Color','clWindowText',0xe6e6e6);
  set(node,'TVirtualDrawTree','Header.Font.Charset','DEFAULT_CHARSET',1,Buffer.from([2,1]));
  add(node,'TVirtualDrawTree','BorderStyle','bsNone',ident('bsNone'));
  add(node,'TVirtualDrawTree','Color',0x202020);
 });
 const changedBytes=verifyByteDelta(before,out,ranges);
 const reversed=Buffer.from(out);for(const[start,end]of ranges)before.copy(reversed,start,start,end);assert(reversed.equals(before));
 const updated=readResources(out).resources;
 for(const r of resources.filter(r=>!forms.some(f=>f.name===r.name))){const now=updated.find(z=>z.type===r.type&&z.name===r.name&&z.lang===r.lang);assert.equal(now.size,r.size);assert(out.subarray(now.offset,now.offset+now.size).equals(before.subarray(r.offset,r.offset+r.size)));}
 return{buffer:out,forms,colors:changes,changedBytes,originalSize:before.length,reverseRestoresExactInput:true,otherPropertiesAndResourcesUnchanged:true};
}
if(require.main===module){
 const before=fs.readFileSync(path.join(paths.temp,'version587-contrast-followup/Foxmail.exe'));
 const {buffer,...result}=patchBuffer(before),stage=paths.output('version587-search-chooser-followup'),dest=path.join(stage,'Foxmail.exe');
 fs.writeFileSync(dest,buffer);
 const report={...result,baselineSHA256,candidateSHA256:sha(buffer),generatorSHA256:sha(fs.readFileSync(__filename)),dest,installed:false};
 fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({candidateSHA256:report.candidateSHA256,dest,changedBytes:report.changedBytes,forms:report.forms.map(f=>({name:f.name,oldSize:f.oldSize,newSize:f.newSize,properties:f.properties.length})),colorOperands:report.colors.length}));
}
module.exports={patchBuffer};
