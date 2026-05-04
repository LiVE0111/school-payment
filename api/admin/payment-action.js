// api/admin/payment-action.js - approve / reject / cash
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);
  if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  try {
    const { transId, action, reason } = req.body || {};
    if (!transId) return fail(res, 'ไม่พบ transId');
    if (!['approve', 'reject', 'cash'].includes(action))
      return fail(res, 'action ไม่ถูกต้อง');

    let status, finalReason;
    if (action === 'approve') { status = 'ชำระแล้ว';        finalReason = ''; }
    if (action === 'reject')  { status = 'ชำระไม่สำเร็จ';   finalReason = reason || 'ไม่ผ่านการตรวจสอบ'; }
    if (action === 'cash')    { status = 'ชำระแล้ว';        finalReason = 'ชำระเงินสด'; }

    const { error } = await supabase
      .from('payments')
      .update({ status, reason: finalReason, updated_at: new Date().toISOString() })
      .eq('trans_id', transId);

    if (error) return fail(res, error.message, 500);
    return ok(res, { message: 'อัปเดตสำเร็จ', status });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
