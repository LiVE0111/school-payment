// api/settings/index.js - settings + chatbot inquiries
//   GET  /api/settings              → public settings + announcement
//   POST /api/settings              → save settings (admin only)
//   POST /api/settings?action=ask   → ส่งคำถามจาก chatbot (เก็บไว้ใน DB ให้ admin ดู)
//   GET  /api/settings?action=inquiries → ดู inquiries (admin only)
//   POST /api/settings?action=resolve   → mark resolved (admin only)
//
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

const KEY_MAP = {
  systemStatus:    'SYSTEM_STATUS',
  closedMessage:   'CLOSED_MESSAGE',
  taxId:           'TAX_ID',
  billerSuffix:    'BILLER_SUFFIX',
  schoolName:      'SCHOOL_NAME',
  logoUrl:         'LOGO_URL',
  announcement:    'ANNOUNCEMENT',
  announcementOn:  'ANNOUNCEMENT_ON',
  contactPhone:    'CONTACT_PHONE',
  contactLine:     'CONTACT_LINE',
  contactEmail:    'CONTACT_EMAIL'
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  const action = req.query.action;

  // ── POST /api/settings?action=ask : บันทึกคำถามจาก chatbot ──
  if (req.method === 'POST' && action === 'ask') {
    try {
      const { question, idCard, contact, lang } = req.body || {};
      if (!question || !question.trim()) return fail(res, 'กรุณากรอกคำถาม');

      await supabase.from('inquiries').insert({
        question:   question.trim().slice(0, 500),
        id_card:    (idCard || '').trim().slice(0, 13),
        contact:    (contact || '').trim().slice(0, 100),
        lang:       lang === 'en' ? 'en' : 'th',
        status:     'pending'
      });

      return ok(res, { message: 'ส่งคำถามให้เจ้าหน้าที่แล้ว' });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

  // ── GET /api/settings?action=inquiries : ดู inquiries (admin) ──
  if (req.method === 'GET' && action === 'inquiries') {
    const user = requireAdmin(req);
    if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

    try {
      const { data } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      return ok(res, { inquiries: data || [] });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

  // ── POST /api/settings?action=resolve : mark resolved (admin) ──
  if (req.method === 'POST' && action === 'resolve') {
    const user = requireAdmin(req);
    if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

    try {
      const { id, status } = req.body || {};
      if (!id) return fail(res, 'กรุณาระบุ id');
      const newStatus = status === 'pending' ? 'pending' : 'resolved';

      await supabase.from('inquiries')
        .update({ status: newStatus, resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null })
        .eq('id', id);

      return ok(res, { message: 'อัปเดตแล้ว' });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

  // ── GET /api/settings : public settings ──
  if (req.method === 'GET') {
    try {
      const { data } = await supabase.from('settings').select('key,value');
      const map = {};
      (data || []).forEach(r => map[r.key] = r.value);

      return ok(res, {
        systemStatus:    map.SYSTEM_STATUS    || 'ON',
        closedMessage:   map.CLOSED_MESSAGE   || 'ระบบปิดให้บริการชั่วคราว',
        taxId:           map.TAX_ID           || '',
        billerSuffix:    map.BILLER_SUFFIX    || '00',
        schoolName:      map.SCHOOL_NAME      || 'โรงเรียน',
        logoUrl:         map.LOGO_URL         || '',
        announcement:    map.ANNOUNCEMENT     || '',
        announcementOn:  map.ANNOUNCEMENT_ON  || 'OFF',
        contactPhone:    map.CONTACT_PHONE    || '',
        contactLine:     map.CONTACT_LINE     || '',
        contactEmail:    map.CONTACT_EMAIL    || ''
      });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

  // ── POST /api/settings : save settings (admin) ──
  if (req.method === 'POST') {
    const user = requireAdmin(req);
    if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

    try {
      const data = req.body || {};
      const updates = [];

      for (const [k, v] of Object.entries(data)) {
        if (KEY_MAP[k] !== undefined) {
          updates.push({ key: KEY_MAP[k], value: String(v ?? '') });
        }
      }

      if (updates.length === 0) return fail(res, 'ไม่มีข้อมูลให้บันทึก');

      for (const u of updates) {
        await supabase.from('settings').upsert({
          key: u.key,
          value: u.value,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      }

      return ok(res, { count: updates.length });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

  return fail(res, 'Method not allowed', 405);
};
