// api/admin/create-bill.js - ออกบิลให้นักเรียนทีละห้อง/ทั้งโรงเรียน
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

// แปลงห้อง เช่น "ม.1/1" → "101"
function classToCode(c) {
  const m = String(c).match(/(\d+)[\/\-](\d+)/);
  if (m) return (m[1] + ('00' + m[2]).slice(-2)).slice(0, 3);
  return ('000' + String(c).replace(/\D/g, '').slice(0, 3)).slice(-3);
}

function buildRef2(cls) {
  // Ref.2 = รหัสห้อง 3 หลัก (ตาม format กรุงไทย)
  return classToCode(cls);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);
  if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  try {
    const params = req.body || {};
    const { year, term, amount, title, docUrl, targetClasses, adminName } = params;

    if (!year || !term || !amount || !title) return fail(res, 'ข้อมูลไม่ครบ');
    if (!Array.isArray(targetClasses) || targetClasses.length === 0)
      return fail(res, 'กรุณาเลือกห้องเรียน');

    // 1. ดึงนักเรียนที่อยู่ในห้องที่เลือก
    const { data: students, error: errS } = await supabase
      .from('students')
      .select('id_card,class,student_id')
      .in('class', targetClasses);

    if (errS) return fail(res, errS.message, 500);
    if (!students || students.length === 0) return fail(res, 'ไม่พบนักเรียนในห้องที่เลือก');

    const batchId = 'B' + Date.now();
    const now = Date.now();

    // 2. เตรียมข้อมูล payments
    const rows = students.map((s, i) => {
      const idc = String(s.id_card).trim();
      // Ref.1 = รหัสนักเรียน (ตาม format กรุงไทย)
      // ถ้าไม่มี student_id ให้ fallback ไปเลขบัตร
      const ref1 = String(s.student_id || idc).replace(/\D/g, '').substring(0, 20);
      const ref2 = buildRef2(s.class);
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
        batch_id: batchId
      };
    });

    // 3. แบ่ง insert ทีละ 500 แถว (Supabase limit)
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from('payments').insert(slice);
      if (error) return fail(res, 'บันทึกไม่สำเร็จ: ' + error.message, 500);
      inserted += slice.length;
    }

    // 4. บันทึกประวัติการออกบิล
    await supabase.from('billing_history').insert({
      batch_id: batchId,
      admin_name: adminName || user.username || 'Admin',
      year: String(year),
      term: String(term),
      target: targetClasses.join(', '),
      count: inserted
    });

    return ok(res, { count: inserted, batchId });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
