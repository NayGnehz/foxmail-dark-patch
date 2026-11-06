(function () {
  'use strict';
  if (!window.CSS || !CSS.highlights || typeof Highlight !== 'function' ||
      typeof CSSStyleSheet !== 'function' || !CSSStyleSheet.prototype.replaceSync ||
      !window.FoxEditorForegroundColors) return;
  var colours = window.FoxEditorForegroundColors;
  var prefix = 'foxmail-compose-colour-';
  var ids = ['fox_html_content', 'fox_html_content_plaintext'];
  var media = window.matchMedia('screen');
  var ranges = new WeakMap();
  var groups = Object.create(null);
  var styleCache, backgroundCache;
  var sheet = new CSSStyleSheet();
  var lastRules = '';
  var observer = null;
  var stopped = false;
  var printing = false;
  var counter = 0;

  function style(element) {
    var value = styleCache.get(element);
    if (!value) { value = getComputedStyle(element); styleCache.set(element, value); }
    return value;
  }
  function background(element) {
    if (!element) return colours.parse('#202020');
    if (backgroundCache.has(element)) return backgroundCache.get(element);
    var s = style(element), own = colours.parse(s.backgroundColor), result = null;
    if (s.backgroundImage === 'none' && own) {
      result = own.a === 1 ? own : colours.composite(own, background(element.parentElement));
    }
    backgroundCache.set(element, result);
    return result;
  }
  function editorFor(element) {
    for (var i = 0; i < ids.length; i++) {
      var root = document.getElementById(ids[i]);
      if (root && root.contains(element)) return root;
    }
    return null;
  }
  function caretColour() {
    var selection = window.getSelection(), node = selection && selection.anchorNode;
    var element = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
    if (!element || !editorFor(element)) return 'rgb(216, 216, 216)';
    var bg = background(element), result = bg && colours.transform('#000', bg);
    return result ? result.css : 'rgb(216, 216, 216)';
  }
  function updateRules() {
    var css = '@media screen { :root { caret-color: ' + caretColour() + ' !important; }';
    Object.keys(groups).forEach(function (key) {
      var group = groups[key];
      if (group.highlight.size) css += '::highlight(' + group.name + '){color:' + group.colour + ';}';
    });
    css += '}';
    if (css !== lastRules) { sheet.replaceSync(css); lastRules = css; }
  }
  function removeHighlights() {
    Object.keys(groups).forEach(function (key) { CSS.highlights.delete(groups[key].name); });
  }
  function refresh() {
    if (stopped || printing || !media.matches) { removeHighlights(); return; }
    styleCache = new WeakMap(); backgroundCache = new WeakMap();
    Object.keys(groups).forEach(function (key) { groups[key].highlight.clear(); });
    var palette = Object.create(null);
    ids.forEach(function (id) {
      var root = document.getElementById(id);
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), node;
      while ((node = walker.nextNode())) {
        var element = node.parentElement, s = style(element), bg = background(element);
        // Resolve the authored foreground. No text, HTML or original styles are
        // rewritten; unknown image/gradient backdrops retain original rendering.
        var foreground = colours.parse(s.webkitTextFillColor) ? s.webkitTextFillColor : s.color;
        var key = foreground + '|' + (bg ? [bg.r, bg.g, bg.b, bg.a].join(',') : 'unknown');
        if (!(key in palette)) palette[key] = bg ? colours.transform(foreground, bg) : null;
        var mapped = palette[key];
        if (!mapped || !mapped.changed) continue;
        var group = groups[mapped.css];
        if (!group) group = groups[mapped.css] = {name: prefix + (++counter), colour: mapped.css, highlight: new Highlight()};
        var range = ranges.get(node);
        if (!range) { range = document.createRange(); ranges.set(node, range); }
        range.selectNodeContents(node); group.highlight.add(range);
      }
    });
    Object.keys(groups).forEach(function (key) {
      var group = groups[key];
      if (group.highlight.size) CSS.highlights.set(group.name, group.highlight);
      else CSS.highlights.delete(group.name);
    });
    updateRules();
  }
  function selectionChanged() {
    if (stopped || printing || !media.matches) return;
    styleCache = new WeakMap(); backgroundCache = new WeakMap(); updateRules();
  }
  function start() {
    stopped = false;
    if (document.adoptedStyleSheets.indexOf(sheet) < 0) document.adoptedStyleSheets = document.adoptedStyleSheets.concat(sheet);
    if (!observer) observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {childList: true, characterData: true, subtree: true,
      attributes: true, attributeFilter: ['style', 'color', 'class', 'bgcolor']});
    refresh();
  }
  function stop() {
    stopped = true;
    if (observer) observer.disconnect();
    removeHighlights();
    Object.keys(groups).forEach(function (key) { groups[key].highlight.clear(); });
    groups = Object.create(null); ranges = new WeakMap();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(function (other) { return other !== sheet; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
  media.addListener(refresh);
  document.addEventListener('selectionchange', selectionChanged);
  document.addEventListener('focusin', selectionChanged);
  window.addEventListener('beforeprint', function () { printing = true; refresh(); });
  window.addEventListener('afterprint', function () { printing = false; refresh(); });
  window.addEventListener('pagehide', stop);
  window.addEventListener('unload', stop);
  window.addEventListener('pageshow', function () { if (stopped) start(); });
})();
