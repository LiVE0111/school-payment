// api/admin/stats.js - สรุปยอดสำหรับ dashboard
//   GET                          → สถิติทั่วไป
//   GET ?action=charts           → ข้อมูลสำหรับ Chart.js
//   GET ?action=top-classes      → top 10 ห้องค้างชำระ
//   GET ?action=monthly          → ยอดเก็บได้รายเดือน
//
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  const action = req.query.action;

  try {
    // ─────────────────────────────────────
    // ACTION: charts → ข้อมูลสำหรับ Chart.js
    // ─────────────────────────────────────
    if (action === 'charts') {
      // 1. Pie Chart: สถานะ
      const statuses = ['รอชำระ', 'กำลังตรวจสอบ', 'ชำระแล้ว', 'ชำระไม่สำเร็จ'];
      const statusData = [];
      for (const s of statuses) {
        const { count } = await supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .eq('status', s);
        statusData.push({ label: s, count: count || 0 });
      }

      // 2. Line Chart: ยอดเก็บได้รายวัน 30 วันล่าสุด
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentPayments } = await supabase
        .from('payments')
        .select('amount,updated_at,status')
        .eq('status', 'ชำระแล้ว')
        .gte('updated_at', thirtyDaysAgo)
        .order('updated_at', { ascending: true });

      // จัดกลุ่มตามวัน
      const dailyMap = {};
      (recentPayments || []).forEach(p => {
        const day = (p.updated_at || '').slice(0, 10);
        if (!day) return;
        if (!dailyMap[day]) dailyMap[day] = { count: 0, amount: 0 };
        dailyMap[day].count += 1;
        dailyMap[day].amount += Number(p.amount || 0);
      });

      const dailyData = Object.keys(dailyMap).sort().map(day => ({
        date: day,
        count: dailyMap[day].count,
        amount: dailyMap[day].amount
      }));

      // 3. Bar Chart: ยอดแยกตามห้อง
      const { data: students } = await supabase.from('students').select('id_card,class');
      const stuClassMap = {};
      (students || []).forEach(s => { stuClassMap[s.id_card] = s.class; });

      const { data: allPayments } = await supabase
        .from('payments')
        .select('id_card,amount,status');

      const classMap = {};
      (allPayments || []).forEach(p => {
        const cls = stuClassMap[p.id_card] || 'ไม่ระบุ';
        if (!classMap[cls]) classMap[cls] = { paid: 0, pending: 0, totalPaid: 0, totalPending: 0 };
        if (p.status === 'ชำระแล้ว') {
          classMap[cls].paid += 1;
          classMap[cls].totalPaid += Number(p.amount || 0);
        } else if (p.status === 'รอชำระ' || p.status === 'กำลังตรวจสอบ') {
          classMap[cls].pending += 1;
          classMap[cls].totalPending += Number(p.amount || 0);
        }
      });

      const classData = Object.keys(classMap)
        .sort((a, b) => {
          // เรียงตามชั้น (ม.1/1, ม.1/2, ..., ม.6/12)
          const aMatch = a.match(/(\d+)[\/\-](\d+)/);
          const bMatch = b.match(/(\d+)[\/\-](\d+)/);
          if (aMatch && bMatch) {
            const aN = parseInt(aMatch[1]) * 100 + parseInt(aMatch[2]);
            const bN = parseInt(bMatch[1]) * 100 + parseInt(bMatch[2]);
            return aN - bN;
          }
          return a.localeCompare(b);
        })
        .map(cls => ({
          class: cls,
          paid: classMap[cls].paid,
          pending: classMap[cls].pending,
          totalPaid: classMap[cls].totalPaid,
          totalPending: classMap[cls].totalPending
        }));

      return ok(res, { statusData, dailyData, classData });
    }

    // ─────────────────────────────────────
    // ACTION: top-classes → top 10 ห้องค้างชำระ
    // ─────────────────────────────────────
    if (action === 'top-classes') {
      const { data: students } = await supabase.from('students').select('id_card,class');
      const stuClassMap = {};
      (students || []).forEach(s => { stuClassMap[s.id_card] = s.class; });

      const { data: pending } = await supabase
        .from('payments')
        .select('id_card,amount')
        .in('status', ['รอชำระ', 'กำลังตรวจสอบ']);

      const map = {};
      (pending || []).forEach(p => {
        const cls = stuClassMap[p.id_card] || 'ไม่ระบุ';
        if (!map[cls]) map[cls] = { count: 0, amount: 0 };
        map[cls].count += 1;
        map[cls].amount += Number(p.amount || 0);
      });

      const sorted = Object.keys(map)
        .map(cls => ({ class: cls, count: map[cls].count, amount: map[cls].amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      return ok(res, { topClasses: sorted });
    }

    // ─────────────────────────────────────
    // DEFAULT: สถิติทั่วไป (เดิม + เพิ่ม)
    // ─────────────────────────────────────
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

    const { data: paid } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'ชำระแล้ว');
    const totalPaid = (paid || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const { data: pending } = await supabase
      .from('payments')
      .select('amount')
      .in('status', ['รอชำระ', 'กำลังตรวจสอบ']);
    const totalPending = (pending || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    // วันนี้
    const today = new Date().toISOString().slice(0, 10);
    const { data: todayPaid } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'ชำระแล้ว')
      .gte('updated_at', today + 'T00:00:00')
      .lte('updated_at', today + 'T23:59:59');
    const todayAmount = (todayPaid || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return ok(res, {
      stats,
      totalPaid,
      totalPending,
      studentCount: studentCount || 0,
      todayAmount,
      todayCount: (todayPaid || []).length
    });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
