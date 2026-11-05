'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const dir=path.join(__dirname,'reveal-gate-v2'),target='D:\\Users\\Public\\Downloads\\Foxmail';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8').replace(/^\uFEFF/,''));
const b=fs.readFileSync(path.join(__dirname,'Foxmail-dark-no-diagnostics.exe')),c=fs.readFileSync(path.join(dir,'Foxmail-dark-reveal.exe')),meta=read('Foxmail-dark-reveal.exe.json');
function sections(x){const pe=x.readUInt32LE(60),op=pe+24,so=op+x.readUInt16LE(pe+20);return Array.from({length:x.readUInt16LE(pe+6)},(_,i)=>{const p=so+i*40;return{name:x.toString('ascii',p,p+8).replace(/\0/g,''),rva:x.readUInt32LE(p+12),raw:x.readUInt32LE(p+20),size:x.readUInt32LE(p+16)};});}
const orig=sections(b),after=sections(c),allowed=new Set();for(const h of meta.hooks)for(let i=0;i<h.stolenHex.length/2;i++)allowed.add(h.rva+i);
let changed=0;for(const s of orig){const d=after.find(x=>x.name===s.name);if(!d||s.rva!==d.rva||s.size!==d.size)throw Error('Section layout changed');for(let i=0;i<s.size;i++)if(b[s.raw+i]!==c[d.raw+i]){if(s.name!=='CODE'||!allowed.has(s.rva+i))throw Error('Unexpected original section change');changed++;}}
if(changed!==19||allowed.size!==19)throw Error('Expected 7+5+7 code bytes');
for(const h of meta.hooks){const s=after.find(s=>h.rva>=s.rva&&h.rva<s.rva+s.size),at=s.raw+h.rva-s.rva;if(c[at]!==0xe9||h.rva+5+c.readInt32LE(at+1)!==meta.labels[h.name+'_hook'])throw Error('Detour target');}
const fixture=read('native-fixture-run.json'),production=read('production-dll-check-run.json'),bridge=read('emitted-bridge-audit.json');
if(fixture.ExitCode!==0||production.ExitCode!==0||!bridge.passed||bridge.extraCases.length!==10||bridge.entryCases.length!==3)throw Error('Tests incomplete');
const fixtureLog=fs.readFileSync(path.join(dir,'native-fixture-stdout.txt'),'utf8'),prodLog=fs.readFileSync(path.join(dir,'production-dll-check-stdout.txt'),'utf8');
if(!fixtureLog.includes('648 checks, 0 failures')||!prodLog.includes('70 checks, 0 failures'))throw Error('Fixture output mismatch');
const helperHash=sha(path.join(dir,'FoxmailRevealGate.dll'));
if(helperHash!=='9deb8e3881ad7c8736e37bb39aaf8cfa73c92eb9ba873e9189f5c27cd99e18a0'||production.DllSha256.toLowerCase()!==helperHash)throw Error('Unverified helper binary');
const baselinePaths={'Foxmail-dark-reveal.exe':path.join(target,'Foxmail深色.exe'),'FoxmailRevealGate.dll':path.join(target,'FoxmailRevealGate.dll'),'build-info.json':path.join(target,'DarkModeBackup','build-info.json')};
const baselineFiles=Object.fromEntries(Object.entries(baselinePaths).map(([n,p])=>[n,sha(p)]));
if(baselineFiles['Foxmail-dark-reveal.exe']!=='4933a14b617e519610a9e8059fac1a0eb7f42a7146a84a13ad1f75727c20284a'||baselineFiles['FoxmailRevealGate.dll']!=='8ef6557df86f9d2c6c74b1d184b8440fb87c4ab9555bd3ef798befc8b3af23c4')throw Error('Installed v1 mismatch');
const build=JSON.parse(fs.readFileSync(baselinePaths['build-info.json'],'utf8').replace(/^\uFEFF/,''));
build.resultSHA256=meta.candidateSHA256;
build.revealGate={version:2,experimental:true,helper:'FoxmailRevealGate.dll',helperSHA256:helperHash,hooks:meta.hooks,scope:meta.scope,validation:'648 native checks, 70 loaded production DLL checks, 17 emitted bridge/startup cases, exact original-section delta',firstMainRestoreMayBypass:true,settingsRequiresExistingHWND:true,noSleep:true,noStyleChanges:true,cleanup:'Compiled SEH finally and retained owned recovery',watchdog:false,visualResult:'Pending user validation',previousFiles:baselineFiles,build:'reveal-gate-v2/build-native-v2.ps1'};
fs.writeFileSync(path.join(dir,'build-info.json'),JSON.stringify(build,null,2));
const files=Object.fromEntries(Object.keys(baselinePaths).map(n=>[n,sha(path.join(dir,n))]));
const audit={passed:true,changedExistingCodeBytes:changed,allOtherOriginalSectionsIdentical:true,resourcesIdentical:true,hooks:meta.hooks};
fs.writeFileSync(path.join(dir,'emitted-static-delta-audit.json'),JSON.stringify(audit,null,2));
fs.writeFileSync(path.join(dir,'install-plan.json'),JSON.stringify({eligibleForInstall:true,nativeFixturePassed:true,emittedBridgePassed:true,productionExceptionPassed:true,deltaPassed:true,baselineFiles,files},null,2));
console.log(JSON.stringify({passed:true,codeChangedBytes:changed,candidateSHA256:files['Foxmail-dark-reveal.exe'],helperSHA256:helperHash}));
