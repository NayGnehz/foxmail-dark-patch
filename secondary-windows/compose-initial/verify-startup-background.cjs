'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {chromium}=require('C:/Users/Public/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pngDecode}=require('../../recolor-search-scrollbars.cjs');
const app='D:/Users/Public/Downloads/Foxmail/7.2.25.563/Template';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const decode=b=>b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\ufeff/,'');
const source=rel=>decode(fs.readFileSync(path.join(app,rel)));
const relative='HtmlEditor/Compose/compose_body.html',raw=fs.readFileSync(path.join(app,relative)),body=decode(raw);
assert.equal((body.match(/<body>/g)||[]).length,1);assert(!/<body[^>]+style=/i.test(body));
const patched=body.replace('<body>','<body style="background-color: #202020">');
const encoding=raw[0]===255?'utf16le':'utf8',needle=Buffer.from('<body>',encoding),at=raw.indexOf(needle);
assert(at>=0);const candidate=Buffer.concat([raw.subarray(0,at),Buffer.from('<body style="background-color: #202020">',encoding),raw.subarray(at+needle.length)]);
assert.equal(decode(candidate),patched);assert(candidate.subarray(0,at).equals(raw.subarray(0,at)));
assert(candidate.includes(Buffer.from('#202020',raw[0]===255?'utf16le':'utf8')));
assert.equal(patched.replace('<body style="background-color: #202020">','<body>'),body);
fs.mkdirSync(path.join(__dirname,'payload'),{recursive:true});fs.writeFileSync(path.join(__dirname,'payload/compose_body.html'),candidate);
const fixture='<div id="divFMContentBody"><p id="one" style="color:black">alpha beta gamma</p><p id="two" style="color:rgb(90,10,10)">delta epsilon</p><p id="paper" style="background:white;color:black">white paper</p><font color="#116633">legacy green</font></div>';
const errors=[],results=[];
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const pages=[await browser.newPage({viewport:{width:800,height:600}}),await browser.newPage({viewport:{width:800,height:600}})];
 const startup=[];
 for(let i=0;i<2;i++){
  const p=pages[i];p.on('pageerror',e=>errors.push(String(e)));
  await p.setContent('<html><head><link rel="stylesheet" href="data:text/css,'+encodeURIComponent(source('HtmlEditor/Common/Base.css'))+'"></head>'+[body,patched][i]+'</html>');
  const png=pngDecode(await p.screenshot());const at=(590*png.width+790)*4;
  startup.push({bodyBackground:await p.evaluate(()=>getComputedStyle(document.body).backgroundColor),canvasPixel:Array.from(png.rgba.subarray(at,at+3))});
  await p.evaluate(()=>{window.__nativeMapForTest=window.Map;window.J2D_GetWindowColor=()=>'#202020';window.J2D_GetMacros=()=>[];for(const n of ['J2D_OnInput','J2D_OnFocus','J2D_OnSelectionChange'])window[n]=()=>{};});
  for(const rel of ['Common/Javascript/jquery-1.9.1.min.js','Common/Javascript/FoxUtils.js','HtmlEditor/Common/editor-base.js','HtmlEditor/Compose/compose.js'])await p.addScriptTag({content:source(rel)+(rel.includes('FoxUtils')?';window.__foxLegacyMap=window.Map;':'')+';window.Map=window.__nativeMapForTest;'});
  await p.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==='rgb(32, 32, 32)');
 }
 assert.deepStrictEqual(startup[0].canvasPixel,[255,255,255]);assert.deepStrictEqual(startup[1].canvasPixel,[32,32,32]);
 async function prepare(p){await p.evaluate(html=>{g_TextMode=false;const h=document.getElementById('fox_html_content');h.innerHTML=html;h.focus();const r=document.createRange();r.setStart(document.getElementById('one').firstChild,5);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);},fixture);}
 async function exportState(p,template=false,plain=false){return p.evaluate(({template,plain})=>{g_TextMode=plain;document.getElementById('fox_html_content_plaintext').innerText='Synthetic plain text\nSecond line';const h=document.getElementById('fox_html_content'),styles=Array.from(document.querySelectorAll('style')).map(s=>s.outerHTML);window.Map=window.__foxLegacyMap;let output;try{output=GetTextAndHtml(g_HtmlEditID,false,false,template);}finally{window.Map=window.__nativeMapForTest;}return {output,content:h.innerHTML,styles,background:getComputedStyle(document.body).backgroundColor};},{template,plain});}
 for(const template of [false,true])for(const plain of [false,true]){const states=[];for(const p of pages){await prepare(p);states.push(await exportState(p,template,plain));}assert.deepStrictEqual(states[0],states[1]);results.push({name:'export-'+template+'-'+plain,identical:true});}
 const actions=[
 ['enter-new-paragraph',async p=>{await p.keyboard.press('Enter');await p.keyboard.type('new paragraph');}],
 ['insertText',p=>p.evaluate(()=>document.execCommand('insertText',false,' typed'))],
 ['bold-and-type',async p=>{await p.evaluate(()=>document.execCommand('bold'));await p.keyboard.type('BOLD');}],
 ['foreColor-and-type',async p=>{await p.evaluate(()=>document.execCommand('foreColor',false,'#0000ff'));await p.keyboard.type('BLUE');}],
 ['fontName-and-type',async p=>{await p.evaluate(()=>document.execCommand('fontName',false,'Arial'));await p.keyboard.type('FONT');}],
 ['insertHTML',p=>p.evaluate(()=>document.execCommand('insertHTML',false,'<span style="color:navy">pasted HTML</span>'))],
 ['cross-color-replacement',async p=>{await p.evaluate(()=>{const r=document.createRange();r.setStart(document.getElementById('one').firstChild,3);r.setEnd(document.getElementById('two').firstChild,4);const s=getSelection();s.removeAllRanges();s.addRange(r);});await p.keyboard.type('replacement');}],
 ['cross-color-bold',p=>p.evaluate(()=>{const r=document.createRange();r.setStart(document.getElementById('one').firstChild,3);r.setEnd(document.getElementById('two').firstChild,4);const s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand('bold');})],
 ['backspace-join',async p=>{await p.evaluate(()=>{const r=document.createRange();r.setStart(document.getElementById('two').firstChild,0);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);});await p.keyboard.press('Backspace');}]
 ];
 for(const [name,action] of actions){const states=[];for(const p of pages){await prepare(p);await action(p);states.push(await exportState(p));}assert.deepStrictEqual(states[0],states[1],name+' changed editor/export');results.push({name,identical:true});}
 // Existing application background setter continues to override the default.
 for(const color of ['#ffffff','#aabbcc','transparent','#202020']){
  const states=[];for(const p of pages){await p.evaluate(color=>D2J_SetBackgroundColor(color),color);states.push(await exportState(p));}assert.deepStrictEqual(states[0],states[1]);
 }
 assert.deepStrictEqual(errors,[]);
 const report={passed:true,installed:false,relative:'7.2.25.563/Template/'+relative,baselineSHA256:sha(raw),candidateSHA256:sha(candidate),encoding,originalBOMAndOtherBytesPreserved:true,soleDelta:'body opening tag gains initialbackground-color #202020; no inner message element, stylesheet, script, content, font or final display-color change',startup,finalBodyBackgroundEqual:true,existingBackgroundSetterPreserved:true,actualGetTextAndHtmlCases:results.length,results,scriptErrors:errors,limitations:['Isolated Edge with static application JS and synthetic content; no real mail/signatures read or printed','Confirms an HTML pre-initialization blank-canvas path; not proof all actual Foxmail flashes use this path','Native controls and browser first-surface/layout remain separate'],proof:'Existing InitFoxEditor still sets bodybackground from J2D_GetWindowColor; the new attribute only supplies the same expected color sooner.'};
 fs.writeFileSync(path.join(__dirname,'startup-background-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,cases:results.length,startup,baselineSHA256:sha(raw),candidateSHA256:sha(candidate)}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
