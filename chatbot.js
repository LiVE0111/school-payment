// chatbot.js - FAQ Bot ฟรี รองรับ TH/EN
// Auto-loads on page that has <script src="/chatbot.js">

(function () {
  'use strict';

  // ─────────────────────────────────────────
  // CONFIG: FAQ DATABASE (TH + EN)
  // ─────────────────────────────────────────
  const FAQ = {
    th: {
      welcome: 'สวัสดีครับ! ผมเป็นผู้ช่วยอัตโนมัติของระบบชำระค่าบำรุงการศึกษา 🤖\n\nคุณต้องการสอบถามเรื่องอะไรครับ?',
      welcomeQuick: ['💰 ค่าเทอมของลูก', '📱 วิธีชำระเงิน', '📄 อัปโหลดสลิปยังไง', '☎️ ติดต่อโรงเรียน'],
      notFound: 'ขออภัยครับ ผมไม่เข้าใจคำถาม 😅\nคุณอยากให้ส่งคำถามให้เจ้าหน้าที่ตอบโดยตรงไหมครับ?',
      forwarded: '✅ ส่งคำถามให้เจ้าหน้าที่แล้วครับ จะติดต่อกลับโดยเร็วที่สุด',
      askLang: 'คุณต้องการคุยภาษาอะไรครับ?',
      placeholder: 'พิมพ์คำถาม...',
      send: 'ส่ง',
      askForward: 'ส่งคำถามให้เจ้าหน้าที่',
      typing: 'กำลังพิมพ์...',
      askIdCard: 'กรุณากรอกเลขบัตรประชาชน 13 หลักของนักเรียนครับ',
      askContact: 'กรุณาฝากเบอร์โทรหรือ LINE ID เพื่อให้เจ้าหน้าที่ติดต่อกลับ',
      forwardError: 'ส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      yes: 'ใช่ ส่งเลย',
      no: 'ไม่เป็นไร',
      tryAgain: 'พิมพ์ใหม่',
      contactGiven: 'ขอบคุณครับ คำถามของคุณได้ส่งให้เจ้าหน้าที่แล้ว 🙏'
    },
    en: {
      welcome: 'Hello! I am the automated assistant for the school payment system. 🤖\n\nHow can I help you?',
      welcomeQuick: ['💰 Tuition fee', '📱 How to pay', '📄 Upload slip', '☎️ Contact school'],
      notFound: "Sorry, I don't understand. 😅\nWould you like to send your question to the staff?",
      forwarded: '✅ Your question has been sent to the staff. They will get back to you soon.',
      askLang: 'What language would you like to use?',
      placeholder: 'Type your question...',
      send: 'Send',
      askForward: 'Forward to staff',
      typing: 'Typing...',
      askIdCard: 'Please enter the 13-digit student ID card.',
      askContact: 'Please leave your phone or LINE ID so staff can contact you back.',
      forwardError: 'Failed to send. Please try again.',
      yes: 'Yes, send it',
      no: 'No, thanks',
      tryAgain: 'Type again',
      contactGiven: 'Thank you! Your question has been sent to the staff. 🙏'
    }
  };

  // intents: keyword → handler
  // intent matching จะใช้ keywords (lowercase, includes)
  const INTENTS = [
    {
      keywords: {
        th: ['สวัสดี','หวัดดี','hello','hi','ดีครับ','ดีค่ะ','ทักทาย'],
        en: ['hello','hi','hey','good morning','good afternoon','good evening']
      },
      handler: (lang, ctx) => ({
        text: lang==='th' ? 'สวัสดีครับ! 👋 มีอะไรให้ช่วยไหมครับ?' : 'Hello! 👋 How can I help you?',
        quick: FAQ[lang].welcomeQuick
      })
    },
    {
      keywords: {
        th: ['ขอบคุณ','ขอบใจ','thanks','thank'],
        en: ['thanks','thank you','thx','ty']
      },
      handler: (lang) => ({
        text: lang==='th' ? 'ยินดีครับ 🙏 มีอะไรอีกไหมครับ?' : "You're welcome 🙏 Anything else?",
        quick: FAQ[lang].welcomeQuick
      })
    },
    {
      // ค่าเทอม / ยอดที่ต้องจ่าย
      keywords: {
        th: ['ค่าเทอม','ยอด','ค่าเรียน','ค่าใช้จ่าย','ลูก','นักเรียน','เลขบัตร','ตรวจสอบ','เช็ค','ดูบิล','ค้างชำระ'],
        en: ['tuition','fee','amount','bill','my child','student','id card','check','outstanding']
      },
      requiresIdCard: true,
      handler: async (lang, ctx) => {
        try {
          const r = await window.api('/student/search?idCard=' + encodeURIComponent(ctx.idCard));
          if (!r.found) {
            return { text: lang==='th' ? '❌ ไม่พบข้อมูลนักเรียนนี้ในระบบครับ\nกรุณาตรวจสอบเลขบัตรอีกครั้ง' : "❌ Student not found.\nPlease check the ID card again." };
          }
          const s = r.student;
          const pay = r.payments || [];
          const pending = pay.filter(p => p.status === 'รอชำระ' || p.status === 'ชำระไม่สำเร็จ');
          const checking = pay.filter(p => p.status === 'กำลังตรวจสอบ');
          const paid = pay.filter(p => p.status === 'ชำระแล้ว');

          let text = lang==='th'
            ? `📋 ข้อมูลนักเรียน\n👤 ${s.name}\n🏫 ${s.class}\n\n`
            : `📋 Student Info\n👤 ${s.name}\n🏫 ${s.class}\n\n`;

          if (pending.length > 0) {
            const total = pending.reduce((sum,p) => sum + Number(p.amount||0), 0);
            text += lang==='th'
              ? `🔴 ค้างชำระ ${pending.length} รายการ\nรวม ฿${total.toLocaleString()}\n\nรายการ:\n`
              : `🔴 Outstanding: ${pending.length} item(s)\nTotal: ฿${total.toLocaleString()}\n\nDetails:\n`;
            pending.forEach(p => { text += `• ${p.title} (${p.year}/${p.term}) — ฿${Number(p.amount).toLocaleString()}\n`; });
          } else if (checking.length > 0) {
            text += lang==='th'
              ? `🟡 มี ${checking.length} รายการกำลังตรวจสอบสลิป\nรอเจ้าหน้าที่อนุมัติ`
              : `🟡 ${checking.length} item(s) under review`;
          } else if (paid.length > 0) {
            text += lang==='th' ? '✅ ชำระครบแล้วทุกรายการ ขอบคุณครับ!' : '✅ All paid. Thank you!';
          } else {
            text += lang==='th' ? 'ยังไม่มีรายการแจ้งหนี้' : 'No bills yet';
          }

          return {
            text,
            quick: pending.length>0
              ? (lang==='th' ? ['📱 วิธีชำระเงิน','📄 อัปโหลดสลิปยังไง'] : ['📱 How to pay','📄 Upload slip'])
              : FAQ[lang].welcomeQuick
          };
        } catch (e) {
          return { text: lang==='th' ? '❌ เกิดข้อผิดพลาด: ' + e.message : '❌ Error: ' + e.message };
        }
      }
    },
    {
      // วิธีชำระเงิน
      keywords: {
        th: ['ชำระ','จ่าย','โอน','สแกน','qr','พร้อมเพย์','พร้อมเพ','วิธี','ขั้นตอน'],
        en: ['pay','payment','transfer','scan','qr','promptpay','how to','step']
      },
      handler: (lang) => ({
        text: lang==='th'
          ? `📱 วิธีชำระเงิน:\n\n1️⃣ กรอกเลขบัตรประชาชนนักเรียน 13 หลัก\n2️⃣ กดค้นหา ดูรายการที่ต้องชำระ\n3️⃣ เปิดแอปธนาคาร > สแกน QR\n4️⃣ ตรวจสอบยอดและกดยืนยัน\n5️⃣ บันทึกสลิปไว้\n6️⃣ กดปุ่ม "แจ้งโอนเงิน" ที่หน้านี้\n7️⃣ อัปโหลดสลิป + กรอกชื่อผู้โอน\n8️⃣ รอเจ้าหน้าที่อนุมัติ\n\n⚠️ ถ้าใช้ PromptPay ต้องระบุรหัสนักเรียนในช่องบันทึกช่วยจำด้วยครับ`
          : `📱 How to pay:\n\n1️⃣ Enter the 13-digit student ID card\n2️⃣ Click search to see bills\n3️⃣ Open banking app > Scan QR\n4️⃣ Confirm amount and pay\n5️⃣ Save the slip\n6️⃣ Click "Submit transfer" button\n7️⃣ Upload slip + sender name\n8️⃣ Wait for staff approval\n\n⚠️ For PromptPay, write student ID in the memo`,
        quick: lang==='th' ? ['💰 ค่าเทอมของลูก','📄 อัปโหลดสลิปยังไง','☎️ ติดต่อโรงเรียน'] : ['💰 Tuition fee','📄 Upload slip','☎️ Contact school']
      })
    },
    {
      // อัปโหลดสลิป
      keywords: {
        th: ['สลิป','อัปโหลด','อัพโหลด','รูป','ภาพ','แจ้งโอน','หลักฐาน'],
        en: ['slip','upload','image','photo','submit transfer','receipt','proof']
      },
      handler: (lang) => ({
        text: lang==='th'
          ? `📄 วิธีอัปโหลดสลิป:\n\n1️⃣ ค้นหาด้วยเลขบัตรนักเรียนก่อน\n2️⃣ ดูรายการที่ต้องชำระ\n3️⃣ กดปุ่ม "แจ้งโอนเงิน / อัปโหลดสลิป"\n4️⃣ กรอกชื่อผู้โอน (ตามสลิป)\n5️⃣ เลือกรูปสลิป (ไม่เกิน 5MB)\n6️⃣ กดยืนยัน\n7️⃣ สถานะจะเปลี่ยนเป็น "รอตรวจสอบ"\n\n💡 ทิป: ถ่ายรูปสลิปให้ชัด เห็นเลขที่อ้างอิง วันที่ และยอดเงินครบ`
          : `📄 How to upload slip:\n\n1️⃣ Search by student ID first\n2️⃣ View pending bills\n3️⃣ Click "Submit transfer / Upload slip"\n4️⃣ Enter sender name (as on slip)\n5️⃣ Choose slip image (max 5MB)\n6️⃣ Confirm\n7️⃣ Status changes to "Under review"\n\n💡 Tip: Take a clear photo showing reference number, date, and amount`,
        quick: lang==='th' ? ['💰 ค่าเทอมของลูก','📱 วิธีชำระเงิน'] : ['💰 Tuition fee','📱 How to pay']
      })
    },
    {
      // ติดต่อโรงเรียน
      keywords: {
        th: ['ติดต่อ','เบอร์','โทร','line','ไลน์','อีเมล','email','โรงเรียน','สอบถาม'],
        en: ['contact','phone','call','line','email','school','inquire']
      },
      handler: (lang, ctx) => {
        const cfg = window.__chatbotCfg || {};
        let text = lang==='th' ? '☎️ ช่องทางติดต่อโรงเรียน:\n\n' : '☎️ Contact information:\n\n';
        const items = [];
        if (cfg.contactPhone) items.push((lang==='th'?'📞 โทร: ':'📞 Phone: ') + cfg.contactPhone);
        if (cfg.contactLine)  items.push('💬 LINE: ' + cfg.contactLine);
        if (cfg.contactEmail) items.push('📧 Email: ' + cfg.contactEmail);
        if (items.length === 0) {
          text += lang==='th' ? 'ยังไม่ได้ตั้งค่าข้อมูลติดต่อในระบบ\nกรุณาติดต่อเจ้าหน้าที่ผ่านช่องทางอื่น' : 'Contact info not set up yet';
        } else {
          text += items.join('\n');
        }
        return { text, quick: FAQ[lang].welcomeQuick };
      }
    },
    {
      // สถานะการชำระ
      keywords: {
        th: ['สถานะ','รอตรวจ','อนุมัติ','ผ่านไหม','ตรวจสอบสลิป','รออนุมัติ'],
        en: ['status','review','approve','approved','pending']
      },
      handler: (lang) => ({
        text: lang==='th'
          ? `📊 สถานะการชำระมี 4 แบบ:\n\n⏳ รอชำระ — ยังไม่ได้โอนเงิน\n🔍 รอตรวจสอบ — ส่งสลิปแล้ว รอเจ้าหน้าที่ดู\n✅ ชำระแล้ว — เจ้าหน้าที่อนุมัติแล้ว\n❌ ไม่ผ่าน — สลิปมีปัญหา ดูเหตุผลและส่งใหม่\n\nโดยปกติเจ้าหน้าที่จะตรวจสอบภายใน 1-2 วันทำการครับ`
          : `📊 Payment statuses:\n\n⏳ Pending — Not paid yet\n🔍 Under review — Slip submitted\n✅ Paid — Approved\n❌ Rejected — Slip issue, see reason and resubmit\n\nStaff usually reviews within 1-2 business days`,
        quick: lang==='th' ? ['💰 ค่าเทอมของลูก','📱 วิธีชำระเงิน'] : ['💰 Tuition fee','📱 How to pay']
      })
    },
    {
      // เปลี่ยนภาษา
      keywords: {
        th: ['ภาษา','language'],
        en: ['language','ภาษา']
      },
      handler: (lang, ctx) => {
        // toggle
        const newLang = lang==='th' ? 'en' : 'th';
        window.__chatbotLang = newLang;
        try { localStorage.setItem('chatLang', newLang); } catch(e){}
        return {
          text: newLang==='th' ? '✅ เปลี่ยนเป็นภาษาไทยแล้วครับ' : '✅ Switched to English',
          quick: FAQ[newLang].welcomeQuick
        };
      }
    },
    {
      // ลืมรหัสบัตร
      keywords: {
        th: ['ลืม','ไม่รู้','ไม่ทราบ','หาไม่เจอ'],
        en: ['forgot','dont know','cant find']
      },
      handler: (lang) => ({
        text: lang==='th'
          ? '🔍 หาเลขบัตรประชาชนของลูกได้จาก:\n• สำเนาบัตรประชาชนนักเรียน\n• ทะเบียนบ้าน\n• สมุดประจำตัวนักเรียน\n• ติดต่อครูประจำชั้น\n\nหรือติดต่อโรงเรียนเพื่อสอบถามครับ'
          : '🔍 You can find the student ID card from:\n• Student ID copy\n• House registration\n• Student handbook\n• Contact homeroom teacher',
        quick: lang==='th' ? ['☎️ ติดต่อโรงเรียน'] : ['☎️ Contact school']
      })
    }
  ];

  // ─────────────────────────────────────────
  // INTENT MATCHER
  // ─────────────────────────────────────────
  function matchIntent(text, lang) {
    const t = text.toLowerCase().trim();
    if (!t) return null;

    let best = null;
    let bestScore = 0;

    for (const intent of INTENTS) {
      const kws = (intent.keywords[lang] || []).concat(intent.keywords[lang==='th'?'en':'th'] || []);
      let score = 0;
      for (const kw of kws) {
        if (t.includes(kw.toLowerCase())) {
          score += kw.length; // คำที่ยาวกว่า = ตรงกว่า
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = intent;
      }
    }

    return bestScore > 0 ? best : null;
  }

  // ─────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────
  let state = {
    lang: 'th',
    pendingIntent: null,   // intent ที่รอ idCard
    pendingForward: false, // กำลังจะ forward ไป admin (รอ contact)
    pendingQuestion: '',   // คำถามที่จะ forward
    pendingIdCard: ''
  };

  try {
    state.lang = localStorage.getItem('chatLang') || 'th';
  } catch(e){}
  window.__chatbotLang = state.lang;

  // ─────────────────────────────────────────
  // RENDER FUNCTIONS
  // ─────────────────────────────────────────
  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) Object.assign(e, attrs);
    if (html != null) e.innerHTML = html;
    return e;
  }

  function addMsg(text, side) {
    const list = document.getElementById('cb-list');
    if (!list) return;
    const msg = el('div', { className: 'cb-msg cb-msg-' + side });
    const bubble = el('div', { className: 'cb-bubble' });
    bubble.innerText = text;
    msg.appendChild(bubble);
    list.appendChild(msg);
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
  }

  function addQuick(options, callback) {
    const list = document.getElementById('cb-list');
    if (!list) return;
    const wrap = el('div', { className: 'cb-quick' });
    options.forEach(opt => {
      const b = el('button', { className: 'cb-qbtn', innerText: opt });
      b.addEventListener('click', () => {
        wrap.remove();
        callback(opt);
      });
      wrap.appendChild(b);
    });
    list.appendChild(wrap);
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
  }

  function addTyping() {
    const list = document.getElementById('cb-list');
    if (!list) return null;
    const t = el('div', { className: 'cb-msg cb-msg-bot cb-typing' });
    t.innerHTML = '<div class="cb-bubble"><span class="cb-dot"></span><span class="cb-dot"></span><span class="cb-dot"></span></div>';
    list.appendChild(t);
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
    return t;
  }

  // ─────────────────────────────────────────
  // BOT LOGIC
  // ─────────────────────────────────────────
  async function handleUserMessage(text) {
    text = text.trim();
    if (!text) return;
    addMsg(text, 'user');

    const lang = state.lang;
    const T = FAQ[lang];

    // ── ถ้ากำลังรอ contact (forward to admin) ──
    if (state.pendingForward) {
      const contact = text;
      const typing = addTyping();
      try {
        await window.api('/settings?action=ask', {
          method: 'POST',
          body: { question: state.pendingQuestion, idCard: state.pendingIdCard, contact, lang }
        });
        if (typing) typing.remove();
        addMsg(T.contactGiven, 'bot');
        addQuick(T.welcomeQuick, handleUserMessage);
      } catch (e) {
        if (typing) typing.remove();
        addMsg(T.forwardError + '\n' + e.message, 'bot');
      }
      state.pendingForward = false;
      state.pendingQuestion = '';
      state.pendingIdCard = '';
      return;
    }

    // ── ถ้ากำลังรอ idCard ──
    if (state.pendingIntent) {
      const cleaned = text.replace(/\D/g, '');
      if (cleaned.length !== 13) {
        addMsg(lang==='th' ? '❌ เลขบัตรต้อง 13 หลักครับ ลองใหม่อีกครั้ง' : '❌ ID must be 13 digits. Please try again.', 'bot');
        return;
      }
      const intent = state.pendingIntent;
      state.pendingIntent = null;
      const typing = addTyping();
      try {
        const result = await intent.handler(lang, { idCard: cleaned });
        if (typing) typing.remove();
        addMsg(result.text, 'bot');
        if (result.quick) addQuick(result.quick, handleUserMessage);
      } catch (e) {
        if (typing) typing.remove();
        addMsg('❌ ' + e.message, 'bot');
      }
      return;
    }

    // ── ปกติ: หา intent ──
    const typing = addTyping();
    await new Promise(r => setTimeout(r, 400)); // หน่วงเล็กน้อย ดูเหมือนคิด

    const intent = matchIntent(text, lang);
    if (typing) typing.remove();

    if (!intent) {
      // ไม่เจอ → ถามว่าจะ forward ไหม
      addMsg(T.notFound, 'bot');
      addQuick([T.yes, T.no], (choice) => {
        if (choice === T.yes) {
          state.pendingForward = true;
          state.pendingQuestion = text;
          addMsg(T.askContact, 'bot');
        } else {
          addMsg(lang==='th' ? 'ไม่เป็นไรครับ มีอะไรอีกไหม?' : 'No problem. Anything else?', 'bot');
          addQuick(T.welcomeQuick, handleUserMessage);
        }
      });
      return;
    }

    // ถ้า intent ต้องการ idCard
    if (intent.requiresIdCard) {
      state.pendingIntent = intent;
      addMsg(T.askIdCard, 'bot');
      return;
    }

    // เรียก handler
    try {
      const result = await intent.handler(lang, {});
      addMsg(result.text, 'bot');
      if (result.quick) addQuick(result.quick, handleUserMessage);
    } catch (e) {
      addMsg('❌ ' + e.message, 'bot');
    }
  }

  // ─────────────────────────────────────────
  // INJECT WIDGET HTML + CSS
  // ─────────────────────────────────────────
  function injectWidget() {
    if (document.getElementById('cb-fab')) return;

    const css = `
      .cb-fab{
        position:fixed;bottom:20px;right:20px;z-index:9990;
        width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;
        background:linear-gradient(135deg,#FFA85C 0%,#FF6B35 50%,#E53935 100%);
        color:#fff;font-size:1.5rem;
        box-shadow:0 8px 24px rgba(255,107,53,.4);
        display:flex;align-items:center;justify-content:center;
        transition:all .3s cubic-bezier(.34,1.56,.64,1);
        animation:cb-pop .5s cubic-bezier(.34,1.56,.64,1) .8s both, cb-pulse 3s infinite 2s;
      }
      @keyframes cb-pop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
      @keyframes cb-pulse{0%,100%{box-shadow:0 8px 24px rgba(255,107,53,.4)}50%{box-shadow:0 8px 32px rgba(255,107,53,.6),0 0 0 8px rgba(255,107,53,.15)}}
      .cb-fab:hover{transform:scale(1.08) rotate(-5deg)}
      .cb-fab.open{transform:scale(.85) rotate(180deg)}
      .cb-fab-badge{
        position:absolute;top:-3px;right:-3px;
        width:18px;height:18px;background:#fff;color:#E53935;
        border-radius:50%;font-size:.65rem;font-weight:700;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 6px rgba(0,0,0,.2);
        animation:cb-bounce 1s infinite;
      }
      @keyframes cb-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}

      .cb-panel{
        position:fixed;bottom:90px;right:20px;z-index:9991;
        width:360px;max-width:calc(100vw - 30px);
        height:540px;max-height:calc(100vh - 110px);
        background:var(--bg-card,#fff);
        border-radius:20px;overflow:hidden;
        box-shadow:0 20px 60px rgba(0,0,0,.25);
        display:none;flex-direction:column;
        font-family:'Prompt',sans-serif;
        animation:cb-in .35s cubic-bezier(.34,1.56,.64,1);
      }
      [data-theme="dark"] .cb-panel{background:#241510;border:1px solid #3d2820}
      .cb-panel.open{display:flex}
      @keyframes cb-in{from{opacity:0;transform:translateY(20px) scale(.92)}to{opacity:1;transform:none}}

      .cb-header{
        background:linear-gradient(135deg,#FFA85C 0%,#FF6B35 50%,#E53935 100%);
        color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px;
        position:relative;overflow:hidden;
      }
      .cb-header::before{
        content:'';position:absolute;inset:0;
        background:url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='.08'%3E%3Cpath d='M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 1.4l2.83 2.83 1.41-1.41L1.41 0H0v1.41zM38.59 40l-2.83-2.83 1.41-1.41L40 38.59V40h-1.41zM40 1.41l-2.83 2.83-1.41-1.41L38.59 0H40v1.41zM20 18.6l2.83-2.83 1.41 1.41L21.41 20l2.83 2.83-1.41 1.41L20 21.41l-2.83 2.83-1.41-1.41L18.59 20l-2.83-2.83 1.41-1.41L20 18.59z'/%3E%3C/g%3E%3C/svg%3E");
        opacity:.5;pointer-events:none;
      }
      .cb-h-avatar{
        width:38px;height:38px;border-radius:50%;
        background:rgba(255,255,255,.25);border:2px solid rgba(255,255,255,.5);
        display:flex;align-items:center;justify-content:center;font-size:1.1rem;
        flex-shrink:0;position:relative;z-index:1;
      }
      .cb-h-info{flex:1;position:relative;z-index:1}
      .cb-h-title{font-size:.95rem;font-weight:700;line-height:1.2}
      .cb-h-status{font-size:.72rem;opacity:.85;display:flex;align-items:center;gap:4px}
      .cb-h-status::before{content:'';width:6px;height:6px;border-radius:50%;background:#76ff03;box-shadow:0 0 0 0 #76ff03;animation:cb-pulse-dot 1.5s infinite}
      @keyframes cb-pulse-dot{0%{box-shadow:0 0 0 0 rgba(118,255,3,.7)}70%{box-shadow:0 0 0 6px rgba(118,255,3,0)}100%{box-shadow:0 0 0 0 rgba(118,255,3,0)}}
      .cb-h-actions{display:flex;gap:6px;position:relative;z-index:1}
      .cb-h-btn{
        background:rgba(255,255,255,.2);border:none;color:#fff;
        width:30px;height:30px;border-radius:50%;cursor:pointer;
        display:flex;align-items:center;justify-content:center;font-size:.78rem;
        transition:all .2s;
      }
      .cb-h-btn:hover{background:rgba(255,255,255,.35)}

      .cb-list{
        flex:1;overflow-y:auto;padding:14px 14px 8px;
        background:var(--bg,#FFF8F2);
        scroll-behavior:smooth;
      }
      [data-theme="dark"] .cb-list{background:#1a0f0a}
      .cb-list::-webkit-scrollbar{width:5px}
      .cb-list::-webkit-scrollbar-thumb{background:#FFD0B5;border-radius:3px}

      .cb-msg{margin-bottom:10px;display:flex;animation:cb-msgIn .3s ease both}
      @keyframes cb-msgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      .cb-msg-bot{justify-content:flex-start}
      .cb-msg-user{justify-content:flex-end}
      .cb-bubble{
        max-width:85%;padding:10px 14px;border-radius:16px;
        font-size:.86rem;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;
      }
      .cb-msg-bot .cb-bubble{
        background:#fff;color:#1a1a2e;
        border-radius:16px 16px 16px 4px;
        box-shadow:0 2px 8px rgba(0,0,0,.05);
      }
      [data-theme="dark"] .cb-msg-bot .cb-bubble{background:#2d1c15;color:#fff8f2}
      .cb-msg-user .cb-bubble{
        background:linear-gradient(135deg,#FF8A5C,#FF6B35);
        color:#fff;border-radius:16px 16px 4px 16px;
        box-shadow:0 2px 8px rgba(255,107,53,.25);
      }

      .cb-typing .cb-bubble{padding:14px 16px}
      .cb-dot{
        display:inline-block;width:6px;height:6px;border-radius:50%;background:#bbb;margin:0 2px;
        animation:cb-blink 1.2s infinite;
      }
      .cb-dot:nth-child(2){animation-delay:.2s}
      .cb-dot:nth-child(3){animation-delay:.4s}
      @keyframes cb-blink{0%,80%,100%{opacity:.3}40%{opacity:1}}

      .cb-quick{
        display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px;
        animation:cb-msgIn .3s ease both;
      }
      .cb-qbtn{
        background:#fff;border:1.5px solid #FFD0B5;color:#E53935;
        padding:7px 13px;border-radius:50px;
        font-family:'Prompt',sans-serif;font-size:.78rem;font-weight:500;
        cursor:pointer;transition:all .2s;
      }
      [data-theme="dark"] .cb-qbtn{background:#2d1c15;border-color:#4d3025;color:#FF8A5C}
      .cb-qbtn:hover{background:linear-gradient(135deg,#FFA85C,#FF6B35);color:#fff;border-color:#FF6B35;transform:translateY(-1px);box-shadow:0 4px 10px rgba(255,107,53,.25)}
      .cb-qbtn:active{transform:scale(.97)}

      .cb-input-wrap{
        background:var(--bg-card,#fff);
        border-top:1px solid #FFE4D6;
        padding:10px;display:flex;gap:8px;
      }
      [data-theme="dark"] .cb-input-wrap{background:#241510;border-top-color:#3d2820}
      .cb-input{
        flex:1;border:1.5px solid #FFE4D6;border-radius:50px;
        padding:9px 16px;font-family:'Prompt',sans-serif;font-size:.86rem;
        background:#FFFAF6;color:#1a1a2e;outline:none;
        transition:all .2s;
      }
      [data-theme="dark"] .cb-input{background:#1a0f0a;border-color:#3d2820;color:#fff8f2}
      .cb-input:focus{border-color:#FF6B35;background:#fff;box-shadow:0 0 0 3px rgba(255,107,53,.1)}
      [data-theme="dark"] .cb-input:focus{background:#2d1c15}
      .cb-send{
        width:38px;height:38px;border:none;border-radius:50%;
        background:linear-gradient(135deg,#FF8A5C,#FF6B35);
        color:#fff;cursor:pointer;font-size:.85rem;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
        transition:all .2s;
      }
      .cb-send:hover{transform:scale(1.1) rotate(-15deg);box-shadow:0 4px 12px rgba(255,107,53,.4)}
      .cb-send:active{transform:scale(.95)}
      .cb-send:disabled{opacity:.5;cursor:not-allowed;transform:none}

      @media (max-width:420px){
        .cb-panel{
          right:0;left:0;bottom:0;width:100%;max-width:100%;
          height:88vh;max-height:88vh;
          border-radius:20px 20px 0 0;
        }
        .cb-fab{bottom:14px;right:14px;width:54px;height:54px}
      }
    `;
    const style = el('style', { id: 'cb-style' }, css);
    document.head.appendChild(style);

    // FAB button
    const fab = el('button', { id: 'cb-fab', className: 'cb-fab', title: 'แชทช่วยเหลือ' });
    fab.innerHTML = '<i class="fas fa-comments"></i><span class="cb-fab-badge">1</span>';
    fab.addEventListener('click', toggleChat);
    document.body.appendChild(fab);

    // Panel
    const panel = el('div', { id: 'cb-panel', className: 'cb-panel' });
    panel.innerHTML = `
      <div class="cb-header">
        <div class="cb-h-avatar"><i class="fas fa-robot"></i></div>
        <div class="cb-h-info">
          <div class="cb-h-title" id="cb-title">ผู้ช่วยอัตโนมัติ</div>
          <div class="cb-h-status" id="cb-status">ออนไลน์ • พร้อมช่วยเหลือ</div>
        </div>
        <div class="cb-h-actions">
          <button class="cb-h-btn" id="cb-lang-btn" title="เปลี่ยนภาษา">TH</button>
          <button class="cb-h-btn" onclick="document.getElementById('cb-fab').click()" title="ปิด">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div class="cb-list" id="cb-list"></div>
      <form class="cb-input-wrap" id="cb-form">
        <input type="text" class="cb-input" id="cb-input" placeholder="พิมพ์คำถาม..." autocomplete="off">
        <button type="submit" class="cb-send" aria-label="send">
          <i class="fas fa-paper-plane"></i>
        </button>
      </form>
    `;
    document.body.appendChild(panel);

    // Form submit
    document.getElementById('cb-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('cb-input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      handleUserMessage(text);
    });

    // Lang toggle
    document.getElementById('cb-lang-btn').addEventListener('click', () => {
      state.lang = state.lang === 'th' ? 'en' : 'th';
      window.__chatbotLang = state.lang;
      try { localStorage.setItem('chatLang', state.lang); } catch(e){}
      updateLangUI();
      const T = FAQ[state.lang];
      addMsg(state.lang==='th' ? '✅ เปลี่ยนเป็นภาษาไทยแล้ว' : '✅ Switched to English', 'bot');
      addQuick(T.welcomeQuick, handleUserMessage);
    });

    updateLangUI();
  }

  function updateLangUI() {
    const T = FAQ[state.lang];
    const btn = document.getElementById('cb-lang-btn');
    if (btn) btn.innerText = state.lang === 'th' ? 'EN' : 'TH';
    const input = document.getElementById('cb-input');
    if (input) input.placeholder = T.placeholder;
    const title = document.getElementById('cb-title');
    if (title) title.innerText = state.lang === 'th' ? 'ผู้ช่วยอัตโนมัติ' : 'Auto Assistant';
    const status = document.getElementById('cb-status');
    if (status) status.innerText = state.lang === 'th' ? 'ออนไลน์ • พร้อมช่วยเหลือ' : 'Online • Ready to help';
  }

  let opened = false;
  function toggleChat() {
    const panel = document.getElementById('cb-panel');
    const fab = document.getElementById('cb-fab');
    if (panel.classList.contains('open')) {
      panel.classList.remove('open');
      fab.classList.remove('open');
      fab.innerHTML = '<i class="fas fa-comments"></i>';
    } else {
      panel.classList.add('open');
      fab.classList.add('open');
      fab.innerHTML = '<i class="fas fa-times"></i>';
      if (!opened) {
        opened = true;
        const T = FAQ[state.lang];
        setTimeout(() => {
          addMsg(T.welcome, 'bot');
          addQuick(T.welcomeQuick, handleUserMessage);
        }, 200);
      }
    }
  }

  // Load contact info from settings
  function loadConfig() {
    if (typeof window.api !== 'function') {
      setTimeout(loadConfig, 200);
      return;
    }
    window.api('/settings').then(cfg => {
      window.__chatbotCfg = cfg;
    }).catch(() => {});
  }

  // ─────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    injectWidget();
    loadConfig();
  }

  init();
})();
