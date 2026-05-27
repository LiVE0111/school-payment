// api/payment/upload-slip.js - บันทึกสลิป + เปลี่ยนสถานะเป็น "กำลังตรวจสอบ"
const supabase = require('../../lib/supabase');
const { ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);
  if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

  try {
    const { transId, slipUrl, payerName, transferDate, transferTime } = req.body || {};
    if (!transId) return fail(res, 'ไม่พบรหัสรายการ');
    if (!slipUrl) return fail(res, 'กรุณาแนบสลิป');

    // ⭐ NEW: ต้องระบุวันเวลาโอน
    let transferAt = null;
    if (transferDate && transferTime) {
      try {
        const dt = new Date(transferDate + 'T' + transferTime + ':00+07:00');
        if (isNaN(dt.getTime())) {
          return fail(res, 'วันเวลาโอนไม่ถูกต้อง');
        }
        if (dt > new Date(Date.now() + 5 * 60 * 1000)) {
          return fail(res, 'วันเวลาโอนต้องไม่เป็นอนาคต');
        }
        transferAt = dt.toISOString();
      } catch (e) {
        return fail(res, 'วันเวลาโอนไม่ถูกต้อง');
      }
    }

    const { data: existing } = await supabase
      .from('payments')
      .select('trans_id,status')
      .eq('trans_id', transId)
      .maybeSingle();

    if (!existing) return fail(res, 'ไม่พบรายการชำระ', 404);
    if (existing.status === 'ชำระแล้ว') return fail(res, 'รายการนี้ชำระแล้ว', 400);

    const updates = {
      status: 'กำลังตรวจสอบ',
      slip_url: slipUrl,
      payer_name: payerName || '',
      updated_at: new Date().toISOString()
    };
    if (transferAt) updates.transfer_at = transferAt;

    const { error } = await supabase
      .from('payments')
      .update(updates)
      .eq('trans_id', transId);

    if (error) return fail(res, error.message, 500);
    return ok(res, { message: 'อัปโหลดสลิปสำเร็จ' });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
