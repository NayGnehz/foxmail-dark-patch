'use strict';
// Exact allowlist from the 264-DFM audit; no discovery-time broad mutation.
const plan=require('./numeric-chrome-border-plan.json');
const {readResources}=require('../pe-resource-utils.cjs');
const {parseDFM}=require('../inspect-dfm-palette.cjs');
function patchBuffer(input){
 const out=Buffer.from(input),resources=readResources(out).resources,targets=new Map(plan.selected.map(x=>[x.resource+'|'+x.path+'|'+x.property,x])),pending=[],found=new Set(),skipped=[];
 if(targets.size!==37)throw Error('Expected37uniqueauditednumericborders');
 for(const r of resources){if(r.type!==10||!plan.selected.some(x=>x.resource===r.name))continue;const root=parseDFM(out.subarray(r.offset,r.offset+r.size));
  function walk(o,path){path+='.'+o.name;for(const p of o.properties){const key=r.name+'|'+path+'|'+p.name,s=targets.get(key);if(!s)continue;if(found.has(key))throw Error('Ambiguous DFM path '+key);found.add(key);if(o.className!==s.className||p.type!==4)throw Error('Class/type guard mismatch '+key);if(p.value===s.after){skipped.push({resource:r.name,path,property:p.name,reason:'Already darkened by earlier layer'});continue;}if(p.value!==s.value)throw Error('Numeric palette guard mismatch '+key);pending.push({resource:r.name,path,className:o.className,property:p.name,offset:r.offset+p.offset+1,before:p.value,after:s.after});}o.children.forEach(c=>walk(c,path));}walk(root,'');
 }
 if(found.size!==targets.size)throw Error('Not all audited DFM paths found');for(const p of pending)out.writeUInt32LE(p.after,p.offset);for(let p=0;p<out.length;p++)if(out[p]!==input[p]&&!pending.some(x=>p>=x.offset&&p<x.offset+4))throw Error('Delta outside numeric border operands');return{buffer:out,changes:pending,skipped};
}
module.exports={patchBuffer};
