// api/student/search.js - ค้นหาข้อมูลนักเรียน + รายการชำระ
const supabase = require('../../lib/supabase');
const { ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  // ⭐ POST ?action=track-qr → บันทึกการเปิด QR
  if (req.method === 'POST' && req.query.action === 'track-qr') {
    try {
      const { transId } = req.body || {};
      if (!transId) return fail(res, 'กรุณาระบุ transId');

      const now = new Date().toISOString();

      const { data: pay, error: errFind } = await supabase
        .from('payments')
        .select('trans_id,status,qr_opened_at,qr_open_count')
        .eq('trans_id', transId)
        .maybeSingle();

      if (errFind || !pay) return fail(res, 'ไม่พบบิล', 404);
      if (pay.status === 'ชำระแล้ว') {
        return ok(res, { skipped: true, reason: 'paid' });
      }

      const updates = {
        qr_last_opened_at: now,
        qr_open_count: (pay.qr_open_count || 0) + 1
      };
      if (!pay.qr_opened_at) updates.qr_opened_at = now;

      await supabase
        .from('payments')
        .update(updates)
        .eq('trans_id', transId);

      return ok(res, { tracked: true, openCount: updates.qr_open_count });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

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
        // ⭐ NEW: QR tracking + transfer
        transferAt: p.transfer_at,
        qrOpenedAt: p.qr_opened_at,
        qrLastOpenedAt: p.qr_last_opened_at,
        qrOpenCount: p.qr_open_count || 0,
        taxId,
        billerSuffix: suffix
      }))
    });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
