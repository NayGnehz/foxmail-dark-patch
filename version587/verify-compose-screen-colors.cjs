'use strict';
// Reuse the real-editor harness while replacing only candidate-specific checks.
// Fixed source hash makes these adaptations reviewable, never an unguarded eval.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert'),vm=require('vm');
const paths=require('../foxmail-paths.cjs'),stage=paths.output('version587-compose-screen-colors');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const harnessFile=path.join(__dirname,'verify-compose-screen-ink.cjs'),harness=fs.readFileSync(harnessFile);
assert.equal(sha(harness),'e3f1d96ea4e34aa6590bfe0e5ce640876c2d4ddf075236ba29b096f85cc55975');
let code=harness.toString();
function replace(before,after){assert.equal(code.split(before).length,2,'Exact harness adaptation: '+before.slice(0,80));code=code.replace(before,after);}
replace("paths.output('version587-compose-screen-ink')","paths.output('version587-compose-screen-colors')");
replace("name='foxmail-compose-screen-ink',link=document.getElementById(name)","name='foxmail-compose-colour-',link=document.getElementById('foxmail-compose-screen-colors')");
replace("const settle=()=>new Promise(resolve=>setTimeout(resolve,0));",`const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
 function enabled(active){link.disabled=!active;for(const s of document.adoptedStyleSheets)s.disabled=!active;}
 function painted(element){const node=element.firstChild;for(const [key,highlight] of CSS.highlights)if(key.startsWith(name))for(const r of highlight)if(r.startContainer===node)return getComputedStyle(element,'::highlight('+key+')').color;return getComputedStyle(element).color;}
 function own(){return Array.from(CSS.highlights).filter(([key])=>key.startsWith(name));}
`);
replace('document.body.innerHTML=body;link.disabled=!active;', 'document.body.innerHTML=body;enabled(active);');
replace("if(active){check(CSS.highlights.has(name),'Highlight registry missing');check(paintColor==='rgb(216, 216, 216)','Highlight foreground rule not active');for(const img of h.querySelectorAll('img'))check(!Array.from(CSS.highlights.get(name)).some(r=>r.intersectsNode(img)),'Image included in highlight');}",
 "if(active){check(window.FoxEditorForegroundColors,'Colour adapter missing');for(const img of h.querySelectorAll('img'))for(const [key,highlight] of own())check(!Array.from(highlight).some(r=>r.intersectsNode(img)),'Image included in highlight');}");
replace("document.body.innerHTML=body;link.disabled=false;const h=document.getElementById('fox_html_content');", "document.body.innerHTML=body;enabled(true);const h=document.getElementById('fox_html_content');");
replace("const ranges=Array.from(CSS.highlights.get(name));", "const ranges=own().flatMap(([key,h])=>Array.from(h));");
replace("check(!CSS.highlights.has(name),'Print highlight not removed')", "check(!own().length,'Print highlight not removed')");
replace("check(CSS.highlights.has(name),'Screen highlight not restored')", "check(own().length>0,'Screen highlight not restored')");
replace("check(dom===h.innerHTML,'Print altered content');",`check(dom===h.innerHTML,'Print altered content');
 h.innerHTML='<p id="black" style="color:#000">Black</p><p id="blue" style="color:#0000ff">Blue</p><p id="red" style="color:#ff0000">Red</p><p id="green" style="color:#008000">Green</p><p id="light" style="color:#000;background-color:#fff">White block</p><p id="clear" style="color:transparent">Transparent</p>';
 await settle();const C=FoxEditorForegroundColors,paintPalette={};
 for(const id of ['black','blue','red','green']){const e=document.getElementById(id),original=getComputedStyle(e).color,p=painted(e),expected=C.transform(original,'#202020');check(p===expected.css,'Incorrect colour adaptation: '+id);check(C.contrast(p,'#202020')>=4.5,'Unreadable colour: '+id);paintPalette[id]=p;}
 check(new Set(Object.values(paintPalette)).size===4,'Chromatic colours collapsed to gray');
 check(painted(document.getElementById('light'))==='rgb(0, 0, 0)','White signature block colour altered');
 check(painted(document.getElementById('clear'))==='rgba(0, 0, 0, 0)','Transparent text made visible');
 const black=document.getElementById('black'),r=document.createRange();r.selectNodeContents(black);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));
 check(getComputedStyle(black).caretColor==='rgb(216, 216, 216)','Dark paper caret not light');
 const light=document.getElementById('light');r.selectNodeContents(light);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));
 check(getComputedStyle(light).caretColor==='rgb(0, 0, 0)','White block caret not dark');
 const beforeLifecycle=h.innerHTML;for(let i=0;i<3;i++){window.dispatchEvent(new Event('pagehide'));check(!own().length,'Lifecycle highlight retained');window.dispatchEvent(new Event('pageshow'));check(own().length>0,'Lifecycle highlight not restored');}
 check(h.innerHTML===beforeLifecycle,'Lifecycle changed content');
`);
replace("clipboardAccess:false,syntheticOnly:true,browser:","hueGroupsAndBackgroundsChecked:true,caretDarkAndLightBackdropsChecked:true,lifecycleCleanupChecked:true,clipboardAccess:false,syntheticOnly:true,browser:");
replace("Caret remains application-defined.","Target CEF native close lifecycle and clipboard/drag were not exercised by this browser fixture.");
replace("'screen-ink-tests.json'","'screen-colors-tests.json'");
// Verification report binds this source, the reused harness and exact candidate.
vm.runInNewContext(code,{require,Buffer,console,__filename:__filename},{filename:__filename});
const reportFile=path.join(stage,'screen-colors-tests.json'),report=JSON.parse(fs.readFileSync(reportFile));
const C=require('./editor-foreground-colors.js');let mathCases=0;
for(const bg of ['#000','#202020','#808080','#fff'])for(const r of [0,64,128,192,255])for(const g of [0,64,128,192,255])for(const b of [0,64,128,192,255]){
 const fg={r,g,b,a:1},before=JSON.stringify(fg),out=C.transform(fg,bg);assert(out.meetsContrast);assert(out.contrast>=4.5);assert.equal(JSON.stringify(fg),before);mathCases++;
}
assert.equal(C.transform('#000','#202020').css,'rgb(216, 216, 216)');assert.equal(C.transform('#000','#fff').css,'rgb(0, 0, 0)');
assert.equal(C.transform('transparent','#202020').rgba.a,0);assert.equal(C.transform('#000','rgba(0,0,0,0.5)'),null);
report.harnessSHA256=sha(harness);report.colorMathCases=mathCases;report.colorAlgorithmSHA256=sha(fs.readFileSync(path.join(__dirname,'editor-foreground-colors.js')));
fs.writeFileSync(reportFile,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,mathCases,chromaticAndCaretAndLifecycle:true}));
