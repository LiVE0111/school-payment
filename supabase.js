/* ═══════════════════════════════════════════════════
   Dark Mode (with localStorage persistence)
   ═══════════════════════════════════════════════════ */
(function(){
  'use strict';

  var STORAGE_KEY = 'darkMode';
  var RESET_VERSION_KEY = 'darkModeResetV1';  // ⭐ เปลี่ยนเลขนี้เพื่อ force reset ครั้งใหม่

  // ⭐ ONE-TIME RESET: บังคับทุก user กลับเป็น light เพียงครั้งเดียว
  // (รัน 1 ครั้งต่อ browser — หลังจากนั้นเคารพการเลือกของ user)
  if (!localStorage.getItem(RESET_VERSION_KEY)) {
    localStorage.removeItem(STORAGE_KEY);  // ล้างค่าเก่า
    localStorage.setItem(RESET_VERSION_KEY, '1');  // mark ว่า reset แล้ว
  }

  function applyDarkMode(enabled){
    if (enabled) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    // Update toggle buttons UI
    document.querySelectorAll('[data-dark-toggle], .dark-toggle').forEach(function(btn){
      var icon = btn.querySelector('i');
      if (icon) {
        icon.className = enabled ? 'fas fa-sun' : 'fas fa-moon';
      }
      btn.title = enabled ? 'โหมดสว่าง' : 'โหมดมืด';
    });
  }

  function isDarkEnabled(){
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true') return true;
    // Default: ALWAYS light mode (ไม่สนใจ system preference)
    return false;
  }

  window.toggleDarkMode = function(){
    var current = document.body.classList.contains('dark-mode');
    var next = !current;
    localStorage.setItem(STORAGE_KEY, String(next));
    applyDarkMode(next);
    return next;
  };

  window.setDarkMode = function(enabled){
    localStorage.setItem(STORAGE_KEY, String(!!enabled));
    applyDarkMode(!!enabled);
  };

  function bindToggles(){
    document.querySelectorAll('[data-dark-toggle], .dark-toggle').forEach(function(btn){
      if (btn.__darkBound) return;
      btn.__darkBound = true;
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        window.toggleDarkMode();
      });
    });
  }

  function init(){
    applyDarkMode(isDarkEnabled());
    bindToggles();

    // Re-bind toggles when DOM changes (modals add new buttons)
    var observer = new MutationObserver(bindToggles);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
