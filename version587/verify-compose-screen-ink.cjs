'use strict';
// Real static editor/exporter, synthetic content, no clipboard or Foxmail access.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),{spawnSync}=require('child_process'),{pathToFileURL}=require('url');
const paths=require('../foxmail-paths.cjs'),stage=paths.output('version587-compose-screen-ink');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const app='D:/Users/Public/Downloads/Foxmail/7.2.25.587/Template';
const read=p=>{const b=fs.readFileSync(p);return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\ufeff/,'');};
const source=p=>read(path.join(app,p)),body=source('HtmlEditor/Compose/compose_body.html');
const nonce='synthetic587',jsTag=s=>`<script nonce="${nonce}">${s.replaceAll('</script','<\\/script')}</script>`;
let shell=read(path.join(stage,'HtmlEditor.html')).replaceAll('{{random_nonce}}',nonce);
shell=shell.replace(/src="\{\{foxmail_template\}\}(.*?)"/g,(_,p)=>{
 let s=source(p.replaceAll('\\','/'));if(p.endsWith('FoxUtils.js'))s+=';window.__foxLegacyMap=window.Map;window.Map=window.__nativeMap;';
 return 'src="data:text/javascript;base64,'+Buffer.from(s).toString('base64')+'"';
}).replace(/href="\{\{foxmail_template\}\}(.*?)"/g,(_,p)=>'href="data:text/css;base64,'+Buffer.from(source(p.replaceAll('\\','/'))).toString('base64')+'"');
const setup='window.__nativeMap=window.Map;window.__errors=[];window.addEventListener("error",e=>window.__errors.push(String(e.message)));window.J2D_GetMacros=()=>[];for(const n of ["J2D_OnInput","J2D_OnFocus","J2D_OnSelectionChange"])window[n]=()=>{};';
shell=shell.replace(/(<script src=)/,jsTag(setup)+'\r\n$1');
shell=shell.replace('{{css_script_ref_list}}',jsTag(source('HtmlEditor/Compose/compose.js'))).replace('{{body_ref}}',body);
const fixtures=[
 '<div id="divFMContentBody"><p style="color:black;font-family:Arial;background-color:white">Synthetic signature <b>bold</b></p><a href="https://example.invalid/">Example</a><font color="#ffffff">White</font></div>',
 '<div id="divFMContentBody"><table style="border:1px solid #123456"><tbody><tr><td style="color:#abc">Synthetic table</td></tr></tbody></table><img width="8" height="8" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'8\' height=\'8\'%3E%3Cpath fill=\'red\' d=\'M0 0h8v8H0z\'/%3E%3C/svg%3E"></div>',
 '<div id="divFMContentBody"><p>Short test</p><blockquote><p style="color:red">Quoted synthetic text</p></blockquote></div>'
];
const test=`document.addEventListener('DOMContentLoaded',async()=>{let result;try{
 const check=(v,m)=>{if(!v)throw Error(m)},name='foxmail-compose-screen-ink',link=document.getElementById(name);
 check(CSS.highlights&&typeof Highlight==='function','Custom Highlight API unsupported');check(link.media==='screen','Screen-only LINK');
 const fixtures=${JSON.stringify(fixtures)},body=${JSON.stringify(body.replace(/<\/?body[^>]*>/g,''))};let cases=0,editingCases=0;
 const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
 function exportMail(template){window.Map=window.__foxLegacyMap;try{return GetTextAndHtml(g_HtmlEditID,false,false,template)}finally{window.Map=window.__nativeMap}}
 async function sample(active,fixture,plain,template,action){
  document.body.innerHTML=body;link.disabled=!active;
  const h=document.getElementById('fox_html_content'),p=document.getElementById('fox_html_content_plaintext');h.innerHTML=fixture;p.innerText='Synthetic plain text\\nSecond line';g_TextMode=plain;
  await settle();const before=h.innerHTML,firstStyle=document.querySelector('style').outerHTML,normalColor=getComputedStyle(h).color;
  const target=h.querySelector('p')||h,paintColor=getComputedStyle(target,'::highlight('+name+')').color;
  if(active){check(CSS.highlights.has(name),'Highlight registry missing');check(paintColor==='rgb(216, 216, 216)','Highlight foreground rule not active');for(const img of h.querySelectorAll('img'))check(!Array.from(CSS.highlights.get(name)).some(r=>r.intersectsNode(img)),'Image included in highlight');}
  if(action){h.focus();const r=document.createRange();r.selectNodeContents(h);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r);document.execCommand('styleWithCSS',false,true);action();await settle();}
  const colorCommand=document.queryCommandValue('foreColor'),edited=h.innerHTML,exported=exportMail(template);
  return {before,firstStyle,normalColor,colorCommand,edited,after:h.innerHTML,exported};
 }
 for(const fixture of fixtures)for(const template of [false,true])for(const plain of [false,true]){
  const a=await sample(false,fixture,plain,template),b=await sample(true,fixture,plain,template);
  check(JSON.stringify(a)===JSON.stringify(b),'DOM/computed color/actual export changed');check(!!b.exported.html,'Exporter swallowed error');
  check(!JSON.stringify(b.exported).includes(name),'Display rule leaked into export');cases++;
 }
 const actions=[
  ()=>document.execCommand('insertText',false,' typed'),
  ()=>{document.execCommand('insertParagraph');document.execCommand('insertText',false,'New paragraph');},
  ()=>{document.execCommand('foreColor',false,'#c00000');document.execCommand('insertText',false,'Red input');},
  ()=>document.execCommand('insertHTML',false,'<span style="color:#123456">Pasted formatted text</span>'),
  ()=>{document.execCommand('insertText',false,' undo');document.execCommand('undo');},
  ()=>{document.execCommand('bold');document.execCommand('insertText',false,' bold');}
 ];
 for(const action of actions){const fixture='<p style="color:rgb(0, 0, 0)">Original black</p>';
  const a=await sample(false,fixture,false,false,action),b=await sample(true,fixture,false,false,action);
  check(JSON.stringify(a)===JSON.stringify(b),'Native editing generated different HTML');editingCases++;
 }
 document.body.innerHTML=body;link.disabled=false;const h=document.getElementById('fox_html_content');h.innerHTML='<p style="color:black;font:48px Arial">Black text stays black in HTML</p><p style="color:red;font:32px Arial">Red text stays red in HTML</p>';
 await settle();const tail=document.createElement('p');tail.textContent='New endpoint text';h.appendChild(tail);await settle();
 const ranges=Array.from(CSS.highlights.get(name));check(ranges.some(r=>r.startContainer===tail.firstChild&&r.endContainer===tail.firstChild&&r.endOffset===tail.firstChild.length),'Appended endpoint excluded');
 const dom=h.innerHTML;window.dispatchEvent(new Event('beforeprint'));check(!CSS.highlights.has(name),'Print highlight not removed');window.dispatchEvent(new Event('afterprint'));check(CSS.highlights.has(name),'Screen highlight not restored');check(dom===h.innerHTML,'Print altered content');
 check(window.__errors.length===0,'Application script errors: '+window.__errors.join(';'));
 result={passed:true,exportCases:cases,editingCases,normalElementColorAndCommandsIdentical:true,bodyAndExportIdentical:true,firstStylePreserved:true,rangeEndpointUpdated:true,beforeAfterPrintIsolated:true,clipboardAccess:false,syntheticOnly:true,browser:'Installed Edge, isolated headless profile',limitation:'Does not prove target CEF visual rendering; requires live typing check. Caret remains application-defined.'};
 }catch(e){result={passed:false,error:String(e),errors:window.__errors}}const p=document.createElement('pre');p.id='result';p.textContent=btoa(JSON.stringify(result));document.body.appendChild(p);});`;
shell=shell.replace('</html>',jsTag(test)+'\r\n</html>');
const file=path.join(stage,'synthetic-editor-check.html');fs.writeFileSync(file,shell);
const browser='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';assert(fs.existsSync(browser),'Explicit verification browser not installed');
const run=spawnSync(browser,['--headless=new','--disable-background-networking','--disable-sync','--no-first-run','--disable-extensions','--user-data-dir='+path.join(stage,'browser-profile'),'--dump-dom','--virtual-time-budget=3000',pathToFileURL(file).href],{encoding:'utf8',maxBuffer:4*1024*1024,timeout:30000,windowsHide:true});
if(run.error)throw run.error;assert.equal(run.status,0,'Browser verification failed');
const match=run.stdout.match(/<pre id="result">([A-Za-z0-9+/=]+)<\/pre>/);assert(match,'Browser result missing');
const report=JSON.parse(Buffer.from(match[1],'base64').toString('utf8'));
report.candidateSHA256=sha(fs.readFileSync(path.join(stage,'HtmlEditor.html')));report.verifierSHA256=sha(fs.readFileSync(__filename));
fs.writeFileSync(path.join(stage,'screen-ink-tests.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert(report.passed,report.error);
