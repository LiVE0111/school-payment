/* ═══════════════════════════════════════════════════
   Smart Notification Bar (Admin only)
   - แสดง: คำถามใหม่, storage warning, รายการค้าง
   ═══════════════════════════════════════════════════ */
(function(){
  'use strict';

  var NOTIF_BAR_ID = 'smartNotifBar';
  var NOTIF_INTERVAL = 60000; // refresh ทุก 60 วินาที

  function getToken(){ return localStorage.getItem('adminToken') || ''; }

  async function fetchNotifications(){
    var token = getToken();
    if (!token) return [];

    var notifs = [];

    try {
      // 1. คำถามใหม่จาก Chatbot (ค้าง)
      try {
        var r = await fetch('/api/settings?action=inquiries&status=pending&limit=1', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (r.ok) {
          var data = await r.json();
          var pendingCount = (data && data.total) || 0;
          if (pendingCount > 0) {
            notifs.push({
              type: 'inquiry',
              icon: 'fa-comments',
              color: '#2196F3',
              text: 'มีคำถามใหม่จากผู้ปกครอง <strong>' + pendingCount + ' รายการ</strong>',
              action: function(){
                var inqBtn = document.querySelector('[onclick*="inq"]');
                if (inqBtn) inqBtn.click();
              }
            });
          }
        }
      } catch(e) {}

      // 2. รายการค้างตรวจนาน
      try {
        var r2 = await fetch('/api/admin/payments?status=' + encodeURIComponent('กำลังตรวจสอบ') + '&pageSize=1', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (r2.ok) {
          var d2 = await r2.json();
          var pendingReview = (d2.pagination && d2.pagination.totalCount) || 0;
          if (pendingReview >= 5) {
            notifs.push({
              type: 'pending_review',
              icon: 'fa-hourglass-half',
              color: '#FF9800',
              text: 'มีรายการรอตรวจสอบ <strong>' + pendingReview + ' รายการ</strong>',
              action: function(){
                var stat = document.getElementById('fStat');
                if (stat) {
                  stat.value = 'กำลังตรวจสอบ';
                  if (typeof loadPay === 'function') loadPay(true);
                }
              }
            });
          }
        }
      } catch(e) {}

      // 3. Storage warning
      try {
        var r3 = await fetch('/api/admin/stats?action=storage', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (r3.ok) {
          var d3 = await r3.json();
          if (d3.database && d3.database.percent > 80) {
            notifs.push({
              type: 'db_full',
              icon: 'fa-database',
              color: '#F44336',
              text: 'Database ใช้เกิน <strong>' + d3.database.percent.toFixed(1) + '%</strong> ควร archive ข้อมูลเก่า',
              action: function(){
                var sto = document.querySelector('[onclick*="sto"]');
                if (sto) sto.click();
              }
            });
          }
          if (d3.storage && d3.storage.percent > 80) {
            notifs.push({
              type: 'storage_full',
              icon: 'fa-image',
              color: '#F44336',
              text: 'Storage ใช้เกิน <strong>' + d3.storage.percent.toFixed(1) + '%</strong> ควรลบสลิปเก่า',
              action: function(){
                var sto = document.querySelector('[onclick*="sto"]');
                if (sto) sto.click();
              }
            });
          }
        }
      } catch(e) {}
    } catch(err) {
      console.error('Notification fetch error:', err);
    }

    return notifs;
  }

  function renderBar(notifs){
    var existing = document.getElementById(NOTIF_BAR_ID);
    if (notifs.length === 0) {
      if (existing) existing.style.display = 'none';
      return;
    }

    var bar = existing;
    if (!bar) {
      bar = document.createElement('div');
      bar.id = NOTIF_BAR_ID;
      bar.className = 'smart-notif-bar';
      document.body.insertBefore(bar, document.body.firstChild);
    }
    bar.style.display = 'block';

    var dismissed = JSON.parse(sessionStorage.getItem('dismissedNotifs') || '[]');
    var visible = notifs.filter(function(n){ return dismissed.indexOf(n.type) === -1; });

    if (visible.length === 0) {
      bar.style.display = 'none';
      return;
    }

    var html = '<div class="smart-notif-inner">';
    visible.forEach(function(n, i){
      html += '<div class="smart-notif-item" data-type="' + n.type + '" style="border-left-color:' + n.color + '">'
        + '<i class="fas ' + n.icon + '" style="color:' + n.color + '"></i>'
        + '<span class="snf-text">' + n.text + '</span>'
        + '<button class="snf-action" data-i="' + i + '">ดู</button>'
        + '<button class="snf-close" data-type="' + n.type + '"><i class="fas fa-times"></i></button>'
        + '</div>';
    });
    html += '</div>';
    bar.innerHTML = html;

    // bind actions
    bar.querySelectorAll('.snf-action').forEach(function(btn){
      btn.addEventListener('click', function(){
        var idx = parseInt(this.getAttribute('data-i'), 10);
        if (visible[idx] && typeof visible[idx].action === 'function') visible[idx].action();
      });
    });
    bar.querySelectorAll('.snf-close').forEach(function(btn){
      btn.addEventListener('click', function(){
        var t = this.getAttribute('data-type');
        var dis = JSON.parse(sessionStorage.getItem('dismissedNotifs') || '[]');
        if (dis.indexOf(t) === -1) dis.push(t);
        sessionStorage.setItem('dismissedNotifs', JSON.stringify(dis));
        var item = this.closest('.smart-notif-item');
        if (item) {
          item.style.animation = 'slideOut 0.3s forwards';
          setTimeout(function(){ item.remove(); checkEmpty(); }, 300);
        }
      });
    });
  }

  function checkEmpty(){
    var bar = document.getElementById(NOTIF_BAR_ID);
    if (!bar) return;
    if (bar.querySelectorAll('.smart-notif-item').length === 0) bar.style.display = 'none';
  }

  // CSS injection
  function injectStyles(){
    if (document.getElementById('smart-notif-styles')) return;
    var s = document.createElement('style');
    s.id = 'smart-notif-styles';
    s.textContent = `
      .smart-notif-bar {
        position: sticky; top: 0; z-index: 90;
        background: linear-gradient(180deg, #FFFAF5, #FFF5EE);
        border-bottom: 1px solid #FFE4D1;
        padding: 8px 14px;
        animation: slideDown 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .smart-notif-inner {
        max-width: 1400px; margin: 0 auto;
        display: flex; flex-direction: column; gap: 6px;
      }
      .smart-notif-item {
        display: flex; align-items: center; gap: 12px;
        background: white;
        padding: 10px 14px;
        border-radius: 12px;
        border-left: 4px solid #FF6B35;
        box-shadow: 0 2px 8px rgba(255,107,53,0.06);
        font-size: 13px;
        animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .smart-notif-item i { font-size: 16px; flex-shrink: 0; }
      .snf-text { flex: 1; color: #333; }
      .snf-action {
        background: linear-gradient(135deg, #FF6B35, #F7931E);
        color: white;
        border: none;
        padding: 5px 14px;
        border-radius: 100px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: transform 0.2s ease;
      }
      .snf-action:hover { transform: scale(1.05); }
      .snf-close {
        background: transparent; border: none;
        color: #999; cursor: pointer;
        width: 28px; height: 28px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s ease;
      }
      .snf-close:hover { background: #FFE4D1; color: #FF6B35; }
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-100%); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateX(-20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes slideOut {
        to { opacity: 0; transform: translateX(20px); height: 0; padding: 0; margin: 0; }
      }
      body.dark-mode .smart-notif-bar { background: linear-gradient(180deg, #1F1B17, #2A241F); border-color: #3D352D; }
      body.dark-mode .smart-notif-item { background: #2A241F; color: #E8E0D5; }
      body.dark-mode .snf-text { color: #E8E0D5; }
    `;
    document.head.appendChild(s);
  }

  async function refresh(){
    if (!getToken()) return;
    var notifs = await fetchNotifications();
    renderBar(notifs);
  }

  // Init
  function init(){
    if (!getToken()) return; // เฉพาะ admin
    injectStyles();
    refresh();
    setInterval(refresh, NOTIF_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshNotifications = refresh;
})();
