'use strict';
// Isolated installed-Edge check, with synthetic content and actual static exporter.
// This is a browser verification dependency, not a portable release build step.
const fs=require('fs'),path=require('path'),assert=require('assert'),{spawnSync}=require('child_process'),{pathToFileURL}=require('url');
const paths=require('../foxmail-paths.cjs'),stage=paths.output('version587-next');
const app='D:/Users/Public/Downloads/Foxmail/7.2.25.587/Template';
const read=p=>{const b=fs.readFileSync(p);return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\ufeff/,'');};
const source=p=>read(path.join(app,p)),body=source('HtmlEditor/Compose/compose_body.html');
const nonce='synthetic587',jsTag=s=>`<script nonce="${nonce}">${s.replaceAll('</script','<\\/script')}</script>`;
let shell=read(path.join(stage,'HtmlEditor.html')).replaceAll('{{random_nonce}}',nonce);
shell=shell.replace(/src="\{\{foxmail_template\}\}(.*?)"/g,(_,p)=>{
 let s=source(p.replaceAll('\\','/'));if(p.endsWith('FoxUtils.js'))s+=';window.__foxLegacyMap=window.Map;window.Map=window.__nativeMap;';
 return 'src="data:text/javascript;base64,'+Buffer.from(s).toString('base64')+'"';
}).replace(/href="\{\{foxmail_template\}\}(.*?)"/g,(_,p)=>'href="data:text/css;base64,'+Buffer.from(source(p.replaceAll('\\','/'))).toString('base64')+'"');
const setup='window.__nativeMap=window.Map;window.__errors=[];window.addEventListener("error",e=>window.__errors.push(String(e.message)));window.J2D_GetMacros=()=>[];for(const n of ["J2D_OnInput","J2D_OnFocus","J2D_OnSelectionChange"])window[n]=()=>{};window.__earlyRoot=getComputedStyle(document.documentElement).backgroundColor;';
// Sample after CSP has been parsed and before the first blocking application script.
shell=shell.replace(/(<script src=)/,jsTag(setup)+'\r\n$1');
shell=shell.replace('{{css_script_ref_list}}',jsTag(source('HtmlEditor/Compose/compose.js'))).replace('{{body_ref}}',body);
const fixtures=[
 '<div id="divFMContentBody"><p style="color:black;font-family:Arial;background-color:white">Synthetic signature <b>bold</b></p><a href="https://example.invalid/">Example</a></div>',
 '<div id="divFMContentBody"><table style="border:1px solid #123456"><tbody><tr><td style="color:#abc">Synthetic table</td></tr></tbody></table></div>',
 '<div id="divFMContentBody"><p>Short test</p><blockquote><p style="color:red">Quoted synthetic text</p></blockquote></div>'
];
const test=`(()=>{let result;try{
 const check=(v,m)=>{if(!v)throw Error(m)},link=document.getElementById('fox-dark-first-canvas');
 check(window.__earlyRoot==='rgb(32, 32, 32)','Early root was not dark before blocking application scripts');
 check(link.media==='screen','Screen-only LINK');
 const fixtures=${JSON.stringify(fixtures)},body=${JSON.stringify(body.replace(/<\/?body[^>]*>/g,''))};let cases=0;
 for(const fixture of fixtures)for(const template of [false,true])for(const plain of [false,true]){
  function sample(active){document.body.innerHTML=body;link.disabled=!active;
   const h=document.getElementById('fox_html_content');h.innerHTML=fixture;document.getElementById('fox_html_content_plaintext').innerText='Synthetic plain text\\nSecond line';g_TextMode=plain;
   const before=h.innerHTML,firstStyle=document.querySelector('style').outerHTML;
   window.Map=window.__foxLegacyMap;let exported;try{exported=GetTextAndHtml(g_HtmlEditID,false,false,template)}finally{window.Map=window.__nativeMap}
   return {exported,before,after:h.innerHTML,firstStyle,root:getComputedStyle(document.documentElement).backgroundColor};
  }
  const a=sample(false),b=sample(true);check(b.root==='rgb(32, 32, 32)','Root active color');check(a.root!=='rgb(32, 32, 32)','Inactive root color');
  check(JSON.stringify(a.exported)===JSON.stringify(b.exported),'Actual exported fields changed');check(!!b.exported.html,'Exporter swallowed error');
  check(a.before===b.before&&a.after===b.after&&a.firstStyle===b.firstStyle,'Content or first STYLE changed');
  check(!JSON.stringify(b.exported).includes('fox-dark-first-canvas'),'UI rule leaked into export');cases++;
 }
 link.disabled=false;link.media='not all';check(getComputedStyle(document.documentElement).backgroundColor!=='rgb(32, 32, 32)','Non-screen media isolation');link.media='screen';
 check(window.__errors.length===0,'Application script errors: '+window.__errors.join(';'));
 result={passed:true,exportCases:cases,earlyRoot:window.__earlyRoot,firstStylePreserved:true,bodyAndExportIdentical:true,screenOnly:true,syntheticOnly:true,browser:'Installed Edge, isolated headless profile',limitations:'CSS/export verification only. Does not prove live Foxmail Chromium compositor first-frame behavior.'};
 }catch(e){result={passed:false,error:String(e),errors:window.__errors}}const p=document.createElement('pre');p.id='result';p.textContent=btoa(JSON.stringify(result));document.body.replaceChildren(p);})()`;
shell=shell.replace('</html>',jsTag(test)+'\r\n</html>');
const file=path.join(stage,'synthetic-shell-check.html');fs.writeFileSync(file,shell);
const browser='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';assert(fs.existsSync(browser),'Explicit verification browser not installed');
const run=spawnSync(browser,['--headless=new','--disable-background-networking','--disable-sync','--no-first-run','--disable-extensions','--user-data-dir='+path.join(stage,'browser-profile'),'--dump-dom','--virtual-time-budget=2000',pathToFileURL(file).href],{encoding:'utf8',maxBuffer:4*1024*1024,timeout:30000,windowsHide:true});
if(run.error)throw run.error;assert.equal(run.status,0,'Browser verification failed');
const match=run.stdout.match(/<pre id="result">([A-Za-z0-9+/=]+)<\/pre>/);assert(match,'Browser result missing');
const report=JSON.parse(Buffer.from(match[1],'base64').toString('utf8'));fs.writeFileSync(path.join(stage,'shell-tests.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert(report.passed,report.error);
