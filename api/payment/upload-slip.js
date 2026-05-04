// api/payment/upload-slip.js - บันทึกสลิป + เปลี่ยนสถานะเป็น "กำลังตรวจสอบ"
//
// Frontend จะอัปโหลดไฟล์ไปที่ Supabase Storage ก่อน (ผ่าน anon key)
// แล้วส่ง URL กลับมาให้ API นี้อัปเดตสถานะ
//
const supabase = require('../../lib/supabase');
const { ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);
  if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

  try {
    const { transId, slipUrl, payerName } = req.body || {};
    if (!transId) return fail(res, 'ไม่พบรหัสรายการ');
    if (!slipUrl) return fail(res, 'กรุณาแนบสลิป');

    // ตรวจว่ามีรายการนี้จริงและสถานะยังไม่ "ชำระแล้ว"
    const { data: existing } = await supabase
      .from('payments')
      .select('trans_id,status')
      .eq('trans_id', transId)
      .maybeSingle();

    if (!existing) return fail(res, 'ไม่พบรายการชำระ', 404);
    if (existing.status === 'ชำระแล้ว') return fail(res, 'รายการนี้ชำระแล้ว', 400);

    const { error } = await supabase
      .from('payments')
      .update({
        status: 'กำลังตรวจสอบ',
        slip_url: slipUrl,
        payer_name: payerName || '',
        updated_at: new Date().toISOString()
      })
      .eq('trans_id', transId);

    if (error) return fail(res, error.message, 500);

    return ok(res, { message: 'อัปโหลดสลิปสำเร็จ' });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
