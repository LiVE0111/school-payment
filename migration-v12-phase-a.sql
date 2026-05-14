/* ════════════════════════════════════════════════════
   School Payment System - Animation Library
   Refined animations for orange-white theme
   ════════════════════════════════════════════════════ */

/* ── EASING VARIABLES ── */
:root {
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-snap: cubic-bezier(0.4, 0, 0.2, 1);
  --orange-glow: rgba(255, 107, 53, 0.15);
  --orange-glow-strong: rgba(255, 107, 53, 0.25);
}

/* ════════════════════════════════════════════════════
   1. PAGE TRANSITION (Tab switching)
   ════════════════════════════════════════════════════ */
.tp {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s var(--ease-smooth);
}
.tp.active {
  opacity: 1;
  pointer-events: auto;
  animation: pageEnter 0.5s var(--ease-smooth);
}
@keyframes pageEnter {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ════════════════════════════════════════════════════
   2. STAGGER FADE-IN (Lists)
   ════════════════════════════════════════════════════ */
.stagger-item {
  opacity: 0;
  animation: staggerFadeIn 0.5s var(--ease-smooth) forwards;
}
.stagger-item:nth-child(1)  { animation-delay: 0.00s; }
.stagger-item:nth-child(2)  { animation-delay: 0.04s; }
.stagger-item:nth-child(3)  { animation-delay: 0.08s; }
.stagger-item:nth-child(4)  { animation-delay: 0.12s; }
.stagger-item:nth-child(5)  { animation-delay: 0.16s; }
.stagger-item:nth-child(6)  { animation-delay: 0.20s; }
.stagger-item:nth-child(7)  { animation-delay: 0.24s; }
.stagger-item:nth-child(8)  { animation-delay: 0.28s; }
.stagger-item:nth-child(9)  { animation-delay: 0.32s; }
.stagger-item:nth-child(10) { animation-delay: 0.36s; }
.stagger-item:nth-child(11) { animation-delay: 0.40s; }
.stagger-item:nth-child(12) { animation-delay: 0.44s; }
.stagger-item:nth-child(n+13) { animation-delay: 0.48s; }

@keyframes staggerFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ════════════════════════════════════════════════════
   3. SKELETON LOADING
   ════════════════════════════════════════════════════ */
.skeleton {
  background: linear-gradient(
    90deg,
    #FFF5EE 0%,
    #FFE4D1 50%,
    #FFF5EE 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
  border-radius: 8px;
  display: inline-block;
  height: 1em;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.skeleton-row {
  padding: 14px;
  display: flex;
  gap: 14px;
  align-items: center;
}
.skeleton-circle {
  width: 40px; height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}
.skeleton-text {
  flex: 1;
  height: 12px;
}
.skeleton-text.short { max-width: 100px; }
.skeleton-text.medium { max-width: 200px; }

/* ════════════════════════════════════════════════════
   4. NUMBER COUNTER (animate counting up)
   ════════════════════════════════════════════════════ */
.stat .n {
  transition: color 0.3s ease;
  display: inline-block;
}
.stat:hover .n {
  transform: scale(1.05);
  transition: transform 0.3s var(--ease-bounce);
}

/* ════════════════════════════════════════════════════
   5. BUTTON RIPPLE EFFECT
   ════════════════════════════════════════════════════ */
.bo, .boo, .bic, button.btn-up, .nav-tab-btn {
  position: relative;
  overflow: hidden;
}
.bo::after, .boo::after, .bic::after, button.btn-up::after, .nav-tab-btn::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 0; height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
  pointer-events: none;
}
.bo:active::after, .boo:active::after, .bic:active::after,
button.btn-up:active::after, .nav-tab-btn:active::after {
  width: 300px;
  height: 300px;
  transition: 0s;
}

/* ════════════════════════════════════════════════════
   6. SMOOTH MODAL ANIMATION
   ════════════════════════════════════════════════════ */
.mo {
  transition: opacity 0.35s var(--ease-smooth), backdrop-filter 0.35s ease;
}
.mo.open {
  animation: modalBackdrop 0.35s var(--ease-smooth);
}
@keyframes modalBackdrop {
  from { backdrop-filter: blur(0px); background: rgba(0,0,0,0); }
  to { backdrop-filter: blur(6px); background: rgba(0,0,0,0.4); }
}
.mo .sh, .mo .swal2-popup, .mo > div:not([class]), .mo .modal-card {
  animation: modalPop 0.45s var(--ease-bounce);
}
@keyframes modalPop {
  0% { opacity: 0; transform: scale(0.9) translateY(20px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* SweetAlert popup animation override */
.swal2-popup.swal2-show {
  animation: modalPop 0.45s var(--ease-bounce) !important;
}

/* ════════════════════════════════════════════════════
   7. TOAST SLIDE
   ════════════════════════════════════════════════════ */
.toast-custom {
  animation: toastSlide 0.5s var(--ease-bounce);
}
@keyframes toastSlide {
  from { opacity: 0; transform: translate(-50%, -100%); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

/* ════════════════════════════════════════════════════
   8. HOVER LIFT
   ════════════════════════════════════════════════════ */
.co, .stat, .feature-card, .pl-row, button.btn-up, .nav-tab-btn {
  transition:
    transform 0.3s var(--ease-smooth),
    box-shadow 0.3s var(--ease-smooth),
    border-color 0.3s ease;
}
.stat:hover, .feature-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px var(--orange-glow);
}
.bo:hover, .boo:hover, button.btn-up:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px var(--orange-glow-strong);
}
.bo:active, .boo:active, button.btn-up:active {
  transform: translateY(0);
}

/* ════════════════════════════════════════════════════
   9. GRADIENT BORDERS
   ════════════════════════════════════════════════════ */
.co {
  position: relative;
}
.co::before {
  content: '';
  position: absolute;
  top: -1px; left: -1px; right: -1px;
  height: 3px;
  background: linear-gradient(90deg, #FF6B35, #FF9853, #FFB088, #FF6B35);
  background-size: 200% 100%;
  border-radius: inherit inherit 0 0;
  opacity: 0;
  transition: opacity 0.4s ease;
  animation: gradientShift 4s linear infinite;
}
.co:hover::before { opacity: 1; }
@keyframes gradientShift {
  0% { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}

/* ════════════════════════════════════════════════════
   10. SOFT ORANGE SHADOWS (no black)
   ════════════════════════════════════════════════════ */
.co {
  box-shadow:
    0 1px 3px rgba(255, 107, 53, 0.04),
    0 4px 16px rgba(255, 107, 53, 0.06);
}

/* ════════════════════════════════════════════════════
   11. STATUS PILLS - Refined
   ════════════════════════════════════════════════════ */
.pl-st {
  display: inline-flex !important;
  align-items: center;
  gap: 6px;
  padding: 4px 12px !important;
  border-radius: 100px !important;
  font-size: 12px !important;
  font-weight: 500;
  letter-spacing: 0.01em;
  transition: transform 0.2s var(--ease-bounce);
  position: relative;
  overflow: hidden;
}
.pl-st::before {
  content: '';
  width: 6px; height: 6px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.pl-st.pls-w::before { background: #FF9800; box-shadow: 0 0 0 3px rgba(255,152,0,0.2); animation: pulse-dot 2s infinite; }
.pl-st.pls-c::before { background: #2196F3; box-shadow: 0 0 0 3px rgba(33,150,243,0.2); animation: pulse-dot 2s infinite; }
.pl-st.pls-d::before { background: #4CAF50; box-shadow: 0 0 0 3px rgba(76,175,80,0.2); }
.pl-st.pls-f::before { background: #F44336; box-shadow: 0 0 0 3px rgba(244,67,54,0.2); }
@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 3px rgba(255,152,0,0.2); }
  50% { box-shadow: 0 0 0 6px rgba(255,152,0,0.05); }
}

/* ════════════════════════════════════════════════════
   12. ACTIVE TAB INDICATOR (sliding underline)
   ════════════════════════════════════════════════════ */
.nav-tab-btn {
  position: relative;
  transition: color 0.3s ease;
}
.nav-tab-btn::before {
  content: '';
  position: absolute;
  bottom: 0; left: 50%;
  width: 0; height: 3px;
  background: linear-gradient(90deg, #FF6B35, #FF9853);
  border-radius: 3px 3px 0 0;
  transform: translateX(-50%);
  transition: width 0.4s var(--ease-bounce);
}
.nav-tab-btn.active::before { width: 70%; }

/* ════════════════════════════════════════════════════
   13. INPUT FOCUS GLOW
   ════════════════════════════════════════════════════ */
.fco, input[type="text"]:not(.search-input), input[type="email"]:not(.search-input),
input[type="password"]:not(.search-input), input[type="number"]:not(.search-input),
input[type="search"]:not(.search-input), select.fco, textarea.fco {
  transition:
    border-color 0.3s ease,
    box-shadow 0.3s ease,
    background 0.3s ease;
}
.fco:focus, input:focus, select.fco:focus, textarea.fco:focus {
  outline: none !important;
  border-color: #FF6B35 !important;
  box-shadow: 0 0 0 4px rgba(255, 107, 53, 0.12) !important;
  background: #FFFAF5 !important;
}

/* ════════════════════════════════════════════════════
   14. EMPTY STATE
   ════════════════════════════════════════════════════ */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  animation: fadeIn 0.6s ease;
}
.empty-state-icon {
  width: 80px; height: 80px;
  margin: 0 auto 20px;
  background: linear-gradient(135deg, #FFE4D1, #FFD1B8);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  color: #FF6B35;
  animation: floatIcon 3s ease-in-out infinite;
}
@keyframes floatIcon {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.empty-state-title {
  font-size: 17px;
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
}
.empty-state-text {
  font-size: 14px;
  color: #999;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ════════════════════════════════════════════════════
   15. SUCCESS CHECKMARK ANIMATION
   ════════════════════════════════════════════════════ */
.success-check {
  width: 60px; height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF50, #2E7D32);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  animation: checkPop 0.6s var(--ease-bounce);
  position: relative;
}
.success-check::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid #4CAF50;
  opacity: 0;
  animation: checkRing 0.8s ease 0.2s forwards;
}
.success-check svg {
  width: 32px; height: 32px;
  fill: white;
  animation: checkDraw 0.5s ease 0.3s both;
}
@keyframes checkPop {
  from { transform: scale(0); }
  to { transform: scale(1); }
}
@keyframes checkRing {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.4); opacity: 0; }
}
@keyframes checkDraw {
  from { stroke-dashoffset: 30; opacity: 0; }
  to { stroke-dashoffset: 0; opacity: 1; }
}

/* ════════════════════════════════════════════════════
   16. SCROLL REVEAL
   ════════════════════════════════════════════════════ */
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s var(--ease-smooth), transform 0.6s var(--ease-smooth);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ════════════════════════════════════════════════════
   17. SEARCH HIGHLIGHT
   ════════════════════════════════════════════════════ */
.search-hl {
  background: linear-gradient(120deg, #FFE082 0%, #FFCC80 100%);
  padding: 1px 4px;
  border-radius: 4px;
  font-weight: 600;
  color: #BF360C;
  animation: highlightPop 0.3s var(--ease-bounce);
}
@keyframes highlightPop {
  from { transform: scale(0.95); }
  50% { transform: scale(1.05); }
  to { transform: scale(1); }
}

/* ════════════════════════════════════════════════════
   18. LOADING SPINNER (replace fa-spinner)
   ════════════════════════════════════════════════════ */
.custom-spinner {
  width: 32px; height: 32px;
  border-radius: 50%;
  border: 3px solid #FFE4D1;
  border-top-color: #FF6B35;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ════════════════════════════════════════════════════
   19. ROW HOVER (table rows)
   ════════════════════════════════════════════════════ */
.dt tbody tr {
  transition: background 0.2s ease, transform 0.15s ease;
}
.dt tbody tr:hover {
  background: #FFF8F2 !important;
}

/* ════════════════════════════════════════════════════
   20. BADGE PULSE (for notification count)
   ════════════════════════════════════════════════════ */
.badge-pulse {
  animation: badgePulse 2s ease-in-out infinite;
}
@keyframes badgePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(244, 67, 54, 0); }
}

/* ════════════════════════════════════════════════════
   21. SMOOTH SCROLL
   ════════════════════════════════════════════════════ */
html { scroll-behavior: smooth; }

/* ════════════════════════════════════════════════════
   22. REDUCED MOTION (a11y)
   ════════════════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ════════════════════════════════════════════════════
   23. CUSTOM SCROLLBAR
   ════════════════════════════════════════════════════ */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #FFB088, #FF8E5C);
  border-radius: 100px;
  border: 2px solid transparent;
  background-clip: padding-box;
  transition: background 0.3s ease;
}
::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #FF8E5C, #FF6B35);
  background-clip: padding-box;
  border: 2px solid transparent;
}

/* ════════════════════════════════════════════════════
   24. DARK MODE SUPPORT
   ════════════════════════════════════════════════════ */
body.dark-mode {
  background: #1F1B17 !important;
  color: #E8E0D5 !important;
}
body.dark-mode .co {
  background: #2A241F !important;
  border-color: #3D352D !important;
  color: #E8E0D5;
}
body.dark-mode .stat {
  background: #2A241F !important;
  border-color: #3D352D !important;
}
body.dark-mode .stat .l { color: #C9BBA8 !important; }
body.dark-mode .fco, body.dark-mode input, body.dark-mode select.fco {
  background: #2A241F !important;
  border-color: #3D352D !important;
  color: #E8E0D5 !important;
}
body.dark-mode .dt thead th {
  background: #2A241F !important;
  color: #C9BBA8 !important;
}
body.dark-mode .dt tbody tr:hover {
  background: #2A241F !important;
}
body.dark-mode .skeleton {
  background: linear-gradient(90deg, #2A241F 0%, #3D352D 50%, #2A241F 100%);
}

/* ════════════════════════════════════════════════════
   25. MOBILE BOTTOM NAV (will show on mobile)
   ════════════════════════════════════════════════════ */
.mobile-bottom-nav {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-top: 1px solid #FFE4D1;
  padding: 8px 4px env(safe-area-inset-bottom);
  z-index: 99;
  box-shadow: 0 -4px 20px rgba(255, 107, 53, 0.08);
}
.mobile-bottom-nav-inner {
  display: flex;
  justify-content: space-around;
  align-items: center;
  max-width: 600px;
  margin: 0 auto;
}
.mb-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  border-radius: 12px;
  cursor: pointer;
  color: #999;
  transition: all 0.3s ease;
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 10px;
  font-weight: 500;
  gap: 3px;
}
.mb-item i { font-size: 18px; }
.mb-item.active {
  color: #FF6B35;
  background: linear-gradient(180deg, #FFE4D1, transparent);
}
@media (max-width: 768px) {
  .mobile-bottom-nav { display: block; }
  body { padding-bottom: 70px; }
}
