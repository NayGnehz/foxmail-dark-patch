'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),vm=require('vm'),paths=require('../foxmail-paths.cjs');
const file=path.join(paths.project,'version587/verify-shell.cjs');let source=fs.readFileSync(file,'utf8');
const replace=(a,b)=>{assert.equal(source.split(a).length,2,'Fixture source window changed');source=source.replace(a,b);};
replace("stage=paths.output('version587-next')","stage=paths.output('version587-goal-paper')");
replace("check(window.__earlyRoot==='rgb(32, 32, 32)','Early root was not dark before blocking application scripts');",'');
// The production rule is on the workspace, deliberately outside exported content.
source=source.replaceAll('getComputedStyle(document.documentElement).backgroundColor','getComputedStyle(document.getElementById("fox_html_content_box")||document.documentElement).backgroundColor');
source=source.replaceAll('rgb(32, 32, 32)','rgb(232, 232, 232)');
replace('earlyRoot:window.__earlyRoot,','workspacePaper:"#E8E8E8",');
vm.runInNewContext(source,{require:require('module').createRequire(file),Buffer,process,console,__dirname:path.dirname(file)},{filename:'actual-export-paper-fixture.cjs'});
