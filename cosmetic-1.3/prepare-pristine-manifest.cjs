'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const app='D:/Users/Public/Downloads/Foxmail',root=path.resolve(__dirname,'..'),backup=path.join(app,'DarkModeBackup'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'resource-inventory/external-assets.json'),'utf8').replace(/^\ufeff/,''));
const plan=JSON.parse(fs.readFileSync(path.join(__dirname,'install-plan.json'),'utf8')),entries=new Map();
function put(relative,source,data,expected){assert.equal(sha(data),expected);entries.set(relative.replace(/\\/g,'/').toLowerCase(),{relative,source,SHA256:expected});}
function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())visit(p);else{const r=path.relative(path.join(backup,'OriginalSkin'),p),a=inventory.find(a=>a.relative.toLowerCase()===r.toLowerCase());assert(a,'Unknown pristine skin '+r);put('7.2.25.563/'+r,'OriginalSkin/'+r,fs.readFileSync(p),a.sha256.toLowerCase());}}}
visit(path.join(backup,'OriginalSkin'));
for(const f of plan.files.filter(f=>f.pristineBackup)){const existing=path.join(backup,f.pristineBackup);put(f.relative,f.pristineBackup,fs.readFileSync(fs.existsSync(existing)?existing:path.join(app,f.relative)),f.pristineSHA256);}
const mail=fs.readFileSync(path.join(backup,'mail_frame.html'));put('7.2.25.563/Template/Conversation/mail_frame.html','mail_frame.html',mail,sha(mail));
fs.writeFileSync(path.join(__dirname,'pristine-restore-plan.json'),JSON.stringify({originalSHA256:plan.originalSHA256,files:[...entries.values()]},null,2));
console.log(JSON.stringify({originalAssets:entries.size,includesEditorCSS:true,includesAllBackedSkins:true}));
