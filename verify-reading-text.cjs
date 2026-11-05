'use strict';
const fs=require('fs'),assert=require('assert');
const {chromium}=require('C:/Users/Public/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const bg=[32,32,32];
function parse(s){const m=s.match(/rgba?\(([^)]+)\)/);if(!m)throw Error('Unexpected color '+s);const v=m[1].split(',').map(Number),a=v.length>3?v[3]:1;return v.slice(0,3).map((x,i)=>x*a+bg[i]*(1-a));}
function luminance(v){return v.map(c=>{c/=255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4}).reduce((n,c,i)=>n+c*[0.2126,0.7152,0.0722][i],0);}
function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const bodyHtml=`<div id="body_main"><div class="mail_session" id="mail_session_test"><div class="mail_content_panel"><div class="mail_content_panel_zoom_layout">
<p id="black" style="color:black">Black text</p>
<p id="rgb" style="color:rgb(17,22,29)">Arbitrary dark RGB</p>
<p id="important" style="color:#111 !important">Inline important</p>
<p id="classDark" class="footnote">Class-owned footer</p>
<font id="legacy" color="#17202a">Legacy font</font>
<p id="red" style="color:rgb(90,10,10)">Dark red warning</p>
<p id="navy" style="color:rgb(10,15,80)">Dark navy</p>
<p id="accessible" style="color:rgb(255,153,153)">Readable red warning</p>
<div style="background:white;color:#111"><p id="paper">Black on light paper</p><strong id="paperInherited">Inherited black on light paper</strong></div>
<p style="color:rgb(12,18,24)">Nested <span id="inherited">inherited text</span> <span id="nestedReadable" style="color:rgb(255,153,153)">Readable colored child</span></p>
<p id="alpha" style="color:rgba(80,90,100,.8)">Translucent dark text</p>
<section><p id="range1" style="color:black">Same-color first sibling</p><p id="rangeGap" style="color:rgb(255,153,153)">Protected readable gap</p><p id="range2" style="color:black">Same-color last sibling</p></section>
<section><span id="alternating1" style="color:black">Black</span><span id="alternating2" style="color:rgb(90,10,10)">Red</span><span id="alternating3" style="color:black">Black</span><span id="alternating4" style="color:rgb(90,10,10)">Red</span></section>
<img id="image" alt="Logo" width="120" height="24" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='24'%3E%3Ctext y='18' fill='black'%3ELogo pixels%3C/text%3E%3C/svg%3E">
</div></div></div><div class="mail_session" id="mail_session_second"><div class="mail_content_panel"><div class="mail_content_panel_zoom_layout"><p id="second" style="color:#10161d">Second mail body</p></div></div></div></div>`;
const css='html,body{margin:0;background:#202020;color:#d6d6d6}body{font:15px sans-serif;padding:12px}.footnote{color:#0c1017}.mail_content_panel_zoom_layout{padding:6px}.mail_content_panel{background:#202020}p{margin:5px 0}';
async function snapshot(page){return page.evaluate(()=>{
 const result={};for(const id of ['black','rgb','important','classDark','legacy','red','navy','accessible','nestedReadable','paper','paperInherited','inherited','alpha','range1','rangeGap','range2','alternating1','alternating2','alternating3','alternating4','second']){const e=document.getElementById(id);if(!e)continue;const c=getComputedStyle(e);result[id]={color:c.color,fill:c.webkitTextFillColor};}return result;
});}
async function settle(page){await page.waitForTimeout(240);}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:920,height:700}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent(`<html id="FoxmailClientHTML"><head><style>${css}</style><style id="foxmail-local-dark">/* Must remain the last stylesheet: Foxmail selection code depends on it. */</style></head><body id="FoxmailClientBody">${bodyHtml}</body></html>`);
  const before=await page.locator('body').innerHTML(),baseline=await snapshot(page);
  await page.evaluate(()=>{
   window.__nativeGetComputedStyle=window.getComputedStyle.bind(window);window.__styleReads=0;
   window.getComputedStyle=function(){window.__styleReads++;return window.__nativeGetComputedStyle.apply(window,arguments);};
   window.__events=[];const add=window.addEventListener;window.addEventListener=function(type){window.__events.push(type);return add.apply(this,arguments);};
   window.__rafDurations=[];window.__helperDurations=[];const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=function(callback){return raf(function(t){const begin=performance.now();try{return callback(t);}finally{const elapsed=performance.now()-begin;window.__rafDurations.push(elapsed);if(callback.name==='begin'||callback.name==='batch')window.__helperDurations.push(elapsed);}});};
   window.returnMarker={kind:'untouched'};window.expectedError=new Error('original application error');
   for(const name of ['D2J_ShowMails','D2J_AddMail','D2J_ShowMoreMails','D2J_RemoveMail'])window[name]=function(){return window.returnMarker;};
   window.D2J_UpdateMailBody=function(id,content,attachment){window.lastCall={receiver:this,args:Array.from(arguments)};if(id==='throw-case')throw window.expectedError;if(typeof content==='string')document.querySelector('#mail_session_'+id+' .mail_content_panel_zoom_layout').innerHTML=content;return window.returnMarker;};
   window.D2J_UpdateMail=function(id,header,content){window.lastCall={receiver:this,args:Array.from(arguments)};if(typeof content==='string')document.querySelector('#mail_session_'+id+' .mail_content_panel_zoom_layout').innerHTML=content;return window.returnMarker;};
  });
  // Simulate FoxUtils' incompatible Map during helper initialization, then restore
  // it for Playwright's own remote-object serialization (which needs native Map).
  await page.addScriptTag({content:'var __testNativeMap=window.Map;window.Map=function FoxmailLegacyMap(){this.legacy=true;};\n'+fs.readFileSync(__dirname+'/dark-reading-text.js','utf8')+'\nwindow.Map=__testNativeMap;'});
  await settle(page);
  const adjusted=await snapshot(page);
  for(const id of ['black','rgb','important','classDark','legacy','red','navy','inherited','alpha','range1','range2','alternating1','alternating2','alternating3','alternating4','second'])assert(ratio(parse(adjusted[id].fill),bg)>=4.45,id+' contrast below target: '+JSON.stringify(adjusted[id]));
  assert.deepStrictEqual(adjusted.alternating1,adjusted.alternating3,'same black alternating siblings differ');assert.deepStrictEqual(adjusted.alternating2,adjusted.alternating4,'same red alternating siblings differ');assert.notDeepStrictEqual(adjusted.alternating1,adjusted.alternating2,'alternating hues flattened');
  assert(parse(adjusted.red.fill)[0]>parse(adjusted.red.fill)[1],'dark red hue lost');
  assert(parse(adjusted.navy.fill)[2]>parse(adjusted.navy.fill)[0],'navy hue lost');
  for(const id of ['accessible','nestedReadable','paper','paperInherited','rangeGap'])assert.deepStrictEqual(adjusted[id],baseline[id],id+' should stay unchanged');
  assert.strictEqual(await page.locator('body').innerHTML(),before,'mail HTML changed');
  assert.strictEqual(await page.locator('#image').evaluate(e=>getComputedStyle(e).filter),'none','image filtered');
  assert.strictEqual(await page.evaluate(()=>document.styleSheets[document.styleSheets.length-1].ownerNode.id),'foxmail-local-dark','last stylesheet changed');
  assert.strictEqual(await page.locator('#foxmail-reading-text-contrast').count(),1,'contrast sheet missing or duplicated');
  await page.emulateMedia({media:'print'});
  assert.deepStrictEqual(await snapshot(page),baseline,'print styles changed');
  await page.emulateMedia({media:'screen'});
  await page.screenshot({path:__dirname+'/reading-text-fixture.png'});
  const stable=await page.evaluate(()=>({count:window.__styleReads,rules:document.getElementById('foxmail-reading-text-contrast').textContent,body:document.body.innerHTML}));
  await page.evaluate(()=>{for(let i=0;i<5;i++){window.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('resize'));}});
  await settle(page);
  assert.deepStrictEqual(await page.evaluate(()=>({count:window.__styleReads,rules:document.getElementById('foxmail-reading-text-contrast').textContent,body:document.body.innerHTML})),stable,'scroll or resize causes recalculation');
  assert(!await page.evaluate(()=>window.__events.some(n=>n==='scroll'||n==='resize')),'scroll/resize listeners installed');
  const initialRules=await page.locator('#foxmail-reading-text-contrast').textContent();
  const next='<p id="replacement" style="color:rgb(15,20,25)">Replacement dark text</p>';
  const hook=await page.evaluate(html=>{const receiver={marker:73};const result=window.D2J_UpdateMailBody.call(receiver,'test',html,'attachment-token');return {same:result===window.returnMarker,receiver:window.lastCall.receiver===receiver,args:window.lastCall.args};},next);
  assert.deepStrictEqual(hook,{same:true,receiver:true,args:['test',next,'attachment-token']});
  await settle(page);
  assert(ratio(parse(await page.locator('#replacement').evaluate(e=>getComputedStyle(e).webkitTextFillColor)),bg)>=4.45,'replacement not adjusted');
  assert.strictEqual(await page.locator('#mail_session_test .mail_content_panel_zoom_layout').innerHTML(),next,'replacement HTML modified');
  assert(ratio(parse(await page.locator('#second').evaluate(e=>getComputedStyle(e).webkitTextFillColor)),bg)>=4.45,'other mail lost correction');
  const replacementRules=await page.locator('#foxmail-reading-text-contrast').textContent();assert(replacementRules.length<initialRules.length,'stale rules retained');
  await page.evaluate(html=>window.D2J_UpdateMailBody('test',html,''),next);await settle(page);
  assert(ratio(parse(await page.locator('#replacement').evaluate(e=>getComputedStyle(e).webkitTextFillColor)),bg)>=4.45,'same content re-render lost correction');
  assert.strictEqual(await page.locator('#foxmail-reading-text-contrast').textContent(),replacementRules,'repeated update grows or changes rules');
  assert(await page.evaluate(()=>{try{window.D2J_UpdateMailBody('throw-case','x','')}catch(e){return e===window.expectedError;}return false;}),'original exception changed');
  await page.evaluate(()=>{document.getElementById('mail_session_second').remove();window.D2J_RemoveMail('second');});await settle(page);
  assert(!((await page.locator('#foxmail-reading-text-contrast').textContent()).includes('mail_session_second')),'disconnected mail rules retained');
  assert.strictEqual(await page.evaluate(()=>document.styleSheets[document.styleSheets.length-1].ownerNode.id),'foxmail-local-dark','last stylesheet changed after update');
  const large=Array.from({length:2000},(_,i)=>`<p id="large${i}" style="color:rgb(10,15,20)">Dark mail paragraph ${i}</p>`).join('');
  const hookDuration=await page.evaluate(html=>{window.__rafDurations=[];window.__helperDurations=[];window.__longTasks=[];if(PerformanceObserver.supportedEntryTypes.includes('longtask')){window.__longObserver=new PerformanceObserver(list=>window.__longTasks.push(...list.getEntries().map(e=>e.duration)));window.__longObserver.observe({entryTypes:['longtask']});}const start=performance.now();window.__largeStart=start;window.D2J_UpdateMailBody('test',html,'');return performance.now()-start;},large);
  try{await page.waitForFunction(()=>window.__nativeGetComputedStyle(document.getElementById('large1999')).webkitTextFillColor!=='rgb(10, 15, 20)',null,{timeout:2500});}catch(e){console.error('LARGE DEBUG',errors,await page.evaluate(()=>({frames:window.__rafDurations.length,reads:window.__styleReads,rules:document.getElementById("foxmail-reading-text-contrast").sheet.cssRules.length,firstFill:window.__nativeGetComputedStyle(document.getElementById("large0")).webkitTextFillColor,cssLength:document.getElementById('foxmail-reading-text-contrast').textContent.length,cssEnd:document.getElementById('foxmail-reading-text-contrast').textContent.slice(-250),lastFill:window.__nativeGetComputedStyle(document.getElementById('large1999')).webkitTextFillColor})));throw e;}
  const metrics=await page.evaluate(()=>({hookMs:0,elapsedMs:performance.now()-window.__largeStart,maxObservedRafMs:Math.max(...window.__rafDurations),maxHelperBatchMs:Math.max(...window.__helperDurations),helperBatches:window.__helperDurations.length,maxLongTaskMs:Math.max(0,...window.__longTasks),styleReads:window.__styleReads}));metrics.hookMs=hookDuration;
  assert.strictEqual(await page.locator('#mail_session_test .mail_content_panel_zoom_layout').innerHTML(),large,'large mail HTML mutated');
  for(const index of [0,999,1999])assert(ratio(parse(await page.locator('#large'+index).evaluate(e=>getComputedStyle(e).webkitTextFillColor)),bg)>=4.45,'large paragraph not adapted');
  const readsBefore=await page.evaluate(()=>window.__styleReads);await page.evaluate(()=>{window.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('resize'));});await settle(page);assert.strictEqual(await page.evaluate(()=>window.__styleReads),readsBefore,'large-mail idle scroll/resize causes work');
  console.log('BENCH 2000-text-node mail '+JSON.stringify(metrics));
  assert.deepStrictEqual(errors,[],'page script errors');
  console.log('PASS: dark RGB/class/legacy/important text; red/navy hues; light-paper and readable colors; HTML/images/print untouched; hooks/update cleanup; no scroll/resize work; last stylesheet preserved.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

