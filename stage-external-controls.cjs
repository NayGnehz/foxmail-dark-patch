const fs=require('fs'),path=require('path'),crypto=require('crypto'),{readResources}=require('./pe-resource-utils.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const root=path.resolve('ExternalSkinUpdate'),exe=fs.readFileSync('Foxmail-dark-fixed.exe'),resources=readResources(exe).resources;
const changed=new Set(JSON.parse(fs.readFileSync('Foxmail-dark-controls.exe.bitmap-report.json','utf8')).resources.map(x=>'10:'+x.name));
for(const resource of JSON.parse(fs.readFileSync('Foxmail-dark-shadow.exe.menu-shadow.json','utf8')).resources)changed.add('10:'+resource.name);
const inventory=JSON.parse(fs.readFileSync('resource-inventory/external-assets.json','utf8').replace(/^\ufeff/,'')),entries=[];
for(const asset of inventory){const match=(asset.resourceMatches||[]).find(x=>changed.has(x));if(!match)continue;const rel=asset.relative;if(path.isAbsolute(rel)||rel.split(/[\\/]/).includes('..'))throw Error('Invalid asset path');
 const out=path.resolve(root,rel);if(!out.startsWith(root+path.sep))throw Error('Asset outside stage');const name=match.slice(3),r=resources.find(x=>x.type===10&&x.name===name);if(!r)throw Error('Missing '+name);
 const data=exe.subarray(r.offset,r.offset+r.size);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,data);entries.push({relative:rel,originalSHA256:asset.sha256,newSHA256:sha(data)});
}
if(!entries.length)throw Error('No matched external controls');fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(entries,null,2));console.log('Staged '+entries.length+' matching external control skins');
