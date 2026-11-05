'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const paths=require('../../foxmail-paths.cjs'),app=paths.fixed('cosmetic-a3d3700d'),root=paths.project,output=paths.output('print-candidate');
const native=paths.output('native-print-native-gate'),payload=path.join(output,'payload');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const expectedExe='a3d3700d0c5e60810c4694fb0a49216da65460050c467e359d322183ac8576fb';
const expectedDll='9deb8e3881ad7c8736e37bb39aaf8cfa73c92eb9ba873e9189f5c27cd99e18a0';
const original='54da7a968ad8a12bf80978269edfc57f520af9f19a18e5b78bf48742983dd4df';
const json=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\ufeff/,''));
// Original executable identity stays pinned in the install plan; no live installation reads.
assert.equal(sha(fs.readFileSync(path.join(app,'Foxmail深色.exe'))),expectedExe);
assert.equal(sha(fs.readFileSync(path.join(app,'FoxmailRevealGate.dll'))),expectedDll);
const evidence=json(path.join(output,'reviewed-validation.json'));
assert.equal(evidence.passed,true);assert.equal(evidence.version,'1.3.1-print-candidate');
for(const x of evidence.artifacts)assert.equal(sha(fs.readFileSync(paths.artifact(x.relative))),x.sha256,x.relative+' changed after review');
const files=[];
function stage(relative,data){
 assert(!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..'));
 const baseline=fs.readFileSync(path.join(app,relative));assert(!baseline.equals(data),'No-op payload '+relative);
 const saved=path.join(output,'baseline',relative);fs.mkdirSync(path.dirname(saved),{recursive:true});
 if(fs.existsSync(saved))assert.equal(sha(fs.readFileSync(saved)),sha(baseline),'Local rollback baseline changed');else fs.writeFileSync(saved,baseline);
 const p=path.join(payload,relative);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);
 files.push({relative,baselineSHA256:sha(baseline),candidateSHA256:sha(data),bytes:data.length});
}
stage('Foxmail深色.exe',fs.readFileSync(path.join(native,'Foxmail深色.exe')));
stage('FoxmailRevealGate.dll',fs.readFileSync(path.join(native,'FoxmailRevealGate.dll')));
const template='7.2.25.563/Template/Conversation/mail_frame.html';
const printTest=json(path.join(__dirname,'../print-theme-isolation-validation.json'));
assert(printTest.passed&&printTest.screenUnchanged&&printTest.senderHTMLUnchanged&&printTest.senderColorsAndBackgroundsPreserved);
assert.equal(sha(fs.readFileSync(path.join(app,template))),printTest.sourceTemplateSHA256);
stage(template,fs.readFileSync(path.join(paths.output('print-theme-payload'),'mail_frame.html')));
const metadata=json(path.join(app,'DarkModeBackup/build-info.json'));
metadata.releaseVersion='1.3.1-print-candidate';metadata.resultSHA256=files[0].candidateSHA256;
metadata.printUpdate={baselineExe:expectedExe,baselineDll:expectedDll,helperSHA256:files[1].candidateSHA256,templateSHA256:files[2].candidateSHA256,scope:['Print-only application paper-shell background isolation; original sender colors retained','Exact native TPrintPreviewForm first-show gate; original main/settings routes retained'],limitations:['User confirmation in Foxmail still required','CEF asynchronous PDF generation is not covered by the synchronous gate','Compose/reply/forward flash remains under investigation; editor color changes deferred']};
stage('DarkModeBackup/build-info.json',Buffer.from(JSON.stringify(metadata,null,2)));
const plan={version:'1.3.1-print-candidate',eligibleForInstall:true,target:null,originalSHA256:original,backup:'DarkModeBackup/BeforePrint1.3.1-A3D3700D',fileCount:files.length,files};
fs.writeFileSync(path.join(output,'install-plan.json'),JSON.stringify(plan,null,2));
fs.copyFileSync(path.join(__dirname,'install.ps1'),path.join(output,'install.ps1'));
console.log(JSON.stringify({staged:true,version:plan.version,fileCount:files.length,files:files.map(x=>({relative:x.relative,sha256:x.candidateSHA256}))}));
