// api/admin/payments.js - ดึงรายการ payments พร้อมกรอง
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  try {
    const { status, cls, year, term, limit } = req.query;

    let q = supabase.from('payments').select('*').order('updated_at', { ascending: false });

    if (status && status !== 'ALL') q = q.eq('status', status);
    if (year   && year   !== 'ALL') q = q.eq('year', String(year));
    if (term   && term   !== 'ALL') q = q.eq('term', String(term));
    if (limit) q = q.limit(parseInt(limit, 10));

    const { data: payments, error } = await q;
    if (error) return fail(res, error.message, 500);

    // เอา student name + class ทั้งหมดมาก่อน (1 query)
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

    // กรองห้องเรียน (ทำหลังเพราะ student อยู่คนละตาราง)
    if (cls && cls !== 'ALL') {
      result = result.filter(r => r.studentClass === cls);
    }

    return ok(res, { payments: result });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
