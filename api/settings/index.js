// api/settings/index.js - รวม public, save, announcements
//   GET  /api/settings  → public settings + announcement
//   POST /api/settings  → save settings (admin only)
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
  announcementOn:  'ANNOUNCEMENT_ON'
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  // ── GET: public settings ──
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
        announcementOn:  map.ANNOUNCEMENT_ON  || 'OFF'
      });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

  // ── POST: save settings (admin only) ──
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
