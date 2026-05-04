// api/admin/students.js - GET (list), POST (add/import), DELETE (remove)
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('class', { ascending: true });
      if (error) return fail(res, error.message, 500);
      return ok(res, {
        students: (data || []).map(s => ({
          idCard: s.id_card,
          studentId: s.student_id || '',
          name: s.name || '',
          class: s.class || '',
          imageUrl: s.image_url || ''
        }))
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const list = Array.isArray(body) ? body : (body.list || [body]);

      // เตรียมข้อมูลสำหรับ upsert
      const rows = list
        .map(p => ({
          id_card: String(p.idCard || p.ID_Card || '').trim(),
          student_id: String(p.studentId || p.Student_ID || '').trim(),
          name: String(p.name || p.Name || '').trim(),
          class: String(p.class || p.Class || '').trim(),
          image_url: String(p.imageUrl || p.Image_URL || '').trim()
        }))
        .filter(r => r.id_card);

      if (rows.length === 0) return fail(res, 'ไม่มีข้อมูลที่ถูกต้อง');

      // ใช้ upsert เพื่อข้ามรายการที่ซ้ำ (อัปเดตข้อมูลเดิม)
      const { error, count } = await supabase
        .from('students')
        .upsert(rows, { onConflict: 'id_card', count: 'exact' });

      if (error) return fail(res, error.message, 500);
      return ok(res, { count: rows.length, message: 'นำเข้าสำเร็จ' });
    }

    if (req.method === 'DELETE') {
      const idCard = req.query.idCard || (req.body && req.body.idCard);
      if (!idCard) return fail(res, 'กรุณาระบุ idCard');

      const { error } = await supabase.from('students').delete().eq('id_card', idCard);
      if (error) return fail(res, error.message, 500);
      return ok(res, { message: 'ลบสำเร็จ' });
    }

    return fail(res, 'Method not allowed', 405);
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
