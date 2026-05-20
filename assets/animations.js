/* ═══════════════════════════════════════════════════
   School Payment - Animation Helpers
   ═══════════════════════════════════════════════════ */
(function(){
  'use strict';

  // ─── 1. Number Counter ───
  // ใช้: animateCount(element, 0, 784, 1200)
  window.animateCount = function(el, from, to, duration){
    if (!el) return;
    duration = duration || 1000;
    from = Number(from) || 0;
    to = Number(to) || 0;
    if (from === to) {
      el.textContent = formatNum(to);
      return;
    }
    var startTime = null;
    function step(timestamp){
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // easeOutCubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(from + (to - from) * eased);
      el.textContent = formatNum(current);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = formatNum(to);
    }
    requestAnimationFrame(step);
  };

  function formatNum(n){
    if (typeof n !== 'number') return n;
    // Handle ฿ prefix for amounts
    return n.toLocaleString('en-US');
  }

  // ─── 2. Animate stat grid (numbers count up) ───
  window.animateStats = function(){
    document.querySelectorAll('.stat .n').forEach(function(el){
      var raw = el.textContent.trim();
      var hasBaht = raw.indexOf('฿') === 0;
      var num = Number(raw.replace(/[฿,]/g,'')) || 0;
      if (num === 0) return;
      var prefix = hasBaht ? '฿' : '';
      var startTime = null;
      var duration = 800;
      function step(timestamp){
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = Math.round(num * eased);
        el.textContent = prefix + current.toLocaleString('en-US');
        if (progress < 1) requestAnimationFrame(step);
      }
      el.textContent = prefix + '0';
      requestAnimationFrame(step);
    });
  };

  // ─── 3. Apply stagger class to children ───
  window.applyStagger = function(parentSelector){
    var parent = typeof parentSelector === 'string'
      ? document.querySelector(parentSelector)
      : parentSelector;
    if (!parent) return;
    Array.from(parent.children).forEach(function(child){
      child.classList.add('stagger-item');
    });
  };

  // ─── 4. Search Highlight ───
  // ใช้: highlightSearch(rowElement, 'ธันวา')
  window.highlightSearch = function(rootEl, query){
    if (!rootEl || !query || !query.trim()) return;
    var q = query.trim();
    var regex = new RegExp('(' + escapeReg(q) + ')', 'gi');

    function walk(node){
      if (node.nodeType === 3) { // text node
        var text = node.nodeValue;
        if (regex.test(text)) {
          var span = document.createElement('span');
          span.innerHTML = text.replace(regex, '<mark class="search-hl">$1</mark>');
          node.parentNode.replaceChild(span, node);
        }
      } else if (node.nodeType === 1 && !['SCRIPT','STYLE','BUTTON','INPUT'].includes(node.tagName)) {
        Array.from(node.childNodes).forEach(walk);
      }
    }
    walk(rootEl);
  };

  function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

  // ─── 5. Skeleton loader generator ───
  window.skeletonRow = function(cols){
    cols = cols || 5;
    var html = '<tr class="skeleton-tr">';
    for (var i = 0; i < cols; i++) {
      html += '<td><div class="skeleton skeleton-text ' + (i === 0 ? 'short' : 'medium') + '"></div></td>';
    }
    html += '</tr>';
    return html;
  };

  window.skeletonTable = function(tbodyId, cols, rows){
    var tb = document.getElementById(tbodyId);
    if (!tb) return;
    rows = rows || 5;
    cols = cols || 5;
    var html = '';
    for (var i = 0; i < rows; i++) html += window.skeletonRow(cols);
    tb.innerHTML = html;
  };

  // ─── 6. Empty State ───
  window.emptyState = function(opts){
    opts = opts || {};
    var icon = opts.icon || 'fa-inbox';
    var title = opts.title || 'ไม่พบข้อมูล';
    var text = opts.text || 'ลองเปลี่ยนเงื่อนไขการค้นหา';
    var col = opts.colspan || 5;
    return '<tr><td colspan="' + col + '"><div class="empty-state">'
      + '<div class="empty-state-icon"><i class="fas ' + icon + '"></i></div>'
      + '<div class="empty-state-title">' + title + '</div>'
      + '<div class="empty-state-text">' + text + '</div>'
      + '</div></td></tr>';
  };

  // ─── 7. Success Modal (replaces simple Swal success) ───
  window.successModal = function(title, text){
    if (typeof Swal === 'undefined') return alert(title);
    Swal.fire({
      html: '<div style="padding:20px 0">'
        + '<div class="success-check"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>'
        + '<h3 style="margin:18px 0 6px;font-size:1.3rem;font-weight:700;color:#2E7D32">' + title + '</h3>'
        + '<div style="color:#666;font-size:.95rem">' + (text || '') + '</div>'
        + '</div>',
      showConfirmButton: false,
      timer: 1800,
      width: 360,
      background: '#fff'
    });
  };

  // ─── 8. Active tab indicator handler ───
  window.setActiveTab = function(activeBtn){
    document.querySelectorAll('.nav-tab-btn').forEach(function(b){
      b.classList.remove('active');
    });
    if (activeBtn) activeBtn.classList.add('active');
  };

  // ─── 9. Scroll reveal observer ───
  window.initScrollReveal = function(){
    if (!('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(function(el){
      observer.observe(el);
    });
  };

  // ─── 10. Auto-add stagger to tbody rows ───
  window.staggerTableRows = function(tbodyId){
    var tb = document.getElementById(tbodyId);
    if (!tb) return;
    Array.from(tb.children).forEach(function(tr, i){
      tr.classList.add('stagger-item');
      tr.style.animationDelay = Math.min(i * 0.03, 0.5) + 's';
    });
  };

  // ─── 11. Debounce util ───
  window.debounce = function(fn, ms){
    var t;
    return function(){
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function(){ fn.apply(ctx, args); }, ms || 300);
    };
  };

  // ─── 12. Init on load ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){
      window.initScrollReveal();
    });
  } else {
    window.initScrollReveal();
  }
})();
