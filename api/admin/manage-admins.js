// api/admin/manage-admins.js - จัดการ admins (เฉพาะ superadmin)
//
// GET    /api/admin/manage-admins              → list admins
// POST   /api/admin/manage-admins              → add admin
// POST   /api/admin/manage-admins?action=reset → reset pwd
// PUT    /api/admin/manage-admins              → แก้ไข role / assigned_classes / display_name
// DELETE /api/admin/manage-admins?username=x   → delete admin
//
const bcrypt = require('bcryptjs');
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

// Role ที่อนุญาต
const ALLOWED_ROLES = ['admin', 'superadmin', 'super', 'homeroom'];

function normalizeRole(r) {
  if (!r) return 'admin';
  const lower = String(r).toLowerCase();
  if (lower === 'super') return 'superadmin';  // backward compat
  if (ALLOWED_ROLES.includes(lower)) return lower;
  return 'admin';
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  // ตรวจสอบว่าเป็น superadmin เท่านั้น
  if (user.role !== 'superadmin' && user.role !== 'super') {
    return fail(res, 'เฉพาะ Super Admin เท่านั้นที่จัดการ admin ได้', 403);
  }

  try {
    // ── GET: list admins ──
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('admins')
        .select('id, username, name, display_name, role, assigned_classes, created_at')
        .order('created_at', { ascending: true });
      if (error) return fail(res, error.message, 500);

      const list = (data || []).map(a => ({
        id: a.id,
        username: a.username,
        name: a.name,
        displayName: a.display_name || a.name || a.username,
        role: a.role,
        assignedClasses: a.assigned_classes || [],
        createdAt: a.created_at
      }));

      return ok(res, { admins: list });
    }

    // ── POST: add / reset password ──
    if (req.method === 'POST') {
      const action = req.query.action;

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
      const { username, password, name, displayName, role, assignedClasses } = req.body || {};
      if (!username || !password) return fail(res, 'กรุณาระบุ username และ password');
      if (password.length < 6) return fail(res, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว');
      if (username.length < 3) return fail(res, 'username ต้องมีอย่างน้อย 3 ตัว');

      const finalRole = normalizeRole(role);

      // ครูประจำชั้นต้องเลือกห้องอย่างน้อย 1 ห้อง
      if (finalRole === 'homeroom') {
        if (!Array.isArray(assignedClasses) || assignedClasses.length === 0) {
          return fail(res, 'ครูประจำชั้นต้องเลือกห้องอย่างน้อย 1 ห้อง');
        }
      }

      const { data: existing } = await supabase
        .from('admins')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      if (existing) return fail(res, 'มี username นี้แล้ว', 400);

      const hash = bcrypt.hashSync(password, 10);
      const insertData = {
        username: username.trim(),
        password_hash: hash,
        name: name || username,
        display_name: displayName || name || username,
        role: finalRole
      };
      if (finalRole === 'homeroom') {
        insertData.assigned_classes = assignedClasses;
      }

      const { error } = await supabase.from('admins').insert(insertData);
      if (error) return fail(res, error.message, 500);
      return ok(res, { message: 'เพิ่ม admin สำเร็จ' });
    }

    // ── PUT: แก้ไข role / assigned_classes / display_name ──
    if (req.method === 'PUT') {
      const { username, role, assignedClasses, displayName } = req.body || {};
      if (!username) return fail(res, 'กรุณาระบุ username');

      const updates = {};
      if (role !== undefined) {
        const finalRole = normalizeRole(role);
        updates.role = finalRole;
        if (finalRole === 'homeroom') {
          if (!Array.isArray(assignedClasses) || assignedClasses.length === 0) {
            return fail(res, 'ครูประจำชั้นต้องเลือกห้องอย่างน้อย 1 ห้อง');
          }
        }
      }
      if (assignedClasses !== undefined) updates.assigned_classes = assignedClasses;
      if (displayName !== undefined) updates.display_name = displayName;

      if (Object.keys(updates).length === 0) return fail(res, 'ไม่มีข้อมูลให้แก้ไข');

      const { data, error } = await supabase
        .from('admins')
        .update(updates)
        .eq('username', username)
        .select();

      if (error) return fail(res, error.message, 500);
      if (!data || !data.length) return fail(res, 'ไม่พบ admin คนนี้', 404);
      return ok(res, { message: 'แก้ไขสำเร็จ' });
    }

    // ── DELETE ──
    if (req.method === 'DELETE') {
      const username = req.query.username;
      if (!username) return fail(res, 'กรุณาระบุ username');
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
