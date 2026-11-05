'use strict';
const {readResources}=require('../pe-resource-utils.cjs');
const {parseDFM}=require('../inspect-dfm-palette.cjs');
const code=[
 {va:0xb899df,before:'baffffff008b45fce8a00e5a00',after:'ba202020008b45fce8a00e5a00',name:'TFoxHTMLEditorBase native host Color #202020'},
 {va:0xb89268,before:'ba050000ffe81a165a00',after:'ba20202000e81a165a00',name:'Editor TCEFWindowParent native host Color #202020'}
];
function patchBuffer(input){
 const out=Buffer.from(input),pe=out.readUInt32LE(60),op=pe+24,so=op+out.readUInt16LE(pe+20),base=out.readUInt32LE(op+28);
 function off(va){const r=va-base;for(let i=0;i<out.readUInt16LE(pe+6);i++){let p=so+i*40,v=out.readUInt32LE(p+12),s=out.readUInt32LE(p+16);if(r>=v&&r<v+s)return out.readUInt32LE(p+20)+r-v;}throw Error('Unmapped VA');}
 const changes=[];
 for(const p of code){const at=off(p.va),before=Buffer.from(p.before,'hex'),after=Buffer.from(p.after,'hex');if(!out.subarray(at,at+before.length).equals(before))throw Error('Editor host guard '+p.va.toString(16));after.copy(out,at);changes.push({name:p.name,va:p.va,offset:at,size:after.length,before:p.before,after:p.after});}
 const r=readResources(out).resources.find(r=>r.type===10&&r.name==='TCOMPOSEOPTIONFRAME');if(!r)throw Error('Missing compose options DFM');
 const tree=parseDFM(out.subarray(r.offset,r.offset+r.size));let panel;
 function visit(o){if(o.name==='pnlEditor'&&o.className==='TXPanel')panel=o;for(const c of o.children)visit(c);}visit(tree);
 const prop=panel&&panel.properties.find(p=>p.name==='BorderColor');if(!prop||prop.type!==4||prop.value!==0xb2b2b2)throw Error('Signature outer border guard');
 const at=r.offset+prop.offset+1;out.writeUInt32LE(0x454545,at);changes.push({name:'TCOMPOSEOPTIONFRAME.grpSignature.pnlEditor.BorderColor',offset:at,size:4,before:'b2b2b200',after:'45454500'});
 for(let i=0;i<out.length;i++)if(out[i]!==input[i]&&!changes.some(x=>i>=x.offset&&i<x.offset+x.size))throw Error('Out-of-scope editor chrome byte');
 const reparsed=parseDFM(out.subarray(r.offset,r.offset+r.size));if(!reparsed)throw Error('DFM reparse failed');
 return {buffer:out,changes};
}
module.exports={patchBuffer};
