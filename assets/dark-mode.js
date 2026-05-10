/* ═══════════════════════════════════════════════════
   Dark Mode (with localStorage persistence)
   ═══════════════════════════════════════════════════ */
(function(){
  'use strict';

  var STORAGE_KEY = 'darkMode';

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
    if (saved === 'false') return false;
    // ถ้ายังไม่เคยตั้ง → ใช้ system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
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

    // Listen for system theme changes (only if user hasn't manually set)
    if (!localStorage.getItem(STORAGE_KEY) && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e){
        if (!localStorage.getItem(STORAGE_KEY)) {
          applyDarkMode(e.matches);
        }
      });
    }

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
