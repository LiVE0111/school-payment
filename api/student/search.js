// api/student/search.js - ค้นหาข้อมูลนักเรียน + รายการชำระ
const supabase = require('../../lib/supabase');
const { ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  try {
    const idCard = String(req.query.idCard || '').trim();
    if (!idCard) return fail(res, 'กรุณาระบุเลขบัตรประชาชน');

    // 1. ดึงนักเรียน
    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('id_card', idCard)
      .maybeSingle();

    if (!student) return ok(res, { found: false });

    // 2. ดึงรายการชำระ
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('id_card', idCard)
      .order('created_at', { ascending: false });

    // 3. ดึง settings สำหรับ QR
    const { data: settingsRows } = await supabase
      .from('settings')
      .select('key,value')
      .in('key', ['TAX_ID', 'BILLER_SUFFIX']);

    const settings = {};
    (settingsRows || []).forEach(r => settings[r.key] = r.value);
    const taxId = settings.TAX_ID || '';
    const suffix = settings.BILLER_SUFFIX || '00';

    // ตรวจว่าเลขบัตรเป็นจริงหรือ TEMP/G-code
    const isRealId = /^\d{13}$/.test(student.id_card);

    return ok(res, {
      found: true,
      student: {
        idCard: student.id_card,
        studentId: student.student_id || '',
        name: student.name || '',
        class: student.class || '',
        imageUrl: student.image_url || '',
        status: student.status || 'active',
        notes: student.notes || '',
        idType: isRealId ? 'real' : (student.id_card.startsWith('G') ? 'g-code' : 'temp')
      },
      payments: (payments || []).map(p => ({
        transId: p.trans_id,
        title: p.title || '',
        year: p.year || '',
        term: p.term || '',
        amount: Number(p.amount) || 0,
        status: p.status || 'รอชำระ',
        ref1: p.ref1 || '',
        ref2: p.ref2 || '',
        docUrl: p.doc_url || '',
        rejectReason: p.reason || '',
        slipUrl: p.slip_url || '',
        payerName: p.payer_name || '',
        batchId: p.batch_id || '',
        billType: p.bill_type || 'batch',
        receiptNo: p.receipt_no || '',
        timestamp: p.updated_at,
        taxId,
        billerSuffix: suffix
      }))
    });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
