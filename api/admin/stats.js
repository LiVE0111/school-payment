// api/admin/stats.js - สรุปยอดสำหรับ dashboard
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  try {
    // ดึง count ของ payments แต่ละสถานะ
    const statuses = ['รอชำระ', 'กำลังตรวจสอบ', 'ชำระแล้ว', 'ชำระไม่สำเร็จ'];
    const stats = { total: 0 };

    for (const s of statuses) {
      const { count } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', s);
      stats[s] = count || 0;
      stats.total += count || 0;
    }

    // ยอดเงินที่ชำระแล้ว
    const { data: paid } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'ชำระแล้ว');
    const totalPaid = (paid || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // จำนวนนักเรียน
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    return ok(res, {
      stats,
      totalPaid,
      studentCount: studentCount || 0
    });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
