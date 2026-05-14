// api/auth/index.js - รวม login และ change-password
//   POST /api/auth?action=login           → login
//   POST /api/auth?action=change-password → เปลี่ยนรหัสผ่าน
const bcrypt = require('bcryptjs');
const supabase = require('../../lib/supabase');
const { signToken, requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);
  if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

  const action = req.query.action || (req.body && req.body.action);

  // ── LOGIN ──
  if (action === 'login') {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) return fail(res, 'กรุณากรอก username และ password');

      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('username', username.trim())
        .maybeSingle();

      if (error || !data) return fail(res, 'username หรือ password ไม่ถูกต้อง', 401);

      const valid = await bcrypt.compare(password, data.password_hash);
      if (!valid) return fail(res, 'username หรือ password ไม่ถูกต้อง', 401);

      const token = signToken({ id: data.id, username: data.username, role: data.role });
      return ok(res, {
        token,
        name: data.name,
        role: data.role,
        username: data.username
      });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

  // ── CHANGE PASSWORD ──
  if (action === 'change-password') {
    const user = requireAdmin(req);
    if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

    try {
      const { oldPassword, newPassword } = req.body || {};
      if (!oldPassword || !newPassword) return fail(res, 'กรุณากรอกรหัสผ่านเก่าและใหม่');
      if (newPassword.length < 6) return fail(res, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');

      const { data } = await supabase.from('admins').select('*').eq('id', user.id).maybeSingle();
      if (!data) return fail(res, 'ไม่พบบัญชีผู้ใช้', 404);

      const valid = await bcrypt.compare(oldPassword, data.password_hash);
      if (!valid) return fail(res, 'รหัสผ่านเก่าไม่ถูกต้อง', 401);

      const hash = await bcrypt.hash(newPassword, 10);
      await supabase.from('admins').update({ password_hash: hash }).eq('id', user.id);

      return ok(res, { message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

  return fail(res, 'ไม่พบ action ที่ระบุ (login | change-password)');
};
