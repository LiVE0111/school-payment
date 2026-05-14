// api/admin/stats.js
//   GET                           → สถิติทั่วไป
//   GET ?action=charts            → ข้อมูลสำหรับ Chart.js
//   GET ?action=top-classes       → top 10 ห้องค้างชำระ
//   GET ?action=storage           → ⭐ Storage Dashboard
//
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

// Supabase Free tier limits
const SUPABASE_LIMITS = {
  database_mb: 500,        // 500 MB database
  storage_gb: 1,           // 1 GB storage
  bandwidth_gb: 5,         // 5 GB bandwidth/month
  active_users: 50000      // 50k MAU
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  const action = req.query.action;

  try {
    // ─────────────────────────────────────
    // ⭐ ACTION: storage → Storage Dashboard
    // ─────────────────────────────────────
    if (action === 'storage') {
      // 1. Database size — ใช้ get_db_stats() function (ที่สร้างใน migration v13)
      let dbStats = [];
      let totalDbBytes = 0;
      try {
        const { data, error } = await supabase.rpc('get_db_stats');
        if (!error && data) {
          dbStats = data;
          totalDbBytes = data.reduce((sum, t) => sum + Number(t.total_size_bytes || 0), 0);
        }
      } catch (e) {
        console.error('get_db_stats RPC error:', e.message);
      }

      // 2. Row counts (estimate)
      const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
      const { count: paymentCount } = await supabase.from('payments').select('*', { count: 'exact', head: true });
      const { count: paidCount } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'ชำระแล้ว');

      // 3. Storage (slips bucket) — list files
      let slipCount = 0;
      let slipBytes = 0;
      try {
        const { data: slipFiles } = await supabase.storage.from('slips').list('', { limit: 10000 });
        if (slipFiles) {
          slipCount = slipFiles.length;
          slipBytes = slipFiles.reduce((sum, f) => sum + Number(f.metadata?.size || 0), 0);
        }
      } catch (e) {
        console.error('Storage list error:', e.message);
      }

      // 4. คำนวณ usage %
      const dbUsedMb = totalDbBytes / (1024 * 1024);
      const dbPercent = (dbUsedMb / SUPABASE_LIMITS.database_mb) * 100;

      const storageUsedGb = slipBytes / (1024 * 1024 * 1024);
      const storagePercent = (storageUsedGb / SUPABASE_LIMITS.storage_gb) * 100;

      // 5. ประเมินจำนวน records ที่รองรับได้อีก
      const avgRowSize = paymentCount > 0 ? totalDbBytes / (paymentCount + (studentCount || 0)) : 1024;
      const remainingDbBytes = (SUPABASE_LIMITS.database_mb * 1024 * 1024) - totalDbBytes;
      const estimatedMoreRows = Math.floor(remainingDbBytes / Math.max(avgRowSize, 100));

      const avgSlipSize = slipCount > 0 ? slipBytes / slipCount : 200 * 1024;  // ค่าเริ่มต้น 200KB
      const remainingStorageBytes = (SUPABASE_LIMITS.storage_gb * 1024 * 1024 * 1024) - slipBytes;
      const estimatedMoreSlips = Math.floor(remainingStorageBytes / Math.max(avgSlipSize, 50 * 1024));

      return ok(res, {
        database: {
          usedMb: Math.round(dbUsedMb * 100) / 100,
          limitMb: SUPABASE_LIMITS.database_mb,
          remainingMb: Math.round((SUPABASE_LIMITS.database_mb - dbUsedMb) * 100) / 100,
          percent: Math.round(dbPercent * 10) / 10,
          tables: dbStats.map(t => ({
            name: t.table_name,
            rowCount: Number(t.row_count || 0),
            sizeMb: Math.round((Number(t.total_size_bytes || 0) / 1024 / 1024) * 100) / 100
          }))
        },
        storage: {
          usedGb: Math.round(storageUsedGb * 1000) / 1000,
          limitGb: SUPABASE_LIMITS.storage_gb,
          remainingGb: Math.round((SUPABASE_LIMITS.storage_gb - storageUsedGb) * 1000) / 1000,
          percent: Math.round(storagePercent * 10) / 10,
          slipCount,
          avgSlipSizeKb: Math.round(avgSlipSize / 1024)
        },
        records: {
          totalStudents: studentCount || 0,
          totalPayments: paymentCount || 0,
          totalPaid: paidCount || 0,
          estimatedMoreRows: Math.max(0, estimatedMoreRows),
          estimatedMoreSlips: Math.max(0, estimatedMoreSlips)
        },
        warnings: [
          ...(dbPercent > 80 ? ['Database ใช้เกิน 80%! ควร archive ข้อมูลเก่า'] : []),
          ...(storagePercent > 80 ? ['Storage ใช้เกิน 80%! ควรลบสลิปเก่า'] : []),
          ...(dbPercent > 95 ? ['ข้อมูลใกล้เต็ม! upgrade Pro หรือลบข้อมูลด่วน'] : [])
        ]
      });
    }

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

      // 2. Line Chart: 30 วันล่าสุด — ใช้ aggregate query ใน DB
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentPayments } = await supabase
        .from('payments')
        .select('amount,updated_at')
        .eq('status', 'ชำระแล้ว')
        .gte('updated_at', thirtyDaysAgo)
        .order('updated_at', { ascending: true })
        .limit(5000);  // limit safety

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

      // 3. Bar Chart: ยอดแยกห้อง — ใช้ join + aggregate ใน memory
      const { data: students } = await supabase.from('students').select('id_card,class').limit(2000);
      const stuClassMap = {};
      (students || []).forEach(s => { stuClassMap[s.id_card] = s.class; });

      // ดึงเฉพาะ id_card + amount + status (เบาที่สุด)
      const { data: allPayments } = await supabase
        .from('payments')
        .select('id_card,amount,status')
        .limit(10000);

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
          const aMatch = a.match(/(\d+)[\/\-](\d+)/);
          const bMatch = b.match(/(\d+)[\/\-](\d+)/);
          if (aMatch && bMatch) {
            return (parseInt(aMatch[1]) * 100 + parseInt(aMatch[2])) - (parseInt(bMatch[1]) * 100 + parseInt(bMatch[2]));
          }
          return a.localeCompare(b);
        })
        .map(cls => ({ class: cls, paid: classMap[cls].paid, pending: classMap[cls].pending,
                       totalPaid: classMap[cls].totalPaid, totalPending: classMap[cls].totalPending }));

      return ok(res, { statusData, dailyData, classData });
    }

    // ─────────────────────────────────────
    // ACTION: top-classes → top 10 ค้างชำระ
    // ─────────────────────────────────────
    if (action === 'top-classes') {
      const { data: students } = await supabase.from('students').select('id_card,class').limit(2000);
      const stuClassMap = {};
      (students || []).forEach(s => { stuClassMap[s.id_card] = s.class; });

      const { data: pending } = await supabase
        .from('payments')
        .select('id_card,amount')
        .in('status', ['รอชำระ', 'กำลังตรวจสอบ'])
        .limit(10000);

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
    // DEFAULT: สถิติทั่วไป (ใช้ count, ไม่ดึง full rows)
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

    // ใช้ aggregate query แทนดึงทั้งหมด (มี limit)
    const { data: paid } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'ชำระแล้ว')
      .limit(50000);
    const totalPaid = (paid || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const { data: pending } = await supabase
      .from('payments')
      .select('amount')
      .in('status', ['รอชำระ', 'กำลังตรวจสอบ'])
      .limit(50000);
    const totalPending = (pending || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

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
