'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const project=__dirname;
let workspace=project;
while(!fs.existsSync(path.join(workspace,'_env/contracts/portable-v1.json'))){
 const parent=path.dirname(workspace);if(parent===workspace)throw Error('Restore the shared environment beside Foxmail');workspace=parent;
}
const environment=path.join(workspace,'_env');
// Use the registered shared PowerShell and canonical project adapter, never global tools.
const contract=JSON.parse(fs.readFileSync(path.join(environment,'contracts/portable-v1.json'),'utf8').replace(/^\uFEFF/,''));
const pwsh=path.join(environment,contract.tools.pwsh.path);
if(!process.env.FOXMAIL_PIPELINE_LEASE){
 const result=cp.spawnSync(pwsh,['-NoProfile','-File',path.join(project,'Invoke-FoxmailPipeline.ps1'),'-Script',process.argv[1],...process.argv.slice(2)],{stdio:'inherit'});
 if(result.error)throw result.error;process.exit(result.status===null?1:result.status);
}
if(path.resolve(process.env.PORTABLE_INSTANCE_ROOT||'')!==path.resolve(process.env.FOXMAIL_PIPELINE_LEASE))throw Error('Missing canonical pipeline lease');
const temp=path.join(process.env.PORTABLE_INSTANCE_ROOT,'temp');
function plain(target){
 let at=path.resolve(target);for(;;){if(fs.existsSync(at)&&fs.lstatSync(at).isSymbolicLink())throw Error('Reparse/symlink pipeline path: '+at);const parent=path.dirname(at);if(parent===at)break;at=parent;}return path.resolve(target);
}
function output(group){const dest=plain(path.join(temp,group));if(path.dirname(dest)!==path.resolve(temp))throw Error('Invalid output group');fs.mkdirSync(dest,{recursive:true});return dest;}
function fixed(name){if(!['cosmetic-a3d3700d','compose-rollback-09d9f83f'].includes(name))throw Error('Unknown fixed input');const dest=plain(path.join(environment,'feeds/native/foxmail-build-inputs',name));if(!fs.existsSync(dest))throw Error('Shared owner must restore fixed input: '+name);return dest;}
const groups={'print-native-gate':'native-print-native-gate','compose-native-gate':'native-compose-native-gate','print-candidate':'print-candidate','compose-candidate':'compose-candidate','compose-initial':'compose-initial','print-theme-payload':'print-theme-payload'};
function artifact(relative){
 const parts=relative.replace(/\\/g,'/').split('/');if(parts.includes('..')||path.isAbsolute(relative))throw Error('Invalid artifact path');
 if(parts[0]==='secondary-windows'&&groups[parts[1]]&&!/\.(c|h|cjs|ps1|py|cs)$/.test(relative))return plain(path.join(output(groups[parts[1]]),...parts.slice(2)));
 return plain(path.join(project,...parts));
}
module.exports={project,workspace,environment,temp,output,fixed,artifact};
