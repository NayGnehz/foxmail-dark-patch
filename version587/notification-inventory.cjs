'use strict';
// Inspect named software resources only, never live notification text/mail.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs'),{readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const b=fs.readFileSync(path.join(paths.output('version587-goal'),'Foxmail深色-firstrestore.exe'));
assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'9f98ef8b5753bf5ec7f694f06705fa5c20a7ac7493a5e691abe422eead4ab9e4');
const resources=readResources(b).resources,out=[];
for(const r of resources.filter(r=>r.type===10&&/NOTIFY|NOTIF|NEWMAIL|REMIND|MAILTIP|POPUP/i.test(r.name))){
 if(b.toString('ascii',r.offset,r.offset+4)!=='TPF0'){out.push({resource:r.name,size:r.size});continue;}
 const root=parseDFM(b.subarray(r.offset,r.offset+r.size)),rows=[];
 function walk(o,parent){rows.push({className:o.className,name:o.name,parent,properties:o.properties.filter(p=>/^(Left|Top|Width|Height|Color|TransparentColor|.*Color|.*Border.*|.*Bevel.*|Skin.*|Picture.*|Image.*|.*Bitmap.*|AlphaBlend.*)$/.test(p.name)).map(p=>({name:p.name,type:p.type,value:p.value}))});o.children.forEach(x=>walk(x,o.name));}
 walk(root,null);out.push({resource:r.name,components:rows});
}
const dest=path.join(paths.output('version587-goal'),'notification-resources.json');fs.writeFileSync(dest,JSON.stringify(out,null,2));console.log(JSON.stringify({dest,resources:out.map(x=>({resource:x.resource,components:x.components?.length||0}))}));
