'use strict';
// Version-specific initial port: import-based hooks and named visual resources.
// No 563 internal-code addresses, VMTs, native gates or browser patches reused.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),assert=require('assert');
const paths=require('../foxmail-paths.cjs'),root=paths.project,ported=process.env.FOXMAIL_587_PORTED_NATIVE==='1',out=paths.output(ported?'version587-native':'version587');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const app='D:/Users/Public/Downloads/Foxmail',source=path.join(app,'Foxmail.exe'),dest=path.join(out,'Foxmail深色.exe');
const pristine=fs.readFileSync(source),expected='f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399';
assert.equal(sha(pristine),expected,'587 pristine identity changed');
const createRequire=require('module').createRequire,req=createRequire(path.join(root,'build-dark.cjs'));
const savedArgv=process.argv,savedEnv={};
for(const [key,value]of Object.entries({FOXMAIL_NATIVE_GRADIENT:'0',FOXMAIL_TRANSIENT_BUFFER:'0',FOXMAIL_ERASE_DIAGNOSTICS:'0',FOXMAIL_PAINT_DIAGNOSTICS:'0'})){savedEnv[key]=process.env[key];process.env[key]=value;}
const disabled=['initial-erase','native-gradient','tray-restore','editor-canvas'];
try{
 process.argv=[process.execPath,path.join(root,'build-dark.cjs'),source,dest];
 const load=name=>{
  if(name==='./add-initial-erase.cjs')return ported?require('./native-ports.cjs')(paths):{emit:()=>null,emitInit:()=>{},patchOriginal:()=>{}};
  if(name==='./add-tray-restore.cjs')return{emit:()=>null};
  if(name==='./patch-editor-canvas-background.cjs')return{patchOriginal:()=>[]};
  return req(name);
 };
 vm.runInNewContext(fs.readFileSync(path.join(root,'build-dark.cjs'),'utf8'),{require:load,process,Buffer,console,__dirname:root,module:{exports:{}}},{filename:'build-dark.cjs'});
}finally{process.argv=savedArgv;for(const [key,value]of Object.entries(savedEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
let result=fs.readFileSync(dest);
const {readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const old=fs.readFileSync(path.join(paths.fixed('cosmetic-a3d3700d'),'Foxmail深色.exe'));
assert.equal(sha(old),'a3d3700d0c5e60810c4694fb0a49216da65460050c467e359d322183ac8576fb');
const oldResources=readResources(old).resources,newResources=readResources(result).resources;
const changes=[];let forms=0;
function colorProps(node,prefix='',map=new Map()){
 const key=prefix+'.'+node.name;
 for(const p of node.properties)if(/(^|\.)Color$|BorderColor$|GridLineColor$|transparentColor$/.test(p.name)&&p.type===4)map.set(key+'|'+node.className+'|'+p.name,p);
 for(const child of node.children)colorProps(child,key,map);return map;
}
for(const r of newResources){
 if(r.type!==10||result.toString('ascii',r.offset,r.offset+4)!=='TPF0')continue;
 const original=oldResources.find(x=>x.type===r.type&&x.name===r.name&&x.lang===r.lang);
 if(!original||old.toString('ascii',original.offset,original.offset+4)!=='TPF0')continue;
 const a=colorProps(parseDFM(old.subarray(original.offset,original.offset+original.size)));
 const b=colorProps(parseDFM(result.subarray(r.offset,r.offset+r.size)));forms++;
 for(const [key,p]of b){const q=a.get(key);if(!q||q.value===p.value)continue;
  // Only audited dark UI palette, never arbitrary inherited integer values.
  if(![0x202020,0x282828,0x3d3d3d,0x454545,0xe6e6e6,0x333333,0x784f26].includes(q.value))continue;
  result.writeInt32LE(q.value,r.offset+p.offset+1);changes.push({resource:r.name,key,before:p.value,after:q.value});
 }
}
fs.writeFileSync(dest,result);
const {spawnSync}=require('child_process');
for(const script of ['recolor-background-bitmaps.cjs','recolor-search-scrollbars.cjs','recolor-numeric-ui-backgrounds.cjs','recolor-dialog-controls.cjs']){
 const next=path.join(out,script+'.exe');const run=spawnSync(process.execPath,[path.join(root,script),dest,next,source],{cwd:out,encoding:'utf8',maxBuffer:8*1024*1024});
 fs.writeFileSync(path.join(out,script+'.log'),run.stdout+run.stderr);
 assert.equal(run.status,0,script+' failed: '+run.stderr.slice(0,500));fs.copyFileSync(next,dest);
}
result=fs.readFileSync(dest);
function sections(b){const pe=b.readUInt32LE(60),op=pe+24,so=op+b.readUInt16LE(pe+20);return Array.from({length:b.readUInt16LE(pe+6)},(_,i)=>{const q=so+i*40;return{name:b.toString('ascii',q,q+8).replace(/\0/g,''),raw:b.readUInt32LE(q+20),size:b.readUInt32LE(q+16),rva:b.readUInt32LE(q+12)}});}
const before=sections(pristine),after=sections(result),checks=[];
for(const section of before.filter(s=>s.name!=='.rsrc')){const s=after.find(x=>x.name===section.name);assert(s&&s.size===section.size&&s.rva===section.rva);
 const a=pristine.subarray(section.raw,section.raw+section.size),b=result.subarray(s.raw,s.raw+s.size);
 if(ported&&section.name==='CODE'){
  const meta=JSON.parse(fs.readFileSync(dest+'.json','utf8'));const sites=meta.nativeInitialErase.sites;
  assert.equal(sites.length,4);for(let i=0;i<a.length;i++)if(a[i]!==b[i])assert(sites.some(x=>section.rva+i>=x.originalRva&&section.rva+i<x.originalRva+6),'Unexpected587 code delta');
 }else{assert(a.equals(b),section.name+' original contents changed');checks.push(section.name);}
}
// Only named static software assets: never enumerate accounts/mail/settings.
const plan=JSON.parse(fs.readFileSync(path.join(root,'cosmetic-1.3/pristine-restore-plan.json'),'utf8'));
plan.files.push({relative:'7.2.25.563/Template/HtmlEditor/Compose/compose_body.html',source:'BeforeCompose1.3.2-09D9F83F/7.2.25.563/Template/HtmlEditor/Compose/compose_body.html',SHA256:'51f8352bb3dd6e128ce322f1415095eafc16ead21be206f4937464fcb74ee6ed'});
const externalInventory=JSON.parse(fs.readFileSync(path.join(root,'resource-inventory/external-assets.json'),'utf8').replace(/^\ufeff/,''));
const {pngDecode}=require('../recolor-search-scrollbars.cjs');
const assets=[],rejected=[];
for(const file of plan.files){
 const relative=file.relative.replaceAll('\\','/').replace(/^7\.2\.25\.563\//,'7.2.25.587/');
 const original=path.join(app,'DarkModeBackup',file.source),newOriginal=path.join(app,relative);
 if(!fs.existsSync(original)||!fs.existsSync(newOriginal)){rejected.push({relative,reason:'missing pristine static source'});continue;}
 const ob=fs.readFileSync(original),nb=fs.readFileSync(newOriginal);
 if(sha(ob)!==file.SHA256||!ob.equals(nb)){rejected.push({relative,reason:'upstream asset changed; needs explicit merge'});continue;}
 let darkBytes;
 const short=file.relative.replaceAll('\\','/').replace(/^7\.2\.25\.563\//,'');
 if(short==='Template/HtmlEditor/Common/Base.css')darkBytes=Buffer.concat([nb,fs.readFileSync(path.join(root,'cosmetic-1.3/editor-screen-scrollbars.css'))]);
 else if(short==='Template/Conversation/mail_frame.html'){
  darkBytes=fs.readFileSync(path.join(paths.fixed('compose-rollback-09d9f83f'),'7.2.25.563',short));
  assert.equal(sha(darkBytes),'546aa4b8853a51daa6eb789a4866a5330a7274256ad39e4ad603290c4aab32c0');
 }else if(short==='Template/HtmlEditor/Compose/compose_body.html'){
  const needle=Buffer.from('<body>'),at=nb.indexOf(needle);assert(at>=0&&nb.indexOf(needle,at+1)<0);
  darkBytes=Buffer.concat([nb.subarray(0,at),Buffer.from('<body style="background-color: #202020">'),nb.subarray(at+needle.length)]);
 }else{const dark=path.join(root,'ExternalSkinUpdate',short);if(fs.existsSync(dark))darkBytes=fs.readFileSync(dark);
  else{
   const asset=externalInventory.find(x=>x.relative.replaceAll('\\','/')===short);
   const matches=(asset?.resourceMatches||[]).filter(x=>x.startsWith('10:')).map(x=>x.slice(3));
   const resource=oldResources.find(x=>x.type===10&&matches.includes(x.name));
   if(!resource){rejected.push({relative,reason:'missing authored skin resource'});continue;}
   darkBytes=old.subarray(resource.offset,resource.offset+resource.size);
   const a=pngDecode(nb),b=pngDecode(darkBytes);assert.equal(a.width,b.width);assert.equal(a.height,b.height);
   for(let i=3;i<a.rgba.length;i+=4)assert.equal(a.rgba[i],b.rgba[i],'External skin alpha changed '+relative);
  }
 }
 const target=path.join(out,'assets',relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,darkBytes);
 assets.push({relative,originalSHA256:sha(nb),candidateSHA256:sha(darkBytes),source:target});
}
const report={version:'7.2.25.587',stage:'prepared-not-installed',sourceSHA256:expected,candidateSHA256:sha(result),dest,formsCompared:forms,colorChanges:changes.length,originalSectionsUnchanged:checks,disabledOldCoordinateFeatures:disabled,assets,rejected,scope:'587 original native code/DATA/import/relocations retained byte-for-byte. Import-only color wrappers plus named resource properties and static software assets. No old internal hooks, DLL or VMT reused.',limitation:'Initial compatible theme port; native border/gradient/editor-canvas and anti-flash internal hooks require separate587 remapping. No launch acceptance yet.'};
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,'dfm-colors.json'),JSON.stringify(changes,null,2));
console.log(JSON.stringify({candidate:dest,sha:report.candidateSHA256,forms,colors:changes.length,assets:assets.length,rejected:rejected.length,originalSectionsUnchanged:checks}));
