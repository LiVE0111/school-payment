// api/admin/classes.js - GET, POST (add), DELETE
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  // GET เปิดเสรีให้ฝั่งผู้ปกครองดึงด้วย? ใช้ไม่ ก็ต้อง auth
  if (req.method !== 'GET') {
    const user = requireAdmin(req);
    if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('classes')
        .select('class_name')
        .order('class_name', { ascending: true });
      if (error) return fail(res, error.message, 500);
      return ok(res, { classes: (data || []).map(c => c.class_name) });
    }

    if (req.method === 'POST') {
      const { className } = req.body || {};
      if (!className) return fail(res, 'กรุณาระบุชื่อห้อง');

      const { error } = await supabase
        .from('classes')
        .insert({ class_name: className.trim() });

      if (error) {
        if (String(error.message).includes('duplicate')) return fail(res, 'มีห้องนี้แล้ว');
        return fail(res, error.message, 500);
      }
      return ok(res, { message: 'เพิ่มห้องเรียนสำเร็จ' });
    }

    if (req.method === 'DELETE') {
      const className = req.query.className || (req.body && req.body.className);
      if (!className) return fail(res, 'กรุณาระบุชื่อห้อง');
      const { error } = await supabase.from('classes').delete().eq('class_name', className);
      if (error) return fail(res, error.message, 500);
      return ok(res, { message: 'ลบสำเร็จ' });
    }

    return fail(res, 'Method not allowed', 405);
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
