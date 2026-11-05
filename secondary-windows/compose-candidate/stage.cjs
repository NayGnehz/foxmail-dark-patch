'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const paths=require('../../foxmail-paths.cjs'),root=paths.project,app=paths.fixed('compose-rollback-09d9f83f'),output=paths.output('compose-candidate');
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p).toString('utf8').replace(/^\ufeff/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const originalSHA='54da7a968ad8a12bf80978269edfc57f520af9f19a18e5b78bf48742983dd4df',oldExe='09d9f83f23cea414c7147c0bdcd4a85e8584f6f5037eed78d2ce34a752bc0a75',oldDll='b80d31636734f3e8896a66e65e8d851d69a42dfd94539ffcc104c1eb124c7b37';
// Original executable identity remains pinned in the plan; staging reads only fixed development inputs.
assert.equal(sha(read(path.join(app,'Foxmail深色.exe'))),oldExe);assert.equal(sha(read(path.join(app,'FoxmailRevealGate.dll'))),oldDll);
assert.equal(sha(read(path.join(app,'7.2.25.563/Template/Conversation/mail_frame.html'))),'546aa4b8853a51daa6eb789a4866a5330a7274256ad39e4ad603290c4aab32c0');
const native=paths.output('native-compose-native-gate'),n=json(path.join(native,'candidate-validation.json'));
const themeDir=paths.output('compose-initial'),t=json(path.join(themeDir,'startup-background-validation.json'));
assert(n.passed);assert.equal(n.baseline.exeSHA256,oldExe);assert.equal(n.baseline.dllSHA256,oldDll);
assert.equal(n.nativeFixture.failures,0);assert.equal(n.productionDLLFixture.failures,0);assert(n.actualEmittedBridge.passed);
assert.equal(n.candidate.exe,'Foxmail深色.exe');assert.equal(n.candidate.dll,'FoxmailRevealGate.dll');
assert.equal(sha(read(path.join(native,n.candidate.exe))),n.candidate.exeSHA256);assert.equal(sha(read(path.join(native,n.candidate.dll))),n.candidate.dllSHA256);
const bridge=json(path.join(native,'bridge-static-delta.json'));
const baselineExecutable=read(path.join(app,'Foxmail深色.exe')),candidateExecutable=read(path.join(native,'Foxmail深色.exe'));
assert.equal(candidateExecutable.length,baselineExecutable.length);let changedBytes=0;
for(let i=0;i<candidateExecutable.length;i++)if(candidateExecutable[i]!==baselineExecutable[i]){changedBytes++;assert(bridge.allowedRanges.some(([a,b])=>i>=a&&i<b),'Unexpected executable delta');}
assert.equal(changedBytes,17);assert.equal(bridge.virtualSizeBefore,825);assert.equal(bridge.virtualSizeAfter,835);
assert(t.passed&&t.originalBOMAndOtherBytesPreserved&&t.finalBodyBackgroundEqual&&t.existingBackgroundSetterPreserved);
assert.equal(t.actualGetTextAndHtmlCases,13);assert.equal(t.scriptErrors.length,0);
const body=read(path.join(app,t.relative)),newBody=read(path.join(themeDir,'payload/compose_body.html'));
assert.equal(sha(body),t.baselineSHA256);assert.equal(sha(newBody),t.candidateSHA256);
const needle=Buffer.from('<body>'),replacement=Buffer.from('<body style="background-color: #202020">'),pos=body.indexOf(needle);
assert(pos>=0&&Buffer.concat([body.subarray(0,pos),replacement,body.subarray(pos+needle.length)]).equals(newBody));
const files=[];
function stage(relative,data){
 assert(!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..'));
 const baseline=read(path.join(app,relative)),saved=path.join(output,'baseline',relative),dest=path.join(output,'payload',relative);
 assert(!baseline.equals(data));fs.mkdirSync(path.dirname(saved),{recursive:true});fs.mkdirSync(path.dirname(dest),{recursive:true});
 if(fs.existsSync(saved))assert(read(saved).equals(baseline));else fs.writeFileSync(saved,baseline);
 fs.writeFileSync(dest,data);files.push({relative,baselineSHA256:sha(baseline),candidateSHA256:sha(data),bytes:data.length});
}
stage('Foxmail深色.exe',read(path.join(native,'Foxmail深色.exe')));stage('FoxmailRevealGate.dll',read(path.join(native,'FoxmailRevealGate.dll')));stage(t.relative,newBody);
const metadata=json(path.join(app,'DarkModeBackup/build-info.json'));
metadata.releaseVersion='1.3.2-compose-candidate';metadata.resultSHA256=files[0].candidateSHA256;
metadata.composeUpdate={baselineExe:oldExe,baselineDll:oldDll,helperSHA256:files[1].candidateSHA256,templateSHA256:t.candidateSHA256,scope:['Exact TFoxComposeForm synchronous Show gate; no ShowModal or waiting for CEF','Initial document body color #202020 before unchanged InitFoxEditor; no change to final editor palette or sent HTML'],userValidatedPrior:'User reports printing fixed on1.3.1; print template and gate retained',limitation:'Candidate visual flash efficacy not yet validated by user'};
stage('DarkModeBackup/build-info.json',Buffer.from(JSON.stringify(metadata,null,2)));
const backup='DarkModeBackup/BeforeCompose1.3.2-09D9F83F';
fs.writeFileSync(path.join(output,'install-plan.json'),JSON.stringify({version:'1.3.2-compose-candidate',eligibleForInstall:true,target:null,originalSHA256:originalSHA,backup,fileCount:files.length,files},null,2));
const restore=json(path.join(root,'cosmetic-1.3/pristine-restore-plan.json'));
assert(!restore.files.some(f=>f.relative.replace(/\\/g,'/')===t.relative));
restore.files.push({relative:t.relative,source:backup.replace('DarkModeBackup/','')+'/'+t.relative,SHA256:t.baselineSHA256});
fs.writeFileSync(path.join(output,'pristine-restore-plan.json'),JSON.stringify(restore,null,2));
fs.writeFileSync(path.join(output,'restore-pristine.ps1'),read(path.join(__dirname,'restore-pristine.ps1')));
const review={passed:true,version:'1.3.2-compose-candidate',files,changedExecutableBytes:changedBytes,sourceReports:['secondary-windows/compose-native-gate/candidate-validation.json','secondary-windows/compose-initial/startup-background-validation.json'],review:'Exact native class/VMT and owned-release failure paths reviewed; template sole attribute insertion verified byte-for-byte; editor final state and sent HTML compared through actual application export.',actualFoxmailVisualValidation:false};
fs.writeFileSync(path.join(output,'reviewed-validation.json'),JSON.stringify(review,null,2));
fs.copyFileSync(path.join(__dirname,'install.ps1'),path.join(output,'install.ps1'));
console.log(JSON.stringify({staged:true,version:review.version,files:files.map(f=>({relative:f.relative,sha256:f.candidateSHA256}))}));
