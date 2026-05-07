// api/admin/payments.js
//   GET  /api/admin/payments              → ดึงรายการ payments พร้อมกรอง
//   POST /api/admin/payments?action=migrate-refs → อัปเดต Ref1, Ref2 ของบิลเก่าตาม format กรุงไทย
//
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

// แปลงห้อง เช่น "ม.1/1" → "101"
function classToCode(c) {
  const m = String(c).match(/(\d+)[\/\-](\d+)/);
  if (m) return (m[1] + ('00' + m[2]).slice(-2)).slice(0, 3);
  return ('000' + String(c).replace(/\D/g, '').slice(0, 3)).slice(-3);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  // ── POST ?action=migrate-refs : แปลง Ref1, Ref2 ของบิลทั้งหมดเป็น format กรุงไทย ──
  if (req.method === 'POST' && req.query.action === 'migrate-refs') {
    try {
      const status = req.body?.status || 'รอชำระ'; // default: เฉพาะที่ยังไม่ชำระ
      const onlyPending = status !== 'ALL';

      // 1. ดึงนักเรียนทั้งหมด → map id_card → student_id, class
      const { data: students } = await supabase.from('students').select('id_card,student_id,class');
      const stuMap = {};
      (students || []).forEach(s => { stuMap[s.id_card] = s; });

      // 2. ดึง payments
      let q = supabase.from('payments').select('trans_id,id_card,ref1,ref2');
      if (onlyPending) q = q.in('status', ['รอชำระ', 'ชำระไม่สำเร็จ']);
      const { data: payments, error: pErr } = await q;
      if (pErr) return fail(res, pErr.message, 500);
      if (!payments || payments.length === 0) return ok(res, { updated: 0, message: 'ไม่มีบิลให้อัปเดต' });

      // 3. คำนวณ Ref ใหม่ + filter เฉพาะที่ต้องอัปเดต
      const updates = [];
      payments.forEach(p => {
        const stu = stuMap[p.id_card];
        if (!stu) return;
        const newRef1 = String(stu.student_id || p.id_card).replace(/\D/g, '').substring(0, 20);
        const newRef2 = classToCode(stu.class);
        if (p.ref1 !== newRef1 || p.ref2 !== newRef2) {
          updates.push({ trans_id: p.trans_id, ref1: newRef1, ref2: newRef2 });
        }
      });

      if (updates.length === 0) return ok(res, { updated: 0, message: 'ทุกบิล Ref ถูกต้องแล้ว' });

      // 4. update ทีละ batch (Supabase ไม่มี bulk update → ต้องใช้ Promise.all)
      const BATCH = 50;
      let updated = 0;
      for (let i = 0; i < updates.length; i += BATCH) {
        const slice = updates.slice(i, i + BATCH);
        await Promise.all(slice.map(u =>
          supabase.from('payments')
            .update({ ref1: u.ref1, ref2: u.ref2 })
            .eq('trans_id', u.trans_id)
        ));
        updated += slice.length;
      }

      return ok(res, { updated, total: payments.length, message: `อัปเดต Ref ${updated} รายการเรียบร้อย` });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

  // ── GET : ดึงรายการ payments พร้อมกรอง ──
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  try {
    const { status, cls, year, term, limit } = req.query;

    let q = supabase.from('payments').select('*').order('updated_at', { ascending: false });

    if (status && status !== 'ALL') q = q.eq('status', status);
    if (year   && year   !== 'ALL') q = q.eq('year', String(year));
    if (term   && term   !== 'ALL') q = q.eq('term', String(term));
    if (limit) q = q.limit(parseInt(limit, 10));

    const { data: payments, error } = await q;
    if (error) return fail(res, error.message, 500);

    const { data: students } = await supabase.from('students').select('id_card,name,class');
    const stuMap = {};
    (students || []).forEach(s => { stuMap[s.id_card] = s; });

    let result = (payments || []).map(p => ({
      transId: p.trans_id,
      idCard: p.id_card,
      year: p.year || '',
      term: p.term || '',
      amount: Number(p.amount) || 0,
      status: p.status || 'รอชำระ',
      slipUrl: p.slip_url || '',
      payerName: p.payer_name || '',
      reason: p.reason || '',
      timestamp: p.updated_at || p.created_at,
      title: p.title || '',
      docUrl: p.doc_url || '',
      ref1: p.ref1 || '',
      ref2: p.ref2 || '',
      batchId: p.batch_id || '',
      studentName: (stuMap[p.id_card] || {}).name || '-',
      studentClass: (stuMap[p.id_card] || {}).class || '-'
    }));

    if (cls && cls !== 'ALL') {
      result = result.filter(r => r.studentClass === cls);
    }

    return ok(res, { payments: result });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
