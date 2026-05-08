// lib/receipt.js - Receipt number generator + activity logger
const supabase = require('./supabase');

// ─────────────────────────────────────────────
// สร้างเลขที่ใบเสร็จ running number
// รูปแบบ: YYYY-NNNNNN (เช่น 2569-000001)
// ─────────────────────────────────────────────
async function generateReceiptNumber() {
  const yearTH = (new Date().getFullYear() + 543).toString();

  // upsert + return
  const { data, error } = await supabase.rpc('increment_receipt_counter', { p_year: yearTH });

  if (error || !data) {
    // Fallback: ใช้ raw query
    const { data: counter } = await supabase
      .from('receipt_counter')
      .select('current_number,year_prefix')
      .eq('id', 1)
      .single();

    let newNum = 1;
    if (counter) {
      // ถ้าปีเปลี่ยน → reset
      if (counter.year_prefix !== yearTH) {
        newNum = 1;
      } else {
        newNum = (counter.current_number || 0) + 1;
      }
    }

    await supabase
      .from('receipt_counter')
      .update({
        current_number: newNum,
        year_prefix: yearTH,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    return `${yearTH}-${String(newNum).padStart(6, '0')}`;
  }

  return `${yearTH}-${String(data).padStart(6, '0')}`;
}

// ─────────────────────────────────────────────
// Activity logger
// ─────────────────────────────────────────────
async function logActivity(entry) {
  try {
    await supabase.from('activity_logs').insert(entry);
  } catch (e) {
    console.error('Failed to log activity:', e.message);
  }
}

module.exports = {
  generateReceiptNumber,
  logActivity
};
