// api/admin/create-bill.js - ออกบิลให้นักเรียน
//   POST                            → ออกบิลทั้งห้อง (batch)
//   POST ?action=individual         → ออกบิลรายบุคคล
//
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

function classToCode(c) {
  const m = String(c).match(/(\d+)[\/\-](\d+)/);
  if (m) return (m[1] + ('00' + m[2]).slice(-2)).slice(0, 3);
  return ('000' + String(c).replace(/\D/g, '').slice(0, 3)).slice(-3);
}

function buildRef2(cls, term, year) {
  return classToCode(cls)
       + String(term).replace(/\D/g, '').slice(-1)
       + String(year).replace(/\D/g, '').slice(-2);
}

// ตรวจ id_card ว่าเป็นเลขบัตรจริงไหม (สำหรับใส่ใน Ref.1)
function isRealIdCard(id) {
  return /^\d{13}$/.test(String(id || ''));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);
  if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  const action = req.query.action;

  try {
    // ─────────────────────────────────────
    // ACTION: individual → ออกบิลรายบุคคล
    // ─────────────────────────────────────
    if (action === 'individual') {
      const { idCard, year, term, amount, title, docUrl, adminName } = req.body || {};

      if (!idCard) return fail(res, 'กรุณาระบุ idCard ของนักเรียน');
      if (!year || !term || !amount || !title) return fail(res, 'ข้อมูลไม่ครบ');

      // ดึงข้อมูลนักเรียน
      const { data: student } = await supabase
        .from('students')
        .select('id_card,class,name')
        .eq('id_card', idCard)
        .maybeSingle();

      if (!student) return fail(res, 'ไม่พบนักเรียนในระบบ', 404);

      const transId = 'TI' + Date.now();  // TI = Trans Individual
      const ref1 = isRealIdCard(student.id_card) ? student.id_card : '';
      const ref2 = buildRef2(student.class, term, year);

      const row = {
        trans_id: transId,
        id_card: student.id_card,
        year: String(year),
        term: String(term),
        amount: Number(amount),
        status: 'รอชำระ',
        title,
        doc_url: docUrl || '',
        ref1,
        ref2,
        batch_id: 'IND-' + Date.now(),
        bill_type: 'individual'
      };

      const { error } = await supabase.from('payments').insert(row);
      if (error) return fail(res, 'บันทึกไม่สำเร็จ: ' + error.message, 500);

      // บันทึกประวัติ
      await supabase.from('billing_history').insert({
        batch_id: row.batch_id,
        admin_name: adminName || user.username || 'Admin',
        year: String(year),
        term: String(term),
        target: `${student.name} (${student.class})`,
        count: 1
      });

      return ok(res, {
        transId,
        message: `ออกบิลให้ ${student.name} เรียบร้อย`,
        warning: !ref1 ? 'นักเรียนยังไม่มีเลขบัตรจริง — Ref.1 จะว่าง (อาจสแกน QR ไม่ได้จนกว่าจะอัปเดตเลขบัตร)' : null
      });
    }

    // ─────────────────────────────────────
    // DEFAULT: batch (ออกทั้งห้อง — ของเดิม)
    // ─────────────────────────────────────
    const params = req.body || {};
    const { year, term, amount, title, docUrl, targetClasses, adminName } = params;

    if (!year || !term || !amount || !title) return fail(res, 'ข้อมูลไม่ครบ');
    if (!Array.isArray(targetClasses) || targetClasses.length === 0)
      return fail(res, 'กรุณาเลือกห้องเรียน');

    const { data: students, error: errS } = await supabase
      .from('students')
      .select('id_card,class')
      .in('class', targetClasses)
      .neq('status', 'transferred_out')   // ⭐ ไม่ออกบิลให้นักเรียนที่ย้ายออกแล้ว
      .neq('status', 'graduated');

    if (errS) return fail(res, errS.message, 500);
    if (!students || students.length === 0) return fail(res, 'ไม่พบนักเรียนในห้องที่เลือก');

    const batchId = 'B' + Date.now();
    const now = Date.now();

    const rows = students.map((s, i) => {
      const idc = String(s.id_card).trim();
      const ref1 = isRealIdCard(idc) ? idc : '';   // ⭐ ถ้าเป็น TEMP/G ไม่ใส่ ref1
      const ref2 = buildRef2(s.class, term, year);
      return {
        trans_id: 'T' + now + i,
        id_card: idc,
        year: String(year),
        term: String(term),
        amount: Number(amount),
        status: 'รอชำระ',
        title,
        doc_url: docUrl || '',
        ref1,
        ref2,
        batch_id: batchId,
        bill_type: 'batch'
      };
    });

    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from('payments').insert(slice);
      if (error) return fail(res, 'บันทึกไม่สำเร็จ: ' + error.message, 500);
      inserted += slice.length;
    }

    await supabase.from('billing_history').insert({
      batch_id: batchId,
      admin_name: adminName || user.username || 'Admin',
      year: String(year),
      term: String(term),
      target: targetClasses.join(', '),
      count: inserted
    });

    // ตรวจว่ามีนักเรียนที่ใช้ TEMP/G-code กี่คน
    const tempCount = students.filter(s => !isRealIdCard(s.id_card)).length;

    return ok(res, {
      count: inserted,
      batchId,
      tempCount,
      warning: tempCount > 0 ? `มีนักเรียน ${tempCount} คนใช้ ID ชั่วคราว — ต้องอัปเดตเลขบัตรจริงก่อนสแกน QR ได้` : null
    });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
