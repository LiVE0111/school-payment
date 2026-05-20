/* ═══════════════════════════════════════════════════
   Quick Actions Floating Menu (Admin)
   ═══════════════════════════════════════════════════ */
(function(){
  'use strict';

  function getToken(){ return localStorage.getItem('adminToken') || ''; }

  function injectStyles(){
    if (document.getElementById('qa-styles')) return;
    var s = document.createElement('style');
    s.id = 'qa-styles';
    s.textContent = `
      .qa-fab {
        position: fixed;
        bottom: 90px; right: 24px;
        width: 56px; height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #FF6B35, #F7931E);
        color: white;
        border: none;
        font-size: 20px;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(255, 107, 53, 0.4);
        z-index: 98;
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .qa-fab:hover { transform: scale(1.1) rotate(90deg); }
      .qa-fab.open { transform: rotate(45deg); }
      @media (max-width: 768px) { .qa-fab { bottom: 90px; right: 16px; } }

      .qa-menu {
        position: fixed;
        bottom: 160px; right: 24px;
        z-index: 97;
        display: flex;
        flex-direction: column;
        gap: 10px;
        opacity: 0;
        pointer-events: none;
        transform: translateY(10px);
        transition: opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .qa-menu.open {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }
      .qa-item {
        display: flex;
        align-items: center;
        gap: 10px;
        background: white;
        padding: 10px 16px 10px 12px;
        border-radius: 100px;
        box-shadow: 0 4px 16px rgba(255, 107, 53, 0.15);
        cursor: pointer;
        border: 1px solid #FFE4D1;
        font-family: inherit;
        font-size: 13px;
        font-weight: 500;
        color: #333;
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
        animation: qaFadeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
      }
      .qa-menu.open .qa-item:nth-child(1) { animation-delay: 0.05s; }
      .qa-menu.open .qa-item:nth-child(2) { animation-delay: 0.10s; }
      .qa-menu.open .qa-item:nth-child(3) { animation-delay: 0.15s; }
      .qa-menu.open .qa-item:nth-child(4) { animation-delay: 0.20s; }
      .qa-item:hover {
        transform: translateX(-4px);
        box-shadow: 0 6px 20px rgba(255, 107, 53, 0.25);
      }
      .qa-item-icon {
        width: 32px; height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 13px;
        flex-shrink: 0;
      }
      @keyframes qaFadeIn {
        from { opacity: 0; transform: translateX(20px) scale(0.9); }
        to { opacity: 1; transform: translateX(0) scale(1); }
      }
      .qa-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0);
        z-index: 96;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease, background 0.3s ease;
      }
      .qa-overlay.open {
        opacity: 1;
        pointer-events: auto;
        background: rgba(0,0,0,0.2);
        backdrop-filter: blur(2px);
      }
      body.dark-mode .qa-item {
        background: #2A241F;
        border-color: #3D352D;
        color: #E8E0D5;
      }
    `;
    document.head.appendChild(s);
  }

  function buildUI(){
    if (document.getElementById('qaFab')) return;

    var overlay = document.createElement('div');
    overlay.className = 'qa-overlay';
    overlay.id = 'qaOverlay';
    document.body.appendChild(overlay);

    var menu = document.createElement('div');
    menu.className = 'qa-menu';
    menu.id = 'qaMenu';
    menu.innerHTML = `
      <button class="qa-item" data-action="search-student">
        <span class="qa-item-icon" style="background:linear-gradient(135deg,#2196F3,#0D47A1)"><i class="fas fa-search"></i></span>
        <span>ค้นหานักเรียน (Ctrl+K)</span>
      </button>
      <button class="qa-item" data-action="quick-bill">
        <span class="qa-item-icon" style="background:linear-gradient(135deg,#FF9800,#F57C00)"><i class="fas fa-file-invoice"></i></span>
        <span>ออกบิลรายบุคคล</span>
      </button>
      <button class="qa-item" data-action="late-enroll">
        <span class="qa-item-icon" style="background:linear-gradient(135deg,#1976D2,#0D47A1)"><i class="fas fa-user-clock"></i></span>
        <span>ย้ายเข้ากลางเทอม</span>
      </button>
      <button class="qa-item" data-action="today-summary">
        <span class="qa-item-icon" style="background:linear-gradient(135deg,#4CAF50,#2E7D32)"><i class="fas fa-chart-line"></i></span>
        <span>สรุปยอดวันนี้</span>
      </button>
    `;
    document.body.appendChild(menu);

    var fab = document.createElement('button');
    fab.className = 'qa-fab';
    fab.id = 'qaFab';
    fab.title = 'การกระทำด่วน';
    fab.innerHTML = '<i class="fas fa-plus"></i>';
    document.body.appendChild(fab);

    fab.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', closeMenu);

    menu.querySelectorAll('.qa-item').forEach(function(btn){
      btn.addEventListener('click', function(){
        var action = this.getAttribute('data-action');
        closeMenu();
        setTimeout(function(){ runAction(action); }, 200);
      });
    });

    // ปิดเมื่อกด Esc
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeMenu();
    });
  }

  function toggleMenu(){
    var fab = document.getElementById('qaFab');
    var menu = document.getElementById('qaMenu');
    var overlay = document.getElementById('qaOverlay');
    if (!fab || !menu) return;
    var isOpen = menu.classList.contains('open');
    if (isOpen) closeMenu();
    else openMenu();
  }
  function openMenu(){
    document.getElementById('qaFab').classList.add('open');
    document.getElementById('qaMenu').classList.add('open');
    document.getElementById('qaOverlay').classList.add('open');
  }
  function closeMenu(){
    document.getElementById('qaFab').classList.remove('open');
    document.getElementById('qaMenu').classList.remove('open');
    document.getElementById('qaOverlay').classList.remove('open');
  }

  function runAction(action){
    switch(action){
      case 'search-student':
        // เปิด admin search → focus ที่ช่อง search
        var navStd = document.querySelector('[onclick*="\'std\'"]');
        if (navStd) navStd.click();
        setTimeout(function(){
          var s = document.querySelector('#tab-std input[type="text"]');
          if (s) { s.focus(); s.select(); }
        }, 400);
        break;

      case 'quick-bill':
        Swal.fire({
          title: '<i class="fas fa-file-invoice" style="color:#FF6B35"></i> ออกบิลรายบุคคล',
          html: '<input id="qbIdCard" class="swal2-input" placeholder="กรอกเลขบัตรประชาชน 13 หลัก" style="width:100%" maxlength="13" inputmode="numeric">',
          showCancelButton: true,
          confirmButtonText: 'ค้นหา',
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#FF6B35',
          preConfirm: function(){
            var id = document.getElementById('qbIdCard').value.trim();
            if (!id) { Swal.showValidationMessage('กรอกเลขบัตร'); return false; }
            return id;
          }
        }).then(function(r){
          if (!r.isConfirmed) return;
          // ค้นหานักเรียน
          fetch('/api/admin/students?status=ALL', { headers:{ 'Authorization': 'Bearer ' + getToken() }})
            .then(function(res){ return res.json(); })
            .then(function(d){
              var s = (d.students || []).find(function(s){ return s.idCard === r.value; });
              if (!s) {
                Swal.fire({ icon:'warning', title:'ไม่พบนักเรียน', text:'ลองค้นหาในแท็บนักเรียน หรือเพิ่มก่อน', confirmButtonColor:'#FF6B35' });
                return;
              }
              if (typeof openIndividualBill === 'function') {
                openIndividualBill(s.idCard, s.name, s.class);
              }
            });
        });
        break;

      case 'late-enroll':
        if (typeof openLateEnroll === 'function') openLateEnroll();
        break;

      case 'today-summary':
        showTodaySummary();
        break;
    }
  }

  function showTodaySummary(){
    Swal.fire({
      title: 'กำลังโหลด...',
      didOpen: function(){ Swal.showLoading(); },
      allowOutsideClick: false
    });

    fetch('/api/admin/stats', { headers:{ 'Authorization': 'Bearer ' + getToken() }})
      .then(function(r){ return r.json(); })
      .then(function(d){
        Swal.fire({
          title: '<i class="fas fa-chart-line" style="color:#4CAF50"></i> สรุปวันนี้',
          html: '<div style="text-align:left;font-size:.9rem;line-height:1.8">'
            + '<div style="background:linear-gradient(135deg,#E8F5E9,#fff);padding:14px;border-radius:12px;margin-bottom:10px">'
            + '<div style="color:#666;font-size:.8rem">รายรับวันนี้</div>'
            + '<div style="font-size:2rem;font-weight:700;color:#2E7D32">฿' + (d.todayAmount || 0).toLocaleString() + '</div>'
            + '<div style="font-size:.85rem;color:#666">' + (d.todayCount || 0) + ' รายการ</div>'
            + '</div>'
            + '<div style="background:linear-gradient(135deg,#FFF3E0,#fff);padding:14px;border-radius:12px;margin-bottom:10px">'
            + '<div style="color:#666;font-size:.8rem">รายรับสะสม</div>'
            + '<div style="font-size:1.5rem;font-weight:700;color:#FF6B35">฿' + (d.totalPaid || 0).toLocaleString() + '</div>'
            + '</div>'
            + '<div style="display:flex;gap:8px">'
            + '<div style="flex:1;background:#F5F5F5;padding:10px;border-radius:10px;text-align:center"><div style="font-size:.75rem;color:#666">รอชำระ</div><div style="font-weight:700;color:#FF9800">' + ((d.stats && d.stats['รอชำระ']) || 0) + '</div></div>'
            + '<div style="flex:1;background:#F5F5F5;padding:10px;border-radius:10px;text-align:center"><div style="font-size:.75rem;color:#666">รอตรวจ</div><div style="font-weight:700;color:#2196F3">' + ((d.stats && d.stats['กำลังตรวจสอบ']) || 0) + '</div></div>'
            + '<div style="flex:1;background:#F5F5F5;padding:10px;border-radius:10px;text-align:center"><div style="font-size:.75rem;color:#666">ชำระแล้ว</div><div style="font-weight:700;color:#4CAF50">' + ((d.stats && d.stats['ชำระแล้ว']) || 0) + '</div></div>'
            + '</div>'
            + '</div>',
          confirmButtonText: 'ปิด',
          confirmButtonColor: '#FF6B35',
          width: 420
        });
      })
      .catch(function(e){ Swal.fire('Error', e.message || 'โหลดไม่สำเร็จ', 'error'); });
  }

  function init(){
    if (!getToken()) return;
    injectStyles();
    buildUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
