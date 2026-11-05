'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {chromium}=require('C:/Users/Public/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const app='D:/Users/Public/Downloads/Foxmail/7.2.25.563/Template';
const source=rel=>{const b=fs.readFileSync(path.join(app,rel));return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\ufeff/,'');};
const css=fs.readFileSync(path.join(__dirname,'editor-screen-scrollbars.css'),'utf8').replace(/^\ufeff/,'');
const base=source('HtmlEditor/Common/Base.css'),html=source('HtmlEditor/Common/HtmlEditor.html'),body=source('HtmlEditor/Compose/compose_body.html');
assert(html.includes('HtmlEditor\\Common\\Base.css'));assert(!/<style/i.test(css));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:800,height:600}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 // A LINK keeps UI CSS outside the application's first-STYLE export rule.
 await page.setContent('<html><head><link id="screen-css" rel="stylesheet" href="data:text/css,'+encodeURIComponent(base)+'"></head>'+body+'</html>');
 await page.evaluate(()=>{window.__nativeMapForTest=window.Map;window.J2D_GetMacros=()=>[];for(const n of ['J2D_OnInput','J2D_OnFocus','J2D_OnSelectionChange'])window[n]=()=>{};});
 for(const rel of ['Common/Javascript/jquery-1.9.1.min.js','Common/Javascript/FoxUtils.js','HtmlEditor/Common/editor-base.js','HtmlEditor/Compose/compose.js'])await page.addScriptTag({content:source(rel)+(rel.includes('FoxUtils')?';window.__foxLegacyMap=window.Map;':'')+';window.Map=window.__nativeMapForTest;'});
 const fixtures=[
  '<div id="divFMContentBody"><p style="color:black;font-family:Arial;background-color:white">Synthetic signature <b>bold</b></p><a href="https://example.invalid/">Example</a></div>',
  '<div id="divFMContentBody"><table style="border:1px solid #123456"><tbody><tr><td style="color:#abc">Synthetic table</td></tr></tbody></table></div>',
  '<div id="divFMContentBody"><p>Short test</p><blockquote><p style="color:red">Quoted synthetic text</p></blockquote></div>'
 ];const results=[];
 for(const fixture of fixtures)for(const template of [false,true])for(const plain of [false,true]){
  async function sample(patched){return page.evaluate(({fixture,template,plain,style,bodyTemplate})=>{ document.body.innerHTML=bodyTemplate;
   document.querySelector('#screen-css').href='data:text/css,'+encodeURIComponent(style);
   const h=document.getElementById('fox_html_content'),p=document.getElementById('fox_html_content_plaintext');h.innerHTML=fixture;p.innerText='Synthetic plain text\nSecond line';g_TextMode=plain;
   const contentBefore=h.innerHTML,stylesBefore=Array.from(document.querySelectorAll('style')).map(s=>s.outerHTML),result=(()=>{window.Map=window.__foxLegacyMap;try{return GetTextAndHtml(g_HtmlEditID,false,false,template);}finally{window.Map=window.__nativeMapForTest;}})();
   const track=getComputedStyle(document.documentElement,'::-webkit-scrollbar-track').backgroundColor;
   return {result,contentBefore,contentAfter:h.innerHTML,stylesBefore,stylesAfter:Array.from(document.querySelectorAll('style')).map(s=>s.outerHTML),track};
  },{fixture,template,plain,bodyTemplate:body.replace(/<\/?body>/g,''),style:base+(patched?'\n'+css:'')});}
  const a=await sample(false),b=await sample(true);assert(a.result.html&&b.result.html,'Exporter returned empty result');assert.deepStrictEqual(a.result,b.result,'Exported html/text/css/resources changed');assert.strictEqual(a.contentBefore,b.contentBefore);assert.strictEqual(a.contentAfter,b.contentAfter);assert.deepStrictEqual(a.stylesBefore,b.stylesBefore);assert.deepStrictEqual(a.stylesAfter,b.stylesAfter);assert.strictEqual(b.track,'rgb(32, 32, 32)');assert(!JSON.stringify(b.result).includes('webkit-scrollbar'));
  results.push({template,plain,exportedBytes:JSON.stringify(b.result).length});
 }
 await page.emulateMedia({media:'print'});const printTrack=await page.evaluate(()=>getComputedStyle(document.documentElement,'::-webkit-scrollbar-track').backgroundColor);assert.notStrictEqual(printTrack,'rgb(32, 32, 32)');
 assert.deepStrictEqual(errors,[]);const report={passed:true,source:'Actual installed static application scripts and synthetic fixtures; isolated headless Edge, no Foxmail process opened',cases:results.length,results,printTrack,scriptErrors:errors,proof:['Editor UI Base.css is linked in HtmlEditor.html, outside editable content','GetTextAndHtml clones only #fox_html_content or plaintext and exports first STYLE node; LINK sheets excluded','Actual GetTextAndHtml outputs html, text, cssText and resource lists identical before/after in signature/template, rich and plain modes','Only root/body/wrapper scrollbar pseudo-elements targeted; editable text/image/background CSS untouched','@media screen disables all changes for print']};fs.writeFileSync(path.join(__dirname,'editor-scrollbar-export-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});





