/* REJECTED RESEARCH CANDIDATE: DO NOT INSTALL. Editing merges serialize text fill. See editor-display-contrast-decision.json. */
/* Editor display only. Adds CSSOM rules to the existing external Base.css LINK.
 * Never changes an editable node, HTML, color, default font or export function. */
(function () {
  'use strict';
  if (window.__foxmailEditorDisplayContrast) return;
  var rootsQuery = '#fox_html_content, #fox_html_content_plaintext';
  var scope = '#fox_html_content, #fox_html_content *, #fox_html_content_plaintext, #fox_html_content_plaintext *';
  var skipped = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION|SVG|CANVAS|IMG|VIDEO|AUDIO|IFRAME|OBJECT)$/;
  var media = null, sheet = null, pending = false, observer = null, stopped = false;
  var last = {runs:0,elements:0,adjusted:0,uncertain:0,limited:0,rules:0,status:'waiting'};
  function rgba(s) {var m=/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(s||'');return m?[+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]]:null;}
  function blend(a,b) {var t=a[3];return [a[0]*t+b[0]*(1-t),a[1]*t+b[1]*(1-t),a[2]*t+b[2]*(1-t),1];}
  function luminance(a) {function f(x){x/=255;return x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4);}return .2126*f(a[0])+.7152*f(a[1])+.0722*f(a[2]);}
  function contrast(a,b) {var x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  function hsl(a) {var r=a[0]/255,g=a[1]/255,b=a[2]/255,hi=Math.max(r,g,b),lo=Math.min(r,g,b),l=(hi+lo)/2,d=hi-lo,h=0,s=0;if(d){s=l>.5?d/(2-hi-lo):d/(hi+lo);h=hi===r?(g-b)/d+(g<b?6:0):hi===g?(b-r)/d+2:(r-g)/d+4;h/=6;}return [h,s,l];}
  function rgb(h,s,l,a) {function hue(t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<.5)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;}var q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;return s?[hue(h+1/3)*255,hue(h)*255,hue(h-1/3)*255,a]:[l*255,l*255,l*255,a];}
  function improve(fg,bg) {
    if(luminance(bg)>.20||contrast(blend(fg,bg),bg)>=4.5)return null;
    var v=hsl(fg),white=[255,255,255,fg[3]],max=contrast(blend(white,bg),bg),target=Math.min(7.05,max);
    if(target<=contrast(blend(fg,bg),bg)+.001)return null;
    if(max<4.5)last.limited++;
    var lo=v[2],hi=1;
    for(var i=0;i<16;i++){var m=(lo+hi)/2;if(contrast(blend(rgb(v[0],v[1],m,fg[3]),bg),bg)<target)lo=m;else hi=m;}
    // Ceiling prevents quantization from losing the minimum contrast threshold.
    var out=rgb(v[0],v[1],hi,fg[3]);for(var j=0;j<3;j++)out[j]=Math.min(255,Math.ceil(out[j]));return out;
  }
  function text(a){return 'rgba('+a[0]+','+a[1]+','+a[2]+','+a[3]+')';}
  function acquire() {
    if(media&&sheet&&sheet.ownerNode&&sheet.ownerNode.isConnected)return true;
    var links=document.querySelectorAll('link[rel~="stylesheet"]');
    for(var i=0;i<links.length;i++){
      // Only the original editor UI stylesheet is eligible; no new STYLE node.
      var href=links[i].getAttribute('href')||'';
      if(!/(?:^|[\\/])HtmlEditor[\\/]Common[\\/]Base\.css(?:[?#].*)?$/i.test(href))continue;
      try{var s=links[i].sheet;if(!s)continue;var n=s.insertRule('@media screen {}',s.cssRules.length);sheet=s;media=s.cssRules[n];return true;}catch(e){last.status='stylesheet-inaccessible';return false;}
    }
    return false;
  }
  function clear() {if(media)while(media.cssRules.length)media.deleteRule(media.cssRules.length-1);}
  function run() {
    pending=false;if(stopped)return;
    if(!acquire()){last.status=last.status==='stylesheet-inaccessible'?last.status:'stylesheet-unavailable';return;}
    var roots=document.querySelectorAll(rootsQuery),groups=Object.create(null),styles=new WeakMap(),backgrounds=new WeakMap(),paths=new WeakMap(),indices=new WeakMap(),indexed=new WeakSet();
    last={runs:last.runs+1,elements:0,adjusted:0,uncertain:0,limited:0,rules:0,status:'active'};
    function style(el){var s=styles.get(el);if(!s){var c=getComputedStyle(el);s={fg:rgba(c.color),bg:rgba(c.backgroundColor),image:c.backgroundImage,opacity:+c.opacity,blend:c.mixBlendMode||'normal',filter:c.filter||'none'};styles.set(el,s);}return s;}
    function background(el){var v=backgrounds.get(el);if(v)return v;var c=style(el),parent=el.parentElement,under=parent?background(parent):{rgb:[32,32,32,1],uncertain:false},a=c.bg||[0,0,0,0];v={rgb:blend(a,under.rgb),uncertain:c.image!=='none'||c.opacity<1||c.blend!=='normal'||c.filter!=='none'||(a[3]<1&&under.uncertain)};backgrounds.set(el,v);return v;}
    function index(el){var parent=el.parentElement;if(!indexed.has(parent)){for(var i=0;i<parent.children.length;i++)indices.set(parent.children[i],i+1);indexed.add(parent);}return indices.get(el);}
    function path(el,root){var p=paths.get(el);if(p)return p;p=el===root?'#'+root.id:path(el.parentElement,root)+' > :nth-child('+index(el)+')';paths.set(el,p);return p;}
    var rules=[scope+'{-webkit-text-fill-color:currentColor !important;}'];
    for(var r=0;r<roots.length;r++){
      var root=roots[r],nodes=[root],all=root.querySelectorAll('*');
      if(all.length>4000){last.status='large-document-skipped';continue;}
      for(var n=0;n<all.length;n++)nodes.push(all[n]);
      for(var k=0;k<nodes.length;k++){
        var el=nodes[k];if(skipped.test(el.tagName)||el.closest('svg,canvas,textarea,input,select,video,audio,iframe,object'))continue;
        last.elements++;var c=style(el),bg=background(el);if(bg.uncertain){last.uncertain++;continue;}if(!c.fg)continue;
        var next=improve(c.fg,bg.rgb);if(!next)continue;
        last.adjusted++;var color=text(next);if(!groups[color])groups[color]=[];groups[color].push(path(el,root));
      }
    }
    Object.keys(groups).forEach(function(color){var selectors=groups[color];for(var i=0;i<selectors.length;i+=48)rules.push(selectors.slice(i,i+48).join(',')+'{-webkit-text-fill-color:'+color+' !important;}');});
    // Native selection colors remain visible even when normal text fill is lifted.
    rules.push('#fox_html_content::selection,#fox_html_content *::selection,#fox_html_content_plaintext::selection,#fox_html_content_plaintext *::selection{-webkit-text-fill-color:HighlightText !important;}');
    clear();try{for(var i=0;i<rules.length;i++)media.insertRule(rules[i],media.cssRules.length);last.rules=rules.length;}catch(e){clear();last.status='rule-insertion-failed';}
  }
  function schedule(){if(stopped||pending)return;pending=true;requestAnimationFrame(run);}
  function start(){
    if(stopped)return;
    // Watch only editable roots and their replacement container. CSSOM writes do
    // not generate DOM mutations; no timer, scroll scanning or API wrapping.
    var container=document.getElementById('fox_html_content_box');
    if(container){observer=new MutationObserver(schedule);observer.observe(container,{subtree:true,childList:true,characterData:true,attributes:true});container.addEventListener('input',schedule);container.addEventListener('change',schedule);}
    window.addEventListener('resize',schedule);document.addEventListener('load',schedule,true);schedule();
  }
  window.__foxmailEditorDisplayContrast={version:'candidate-1.4',refresh:schedule,stats:function(){var o={};Object.keys(last).forEach(function(k){o[k]=last[k];});return o;},dispose:function(){stopped=true;if(observer)observer.disconnect();clear();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}());
