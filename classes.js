// api/admin/manage-admins.js - จัดการ admins (เฉพาะ superadmin)
//
// GET    /api/admin/manage-admins              → list admins
// POST   /api/admin/manage-admins              → add admin   { username, password, name, role }
// POST   /api/admin/manage-admins?action=reset → reset pwd   { username, newPassword }
// DELETE /api/admin/manage-admins?username=x   → delete admin
//
const bcrypt = require('bcryptjs');
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  // ตรวจสอบว่า login แล้ว
  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  // ตรวจสอบว่าเป็น superadmin เท่านั้น
  if (user.role !== 'superadmin') {
    return fail(res, 'เฉพาะ Super Admin เท่านั้นที่จัดการ admin ได้', 403);
  }

  try {
    // ── GET: list admins ──
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('admins')
        .select('id, username, name, role, created_at')
        .order('created_at', { ascending: true });
      if (error) return fail(res, error.message, 500);
      return ok(res, { admins: data || [] });
    }

    // ── POST: add admin หรือ reset password ──
    if (req.method === 'POST') {
      const action = req.query.action;

      // Reset password
      if (action === 'reset') {
        const { username, newPassword } = req.body || {};
        if (!username || !newPassword) return fail(res, 'กรุณาระบุ username และ newPassword');
        if (newPassword.length < 6) return fail(res, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว');

        const hash = bcrypt.hashSync(newPassword, 10);
        const { data, error } = await supabase
          .from('admins')
          .update({ password_hash: hash })
          .eq('username', username)
          .select();

        if (error) return fail(res, error.message, 500);
        if (!data || !data.length) return fail(res, 'ไม่พบ admin คนนี้', 404);
        return ok(res, { message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
      }

      // Add admin
      const { username, password, name, role } = req.body || {};
      if (!username || !password) return fail(res, 'กรุณาระบุ username และ password');
      if (password.length < 6) return fail(res, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว');
      if (username.length < 3) return fail(res, 'username ต้องมีอย่างน้อย 3 ตัว');

      // ตรวจว่ามี username นี้แล้วหรือยัง
      const { data: existing } = await supabase
        .from('admins')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      if (existing) return fail(res, 'มี username นี้แล้ว', 400);

      const hash = bcrypt.hashSync(password, 10);
      const { error } = await supabase.from('admins').insert({
        username: username.trim(),
        password_hash: hash,
        name: name || username,
        role: role === 'superadmin' ? 'superadmin' : 'admin'
      });

      if (error) return fail(res, error.message, 500);
      return ok(res, { message: 'เพิ่ม admin สำเร็จ' });
    }

    // ── DELETE: ลบ admin ──
    if (req.method === 'DELETE') {
      const username = req.query.username;
      if (!username) return fail(res, 'กรุณาระบุ username');

      // ห้ามลบตัวเอง
      if (username === user.username) return fail(res, 'ห้ามลบบัญชีตัวเอง', 400);

      const { data, error } = await supabase
        .from('admins')
        .delete()
        .eq('username', username)
        .select();

      if (error) return fail(res, error.message, 500);
      if (!data || !data.length) return fail(res, 'ไม่พบ admin คนนี้', 404);
      return ok(res, { message: 'ลบ admin สำเร็จ' });
    }

    return fail(res, 'Method not allowed', 405);
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
