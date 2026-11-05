'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/Public/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture='<div id="divFMContentBody"><p id="one" style="color:black">alpha beta gamma</p><p id="two" style="color:rgb(90,10,10)">delta epsilon</p><p id="paper" style="background:white;color:black">white paper</p></div>';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--allow-file-access-from-files']});try{
 const pages=[await browser.newPage(),await browser.newPage()];
 for(const page of pages){await page.goto(pathToFileURL(path.join(__dirname,'contrast-fixture/fixture.html')).href);await page.waitForLoadState('load');}
 await pages[1].evaluate(href=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.nonce='synthetic-csp-test';s.src=href;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);}),pathToFileURL(path.join(__dirname,'editor-display-contrast.js')).href);
 async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
 async function prepare(page){await page.evaluate(html=>{const root=document.getElementById('fox_html_content');root.innerHTML=html;root.focus();const t=document.getElementById('one').firstChild,r=document.createRange();r.setStart(t,5);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);},fixture);await settle(page);}
 const cases=[
 ['enter-new-paragraph',async p=>{await p.keyboard.press('Enter');await p.keyboard.type('new paragraph');}],
 ['insertText-at-caret',async p=>p.evaluate(()=>document.execCommand('insertText',false,' typed'))],
 ['bold-and-type',async p=>{await p.evaluate(()=>document.execCommand('bold'));await p.keyboard.type('BOLD');}],
 ['foreColor-and-type',async p=>{await p.evaluate(()=>document.execCommand('foreColor',false,'#0000ff'));await p.keyboard.type('BLUE');}],
 ['fontName-and-type',async p=>{await p.evaluate(()=>document.execCommand('fontName',false,'Arial'));await p.keyboard.type('FONT');}],
 ['insertHTML-paste-equivalent',async p=>p.evaluate(()=>document.execCommand('insertHTML',false,'<span style="color:rgb(0,0,128)">pasted HTML</span>'))],
 ['cross-color-delete-and-type',async p=>{await p.evaluate(()=>{const r=document.createRange();r.setStart(document.getElementById('one').firstChild,3);r.setEnd(document.getElementById('two').firstChild,4);const s=getSelection();s.removeAllRanges();s.addRange(r);});await p.keyboard.type('replacement');}],
 ['cross-color-bold',async p=>p.evaluate(()=>{const r=document.createRange();r.setStart(document.getElementById('one').firstChild,3);r.setEnd(document.getElementById('two').firstChild,4);const s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand('bold');})],
 ['backspace-join-paragraphs',async p=>{await p.evaluate(()=>{const r=document.createRange();r.setStart(document.getElementById('two').firstChild,0);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);});await p.keyboard.press('Backspace');}]
 ];const results=[];
 for(const [name,action] of cases){const outputs=[];for(const page of pages){await prepare(page);await action(page);await settle(page);outputs.push(await page.evaluate(()=>{const dom=document.getElementById('fox_html_content').innerHTML;window.Map=window.__foxMap;try{return {dom,export:GetTextAndHtml(g_HtmlEditID,false,false,false)};}finally{window.Map=window.__nativeMap;}}));}const identical=JSON.stringify(outputs[0])===JSON.stringify(outputs[1]),polluted=/text-fill-color/i.test(outputs[1].dom);results.push({name,identical,polluted,baseline:outputs[0],candidate:outputs[1]});}
 const report={passed:results.every(x=>x.identical&&!x.polluted),environment:'Isolated Edge file origin with explicit --allow-file-access-from-files; synthetic content only, no clipboard APIs, no Foxmail process',results,copyCutPasteClipboard:'Not exercised: no user/system clipboard access; insertHTML exercises paste-equivalent DOM operation'};fs.writeFileSync(path.join(__dirname,'editor-editing-side-effects.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,results:results.map(({name,identical,polluted})=>({name,identical,polluted}))},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
