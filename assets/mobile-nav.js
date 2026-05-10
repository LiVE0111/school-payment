/* ═══════════════════════════════════════════════════
   Mobile Bottom Nav (Admin) - shown only on mobile
   ═══════════════════════════════════════════════════ */
(function(){
  'use strict';

  function getToken(){ return localStorage.getItem('token') || ''; }

  // Only build on admin dashboard page
  function isAdminDashboard(){
    return /admin-dashboard/i.test(location.pathname) || document.getElementById('tab-pay');
  }

  function buildNav(){
    if (document.querySelector('.mobile-bottom-nav')) return;

    var nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.innerHTML = `
      <div class="mobile-bottom-nav-inner">
        <button class="mb-item" data-tab="pay"><i class="fas fa-money-bill"></i><span>รายการ</span></button>
        <button class="mb-item" data-tab="bill"><i class="fas fa-file-invoice"></i><span>แจ้งหนี้</span></button>
        <button class="mb-item" data-tab="std"><i class="fas fa-users"></i><span>นักเรียน</span></button>
        <button class="mb-item" data-tab="cfg"><i class="fas fa-cog"></i><span>ตั้งค่า</span></button>
        <button class="mb-item" data-tab="more"><i class="fas fa-ellipsis-h"></i><span>เพิ่มเติม</span></button>
      </div>
    `;
    document.body.appendChild(nav);

    // Bind clicks
    nav.querySelectorAll('.mb-item').forEach(function(btn){
      btn.addEventListener('click', function(){
        var tabKey = this.getAttribute('data-tab');
        if (tabKey === 'more') {
          showMoreMenu();
          return;
        }
        var topBtn = document.querySelector('[onclick*="\'' + tabKey + '\'"]');
        if (topBtn) topBtn.click();
        updateActive(tabKey);
      });
    });

    // Set initial active
    updateActive('pay');

    // Listen for tab changes (sync with top nav)
    document.querySelectorAll('.tb2, [onclick*="sw("]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var match = this.getAttribute('onclick') || '';
        var m = match.match(/'([a-z]+)'/);
        if (m) updateActive(m[1]);
      });
    });
  }

  function updateActive(tabKey){
    document.querySelectorAll('.mb-item').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-tab') === tabKey);
    });
  }

  function showMoreMenu(){
    Swal.fire({
      title: '<i class="fas fa-ellipsis-h" style="color:#FF6B35"></i> เมนูเพิ่มเติม',
      html: '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:10px 0">'
        + makeMoreItem('cls', 'fa-school', 'ห้องเรียน', '#1976D2')
        + makeMoreItem('inq', 'fa-comments', 'คำถาม', '#9C27B0')
        + makeMoreItem('sto', 'fa-database', 'พื้นที่', '#FF9800')
        + makeMoreItem('adm', 'fa-user-shield', 'ผู้ดูแล', '#F44336')
        + '</div>'
        + '<div style="margin-top:14px;padding-top:14px;border-top:1px solid #eee;display:flex;gap:8px;justify-content:center">'
        + '<button class="more-action" onclick="window.toggleDarkMode && window.toggleDarkMode(); Swal.close()" style="padding:8px 16px;border:1px solid #FFB088;background:#FFF8F2;color:#FF6B35;border-radius:100px;cursor:pointer;font-family:inherit;font-size:13px"><i class="fas fa-moon"></i> โหมดมืด</button>'
        + '<button class="more-action" onclick="window.showKeyboardHelp && window.showKeyboardHelp(); Swal.close()" style="padding:8px 16px;border:1px solid #FFB088;background:#FFF8F2;color:#FF6B35;border-radius:100px;cursor:pointer;font-family:inherit;font-size:13px"><i class="fas fa-keyboard"></i> ปุ่มลัด</button>'
        + '</div>',
      showConfirmButton: false,
      showCloseButton: true,
      width: 380
    });

    // Bind clicks
    setTimeout(function(){
      document.querySelectorAll('.more-tab-btn').forEach(function(b){
        b.addEventListener('click', function(){
          var tabKey = this.getAttribute('data-tab');
          var topBtn = document.querySelector('[onclick*="\'' + tabKey + '\'"]');
          if (topBtn) topBtn.click();
          updateActive(tabKey);
          Swal.close();
        });
      });
    }, 100);
  }

  function makeMoreItem(tab, icon, label, color){
    return '<button class="more-tab-btn" data-tab="' + tab + '" '
      + 'style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 12px;'
      + 'background:white;border:1px solid #FFE4D1;border-radius:14px;cursor:pointer;font-family:inherit;'
      + 'transition:all 0.3s ease">'
      + '<div style="width:42px;height:42px;border-radius:50%;background:' + color + '22;color:' + color
      + ';display:flex;align-items:center;justify-content:center;font-size:18px"><i class="fas ' + icon + '"></i></div>'
      + '<span style="font-size:13px;font-weight:500;color:#333">' + label + '</span>'
      + '</button>';
  }

  function init(){
    if (!getToken()) return;
    if (!isAdminDashboard()) return;

    // Wait for DOM ready
    if (document.querySelector('.tb2')) {
      buildNav();
    } else {
      // Try again after a moment
      setTimeout(buildNav, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
