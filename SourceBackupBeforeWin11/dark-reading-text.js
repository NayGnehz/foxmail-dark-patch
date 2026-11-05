/* Reading-display contrast only. Mail HTML, image pixels and print CSS stay intact. */
(function () {
  'use strict';
  if (window.__foxmailReadingContrast) return;
  window.__foxmailReadingContrast = true;
  // FoxUtils.js defines its own incompatible global Map. Keep this small store local.
  function Map(){this.pairs=[];}
  Map.prototype.get=function(key){for(var i=0;i<this.pairs.length;i++)if(this.pairs[i][0]===key)return this.pairs[i][1];};
  Map.prototype.has=function(key){for(var i=0;i<this.pairs.length;i++)if(this.pairs[i][0]===key)return true;return false;};
  Map.prototype.set=function(key,value){this.delete(key);this.pairs.push([key,value]);};
  Map.prototype.delete=function(key){for(var i=0;i<this.pairs.length;i++)if(this.pairs[i][0]===key){this.pairs.splice(i,1);return;}};
  Map.prototype.forEach=function(fn){this.pairs.slice().forEach(function(pair){fn(pair[1],pair[0]);});};
  var records = new Map(), dirtyIds = new Set(), allDirty = false;
  var scheduled = false, generation = 0, styleNode = null;
  var rootQuery = '.mail_content_panel .mail_content_panel_zoom_layout';
  var skipped = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION|SVG|CANVAS)$/;
  function rgba(value) {
    var m = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(value || '');
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  }
  function blend(a, b) { var k = a[3]; return [a[0]*k+b[0]*(1-k),a[1]*k+b[1]*(1-k),a[2]*k+b[2]*(1-k),1]; }
  function lum(a) { var v=a.slice(0,3).map(function(x){x/=255;return x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4);});return v[0]*0.2126+v[1]*0.7152+v[2]*0.0722; }
  function contrast(a,b) { var x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
  function colorText(a) { return 'rgba('+a.slice(0,3).map(Math.round).join(',')+','+a[3]+')'; }
  function improve(fg, bg) {
    if (lum(bg) > 0.20 || contrast(blend(fg,bg),bg) >= 4.5) return null;
    // Blend toward white, preserving hue/channel order and alpha. Use stronger
    // contrast for small footnotes; translucent text is limited by its alpha.
    var white=[255,255,255,fg[3]];
    var target=Math.min(7.05,contrast(blend(white,bg),bg));
    if(target<=contrast(blend(fg,bg),bg))return null;
    var lo=0,hi=1;
    for(var i=0;i<12;i++){var t=(lo+hi)/2,c=[fg[0]+(255-fg[0])*t,fg[1]+(255-fg[1])*t,fg[2]+(255-fg[2])*t,fg[3]];if(contrast(blend(c,bg),bg)<target)lo=t;else hi=t;}
    return [Math.ceil(fg[0]+(255-fg[0])*hi),Math.ceil(fg[1]+(255-fg[1])*hi),Math.ceil(fg[2]+(255-fg[2])*hi),fg[3]];
  }
  function ensureStyle() {
    if(styleNode && styleNode.isConnected)return;
    styleNode=document.createElement('style');styleNode.id='foxmail-reading-text-contrast';styleNode.media='screen';
    // Main.js owns the LAST stylesheet for temporary selection rules.
    var anchor=document.getElementById('foxmail-local-dark');
    document.head.insertBefore(styleNode,anchor||document.head.firstChild);
  }
  function publish() {
    ensureStyle();var css=[];
    records.forEach(function(record,root){if(!root.isConnected){records.delete(root);return;}if(record.css)css.push(record.css);});
    styleNode.textContent=css.join('\n');
  }
  function stateFor(root) {
    var styles=new WeakMap(), backgrounds=new WeakMap(), paths=new WeakMap(), childIndices=new WeakMap(), indexedParents=new WeakSet(), seen=new Set(), items=[];
    var session=root.closest('.mail_session[id]');
    if(!session)return null;
    var rootList=session.querySelectorAll(rootQuery);
    function childIndex(el){var parent=el.parentElement;if(!indexedParents.has(parent)){for(var i=0;i<parent.children.length;i++)childIndices.set(parent.children[i],i+1);indexedParents.add(parent);}return childIndices.get(el);}
    // app-generated session id plus a path to the existing root; no marker attrs.
    var base='#FoxmailClientBody #'+CSS.escape(session.id)+' '+rootQuery;
    if(rootList.length!==1){var chain=[],p=root;while(p&&p!==session){chain.unshift(':nth-child('+childIndex(p)+')');p=p.parentElement;}base='#FoxmailClientBody #'+CSS.escape(session.id)+' > '+chain.join(' > ');}
    paths.set(root,base);
    function snapshot(el) {var s=styles.get(el);if(!s){var c=getComputedStyle(el);s={fg:rgba(c.webkitTextFillColor)||rgba(c.color),bg:rgba(c.backgroundColor),image:c.backgroundImage};styles.set(el,s);}return s;}
    function background(el) {var cached=backgrounds.get(el);if(cached)return cached;var s=snapshot(el),parent=el.parentElement,under=parent?background(parent):{rgb:[30,34,40,1],uncertain:false};var bg=s.bg||[0,0,0,0];var result={rgb:blend(bg,under.rgb),uncertain:s.image!=='none'||(bg[3]<1&&under.uncertain)};backgrounds.set(el,result);return result;}
    function path(el) {var p=paths.get(el);if(p)return p;p=path(el.parentElement)+' > :nth-child('+childIndex(el)+')';paths.set(el,p);return p;}
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    return {root:root,walker:walker,seen:seen,items:items,read:function(node){
      if(!node.nodeValue.trim())return;
      var el=node.parentElement;if(!el||seen.has(el))return;seen.add(el);
      if(skipped.test(el.tagName)||el.closest('svg,canvas,textarea,input,select,[contenteditable="true"]'))return;
      var s=snapshot(el);if(!s.fg)return;var bg=background(el);
      items.push({el:el,fg:s.fg,next:bg.uncertain?null:improve(s.fg,bg.rgb)});
    },finish:function(){
      var changed=new Set(),groups=Object.create(null);items.forEach(function(x){if(x.next)changed.add(x.el);});
      items.forEach(function(x){var active=!!x.next,p=x.el.parentElement;while(!active&&p&&root.contains(p)){active=changed.has(p);p=p.parentElement;}if(!active)return;
        var color=colorText(x.next||x.fg);if(!groups[color])groups[color]=[];groups[color].push(x.el);
      });
      function compress(elements){
        var buckets=new WeakMap(),parents=[],selectors=[];
        elements.forEach(function(el){if(el===root){selectors.push(path(root));return;}var parent=el.parentElement,bucket=buckets.get(parent);if(!bucket){bucket=[];buckets.set(parent,bucket);parents.push(parent);}bucket.push(childIndex(el));});
        parents.forEach(function(parent){var indices=buckets.get(parent);indices.sort(function(a,b){return a-b;});var prefix=path(parent)+' > ';
          if(indices.length===parent.children.length){selectors.push(prefix+'*');return;}
          for(var i=0;i<indices.length;i++){var first=indices[i],last=first;while(i+1<indices.length&&indices[i+1]===last+1)last=indices[++i];
            selectors.push(prefix+(first===last?':nth-child('+first+')':':nth-child(n+'+first+'):nth-child(-n+'+last+')'));
          }
        });return selectors;
      }
      // Chromium limits the complexity of a single selector list. Keep rules
      // small even when a very long mail has thousands of same-colored lines.
      var css=[];Object.keys(groups).forEach(function(color){var selectors=compress(groups[color]);for(var i=0;i<selectors.length;i+=64)css.push(selectors.slice(i,i+64).join(',\n')+'{color:'+color+' !important;-webkit-text-fill-color:'+color+' !important;}');});
      return {css:css.join('\n')};
    }};
  }
  function begin() {
    scheduled=false;var token=generation,roots=document.querySelectorAll(rootQuery),jobs=[];
    records.forEach(function(record,root){if(!root.isConnected)records.delete(root);});
    for(var i=0;i<roots.length;i++){var root=roots[i],session=root.closest('.mail_session[id]');if(!session)continue;
      if(allDirty||dirtyIds.has(session.id)||!records.has(root)){records.delete(root);var state=stateFor(root);if(state)jobs.push(state);}
    }
    allDirty=false;dirtyIds.clear();
    // Remove only outdated rules before measuring original incoming colors.
    // Each batch below performs reads only; the complete result is published once.
    publish();var at=0;
    function batch(){
      if(token!==generation)return;
      var started=performance.now(),reads=0;
      while(at<jobs.length){var node=jobs[at].walker.nextNode();if(!node){at++;continue;}jobs[at].read(node);reads++;
        if(reads>=150||performance.now()-started>=6){requestAnimationFrame(batch);return;}
      }
      if(token!==generation)return;
      jobs.forEach(function(job){if(job.root.isConnected)records.set(job.root,job.finish());});publish();
    }
    requestAnimationFrame(batch);
  }
  function schedule(id,reset) {generation++;if(reset)allDirty=true;if(id!==undefined&&id!==null)dirtyIds.add('mail_session_'+id);if(!scheduled){scheduled=true;requestAnimationFrame(begin);}}
  function wrap(name,mode) {var fn=window[name];if(typeof fn!=='function')return;window[name]=function(){try{return fn.apply(this,arguments);}finally{schedule(mode==='one'?arguments[0]:null,mode==='all');}};}
  wrap('D2J_ShowMails','all');
  ['D2J_AddMail','D2J_ShowMoreMails','D2J_RemoveMail'].forEach(function(name){wrap(name,'new');});
  ['D2J_UpdateMail','D2J_UpdateMailBody','D2J_SetLoadingBody','D2J_SetRetryLoadBody'].forEach(function(name){wrap(name,'one');});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule(null,true);},{once:true});else schedule(null,true);
}());
