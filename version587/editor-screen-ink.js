(function () {
  'use strict';
  if (!window.CSS || !CSS.highlights || typeof window.Highlight !== 'function') return;
  var name = 'foxmail-compose-screen-ink';
  var ids = ['fox_html_content', 'fox_html_content_plaintext'];
  var media = window.matchMedia('screen');
  var printing = false;
  var rangeCache = new WeakMap();
  var highlight = new Highlight();

  function refresh() {
    if (printing || !media.matches) {
      CSS.highlights.delete(name);
      return;
    }
    highlight.clear();
    ids.forEach(function (id) {
      var root = document.getElementById(id);
      if (!root) return;
      // Text-only ranges keep images and other replaced elements outside the
      // highlight, including engines that paint highlights over such elements.
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var range = rangeCache.get(node);
        if (!range) { range = document.createRange(); rangeCache.set(node, range); }
        range.selectNodeContents(node);
        highlight.add(range);
      }
    });
    if (highlight.size) CSS.highlights.set(name, highlight);
    else CSS.highlights.delete(name);
  }

  function start() {
    // Rebuild range membership before rendering when text is appended/replaced.
    // This never changes the editable DOM, selection, formatting or clipboard.
    new MutationObserver(refresh).observe(document.documentElement, {
      childList: true, characterData: true, subtree: true
    });
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  media.addListener(refresh);
  window.addEventListener('beforeprint', function () { printing = true; refresh(); });
  window.addEventListener('afterprint', function () { printing = false; refresh(); });
})();
