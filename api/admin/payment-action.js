// api/admin/payment-action.js
//   POST                          → approve/reject/cash (เดี่ยว)
//   POST ?action=bulk             → bulk approve/reject (หลายรายการ)
//   POST ?action=issue-receipt    → ออกใบเสร็จ (ดึงเลขที่ใหม่)
//   GET  ?action=receipt          → ดึงข้อมูลใบเสร็จ
//
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');
const { generateReceiptNumber, logActivity } = require('../../lib/receipt');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  const action = req.query.action;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '';

  // ─────────────────────────────────────
  // GET ?action=receipt → ดึงข้อมูลใบเสร็จ
  // ─────────────────────────────────────
  if (req.method === 'GET' && action === 'receipt') {
    try {
      const { transId } = req.query;
      if (!transId) return fail(res, 'ไม่พบ transId');

      const { data: pay } = await supabase
        .from('payments')
        .select('*')
        .eq('trans_id', transId)
        .maybeSingle();

      if (!pay) return fail(res, 'ไม่พบรายการ', 404);
      if (pay.status !== 'ชำระแล้ว') return fail(res, 'รายการนี้ยังไม่ได้ชำระ');

      const { data: student } = await supabase
        .from('students')
        .select('name,class,id_card,student_id')
        .eq('id_card', pay.id_card)
        .maybeSingle();

      const { data: settings } = await supabase
        .from('settings')
        .select('key,value')
        .in('key', ['SCHOOL_NAME', 'TAX_ID', 'LOGO_URL']);

      const settingsMap = {};
      (settings || []).forEach(s => { settingsMap[s.key] = s.value; });

      return ok(res, {
        receipt: {
          transId: pay.trans_id,
          receiptNo: pay.receipt_no || '',
          issuedAt: pay.receipt_issued_at,
          approvedBy: pay.approved_by,
          approvedAt: pay.approved_at,
          paidAt: pay.updated_at,
          title: pay.title,
          year: pay.year,
          term: pay.term,
          amount: Number(pay.amount),
          payerName: pay.payer_name,
          ref1: pay.ref1,
          ref2: pay.ref2,
          studentName: student?.name || '-',
          studentClass: student?.class || '-',
          studentId: student?.student_id || '-',
          studentIdCard: student?.id_card || pay.id_card,
          schoolName: settingsMap.SCHOOL_NAME || '',
          taxId: settingsMap.TAX_ID || '',
          logoUrl: settingsMap.LOGO_URL || ''
        }
      });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

  // ─────────────────────────────────────
  // POST ?action=issue-receipt → สร้างเลขที่ใบเสร็จ (ถ้ายังไม่มี)
  // ─────────────────────────────────────
  if (req.method === 'POST' && action === 'issue-receipt') {
    try {
      const { transId } = req.body || {};
      if (!transId) return fail(res, 'ไม่พบ transId');

      const { data: pay } = await supabase
        .from('payments')
        .select('trans_id,status,receipt_no')
        .eq('trans_id', transId)
        .maybeSingle();

      if (!pay) return fail(res, 'ไม่พบรายการ', 404);
      if (pay.status !== 'ชำระแล้ว') return fail(res, 'ต้องเป็นสถานะ "ชำระแล้ว" ก่อน');

      // ถ้ามีอยู่แล้ว — return ของเดิม
      if (pay.receipt_no) {
        return ok(res, { receiptNo: pay.receipt_no, cached: true });
      }

      // สร้างเลขใหม่
      const receiptNo = await generateReceiptNumber();
      const now = new Date().toISOString();

      await supabase.from('payments').update({
        receipt_no: receiptNo,
        receipt_issued_at: now
      }).eq('trans_id', transId);

      await logActivity({
        admin_username: user.username,
        action: 'issue_receipt',
        target_type: 'payment',
        target_id: transId,
        details: { receiptNo },
        ip_address: ip
      });

      return ok(res, { receiptNo, issuedAt: now });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

  // ─────────────────────────────────────
  // POST ?action=bulk → Bulk approve/reject
  // ─────────────────────────────────────
  if (req.method === 'POST' && action === 'bulk') {
    try {
      const { transIds, bulkAction, reason } = req.body || {};
      if (!Array.isArray(transIds) || transIds.length === 0)
        return fail(res, 'ไม่ได้เลือกรายการ');
      if (!['approve', 'reject', 'cash'].includes(bulkAction))
        return fail(res, 'action ไม่ถูกต้อง');

      let status, finalReason;
      if (bulkAction === 'approve') { status = 'ชำระแล้ว';        finalReason = ''; }
      if (bulkAction === 'reject')  { status = 'ชำระไม่สำเร็จ';   finalReason = reason || 'ไม่ผ่านการตรวจสอบ'; }
      if (bulkAction === 'cash')    { status = 'ชำระแล้ว';        finalReason = 'ชำระเงินสด'; }

      const now = new Date().toISOString();
      const updates = {
        status, reason: finalReason,
        updated_at: now
      };
      if (bulkAction === 'approve' || bulkAction === 'cash') {
        updates.approved_by = user.username;
        updates.approved_at = now;
      }

      const { error, count } = await supabase
        .from('payments')
        .update(updates, { count: 'exact' })
        .in('trans_id', transIds);

      if (error) return fail(res, error.message, 500);

      await logActivity({
        admin_username: user.username,
        action: 'bulk_' + bulkAction,
        target_type: 'payment',
        details: { count: transIds.length, transIds: transIds.slice(0, 50), reason: finalReason },
        ip_address: ip
      });

      return ok(res, {
        message: `${bulkAction === 'approve' || bulkAction === 'cash' ? 'อนุมัติ' : 'ปฏิเสธ'} ${transIds.length} รายการเรียบร้อย`,
        count: transIds.length
      });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  }

  // ─────────────────────────────────────
  // POST (default) → approve / reject / cash (เดี่ยว)
  // ─────────────────────────────────────
  if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

  try {
    const { transId, action: act, reason } = req.body || {};
    if (!transId) return fail(res, 'ไม่พบ transId');
    if (!['approve', 'reject', 'cash'].includes(act))
      return fail(res, 'action ไม่ถูกต้อง');

    let status, finalReason;
    if (act === 'approve') { status = 'ชำระแล้ว';        finalReason = ''; }
    if (act === 'reject')  { status = 'ชำระไม่สำเร็จ';   finalReason = reason || 'ไม่ผ่านการตรวจสอบ'; }
    if (act === 'cash')    { status = 'ชำระแล้ว';        finalReason = 'ชำระเงินสด'; }

    const now = new Date().toISOString();
    const updates = {
      status, reason: finalReason,
      updated_at: now
    };
    if (act === 'approve' || act === 'cash') {
      updates.approved_by = user.username;
      updates.approved_at = now;
    }

    const { error } = await supabase
      .from('payments')
      .update(updates)
      .eq('trans_id', transId);

    if (error) return fail(res, error.message, 500);

    await logActivity({
      admin_username: user.username,
      action: act,
      target_type: 'payment',
      target_id: transId,
      details: { reason: finalReason },
      ip_address: ip
    });

    return ok(res, { message: 'อัปเดตสำเร็จ', status });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
