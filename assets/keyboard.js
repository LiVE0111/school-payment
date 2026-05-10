/* ═══════════════════════════════════════════════════
   Keyboard Shortcuts (Admin)
   - Ctrl+K → search
   - Alt+1-7 → switch tabs
   - Esc → close modal
   - ? → show help
   ═══════════════════════════════════════════════════ */
(function(){
  'use strict';

  function getToken(){ return localStorage.getItem('token') || ''; }

  var TAB_MAP = {
    '1': 'pay',  // รายการชำระ
    '2': 'bill', // แจ้งหนี้
    '3': 'std',  // นักเรียน
    '4': 'cls',  // ห้องเรียน
    '5': 'inq',  // คำถาม
    '6': 'cfg',  // ตั้งค่า
    '7': 'sto'   // พื้นที่
  };

  var TAB_NAMES = {
    '1': 'รายการชำระ', '2': 'แจ้งหนี้', '3': 'นักเรียน',
    '4': 'ห้องเรียน', '5': 'คำถาม', '6': 'ตั้งค่า', '7': 'พื้นที่'
  };

  function injectStyles(){
    if (document.getElementById('kbd-styles')) return;
    var s = document.createElement('style');
    s.id = 'kbd-styles';
    s.textContent = `
      .kbd-help {
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 20px;
        padding: 28px;
        max-width: 480px;
        width: 90%;
        z-index: 9999;
        box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        opacity: 0;
        animation: kbdFadeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      .kbd-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        z-index: 9998;
        animation: fadeIn 0.3s ease;
      }
      @keyframes kbdFadeIn {
        from { opacity: 0; transform: translate(-50%, -45%) scale(0.9); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
      .kbd-help h3 {
        font-size: 1.2rem;
        font-weight: 700;
        margin-bottom: 18px;
        color: #FF6B35;
      }
      .kbd-shortcut {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid #F5F5F5;
        font-size: 14px;
      }
      .kbd-shortcut:last-child { border-bottom: none; }
      .kbd-key {
        display: inline-block;
        background: linear-gradient(180deg, #FFF, #FFE4D1);
        border: 1px solid #FFB088;
        border-radius: 6px;
        padding: 3px 10px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        font-weight: 600;
        color: #FF6B35;
        margin: 0 2px;
        box-shadow: 0 2px 0 #FFB088;
      }
      .kbd-close {
        position: absolute;
        top: 14px; right: 14px;
        width: 32px; height: 32px;
        border-radius: 50%;
        background: #F5F5F5;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      .kbd-close:hover { background: #FFE4D1; color: #FF6B35; }

      .kbd-toast {
        position: fixed;
        top: 24px; left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #2D2A26, #1F1B17);
        color: white;
        padding: 10px 20px;
        border-radius: 100px;
        font-size: 13px;
        z-index: 9999;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        animation: kbdToast 1.5s ease forwards;
        pointer-events: none;
      }
      @keyframes kbdToast {
        0% { opacity: 0; transform: translate(-50%, -10px); }
        15%, 85% { opacity: 1; transform: translate(-50%, 0); }
        100% { opacity: 0; transform: translate(-50%, -10px); }
      }

      body.dark-mode .kbd-help { background: #2A241F; color: #E8E0D5; }
      body.dark-mode .kbd-shortcut { border-color: #3D352D; }
    `;
    document.head.appendChild(s);
  }

  function showToast(text){
    var existing = document.querySelector('.kbd-toast');
    if (existing) existing.remove();
    var t = document.createElement('div');
    t.className = 'kbd-toast';
    t.innerHTML = text;
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 1600);
  }

  function showHelp(){
    var existing = document.getElementById('kbdHelp');
    if (existing) { closeHelp(); return; }

    var overlay = document.createElement('div');
    overlay.className = 'kbd-overlay';
    overlay.id = 'kbdOverlay';
    overlay.addEventListener('click', closeHelp);
    document.body.appendChild(overlay);

    var help = document.createElement('div');
    help.className = 'kbd-help';
    help.id = 'kbdHelp';
    help.innerHTML = `
      <button class="kbd-close" onclick="document.getElementById('kbdHelp').remove(); document.getElementById('kbdOverlay').remove();"><i class="fas fa-times"></i></button>
      <h3><i class="fas fa-keyboard"></i> ปุ่มลัด (Keyboard Shortcuts)</h3>
      <div class="kbd-shortcut"><span>ค้นหาด่วน (Search)</span><span><span class="kbd-key">Ctrl</span>+<span class="kbd-key">K</span></span></div>
      <div class="kbd-shortcut"><span>แสดงปุ่มลัดนี้</span><span><span class="kbd-key">?</span> หรือ <span class="kbd-key">Shift</span>+<span class="kbd-key">/</span></span></div>
      <div class="kbd-shortcut"><span>ปิด Modal</span><span><span class="kbd-key">Esc</span></span></div>
      <div class="kbd-shortcut"><span>รายการชำระ</span><span><span class="kbd-key">Alt</span>+<span class="kbd-key">1</span></span></div>
      <div class="kbd-shortcut"><span>แจ้งหนี้</span><span><span class="kbd-key">Alt</span>+<span class="kbd-key">2</span></span></div>
      <div class="kbd-shortcut"><span>นักเรียน</span><span><span class="kbd-key">Alt</span>+<span class="kbd-key">3</span></span></div>
      <div class="kbd-shortcut"><span>ห้องเรียน</span><span><span class="kbd-key">Alt</span>+<span class="kbd-key">4</span></span></div>
      <div class="kbd-shortcut"><span>คำถาม</span><span><span class="kbd-key">Alt</span>+<span class="kbd-key">5</span></span></div>
      <div class="kbd-shortcut"><span>ตั้งค่า</span><span><span class="kbd-key">Alt</span>+<span class="kbd-key">6</span></span></div>
      <div class="kbd-shortcut"><span>พื้นที่</span><span><span class="kbd-key">Alt</span>+<span class="kbd-key">7</span></span></div>
      <div class="kbd-shortcut"><span>โหมดมืด/สว่าง</span><span><span class="kbd-key">Alt</span>+<span class="kbd-key">D</span></span></div>
    `;
    document.body.appendChild(help);
  }

  function closeHelp(){
    var h = document.getElementById('kbdHelp');
    var o = document.getElementById('kbdOverlay');
    if (h) h.remove();
    if (o) o.remove();
  }

  function focusSearch(){
    // ค้นหาช่อง search ที่เห็นได้
    var inputs = [
      document.getElementById('fSearch'),
      document.querySelector('#tab-std input[type="text"]'),
      document.querySelector('input[placeholder*="ค้นหา"]')
    ].filter(function(el){ return el && el.offsetParent !== null; });

    if (inputs.length > 0) {
      inputs[0].focus();
      inputs[0].select();
      showToast('<i class="fas fa-search"></i> ค้นหา');
    }
  }

  function switchTab(num){
    var tabKey = TAB_MAP[num];
    if (!tabKey) return;
    var btn = document.querySelector('[onclick*="\'' + tabKey + '\'"]');
    if (btn && btn.offsetParent !== null) {
      btn.click();
      showToast('<i class="fas fa-arrow-right"></i> ' + TAB_NAMES[num]);
    }
  }

  function toggleDarkMode(){
    if (typeof window.toggleDarkMode === 'function') {
      window.toggleDarkMode();
    } else {
      document.body.classList.toggle('dark-mode');
    }
    showToast(document.body.classList.contains('dark-mode')
      ? '<i class="fas fa-moon"></i> โหมดมืด'
      : '<i class="fas fa-sun"></i> โหมดสว่าง');
  }

  function closeAllModals(){
    document.querySelectorAll('.mo.open').forEach(function(m){
      m.classList.remove('open');
    });
    if (typeof Swal !== 'undefined' && Swal.isVisible()) Swal.close();
    closeHelp();
  }

  function handleKey(e){
    // ไม่ทำงานถ้ากำลังพิมพ์ใน input/textarea (ยกเว้น Esc)
    var target = e.target;
    var isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    // Esc — ทำงานเสมอ
    if (e.key === 'Escape') {
      closeAllModals();
      return;
    }

    // Ctrl+K — search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      focusSearch();
      return;
    }

    // ถ้าพิมพ์อยู่ — หยุดที่นี่
    if (isTyping) return;

    // Alt+1-7 — switch tabs
    if (e.altKey && /^[1-7]$/.test(e.key)) {
      e.preventDefault();
      switchTab(e.key);
      return;
    }

    // Alt+D — dark mode
    if (e.altKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      toggleDarkMode();
      return;
    }

    // ? — help
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      showHelp();
      return;
    }
  }

  function init(){
    if (!getToken()) return;
    injectStyles();
    document.addEventListener('keydown', handleKey);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.showKeyboardHelp = showHelp;
})();
