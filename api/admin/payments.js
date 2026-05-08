// api/admin/payments.js
//   GET                          → ดึงรายการ payments พร้อมกรอง + search
//   GET ?action=export           → Export CSV/Excel
//
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  const action = req.query.action;

  try {
    const { status, cls, year, term, limit, search, dateFrom, dateTo } = req.query;

    let q = supabase.from('payments').select('*').order('updated_at', { ascending: false });

    if (status && status !== 'ALL') q = q.eq('status', status);
    if (year   && year   !== 'ALL') q = q.eq('year', String(year));
    if (term   && term   !== 'ALL') q = q.eq('term', String(term));
    if (dateFrom) q = q.gte('updated_at', dateFrom);
    if (dateTo) q = q.lte('updated_at', dateTo);
    if (action !== 'export' && limit) q = q.limit(parseInt(limit, 10));

    const { data: payments, error } = await q;
    if (error) return fail(res, error.message, 500);

    const { data: students } = await supabase.from('students').select('id_card,name,class,student_id');
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
      receiptNo: p.receipt_no || '',
      receiptIssuedAt: p.receipt_issued_at || '',
      approvedBy: p.approved_by || '',
      approvedAt: p.approved_at || '',
      studentName: (stuMap[p.id_card] || {}).name || '-',
      studentId: (stuMap[p.id_card] || {}).student_id || '',
      studentClass: (stuMap[p.id_card] || {}).class || '-'
    }));

    // Filter โดย class
    if (cls && cls !== 'ALL') {
      result = result.filter(r => r.studentClass === cls);
    }

    // Search ขั้นสูง — ค้นได้ทั้ง: ชื่อ / รหัสนักเรียน / เลขบัตร / Ref1 / Ref2 / เลขใบเสร็จ
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(r =>
        (r.studentName || '').toLowerCase().includes(q) ||
        (r.studentId || '').toLowerCase().includes(q) ||
        (r.idCard || '').includes(q) ||
        (r.ref1 || '').toLowerCase().includes(q) ||
        (r.ref2 || '').toLowerCase().includes(q) ||
        (r.receiptNo || '').toLowerCase().includes(q) ||
        (r.payerName || '').toLowerCase().includes(q)
      );
    }

    // ─── Export CSV ───
    if (action === 'export') {
      const headers = [
        'เลขที่ใบเสร็จ', 'ห้อง', 'รหัสนักเรียน', 'ชื่อ-สกุล', 'เลขบัตรประชาชน',
        'รายการ', 'ปี', 'เทอม', 'จำนวนเงิน', 'สถานะ',
        'ชื่อผู้ชำระ', 'Ref.1', 'Ref.2', 'อนุมัติโดย', 'วันที่อนุมัติ',
        'วันที่อัปเดต', 'หมายเหตุ'
      ];

      const rows = result.map(r => [
        r.receiptNo || '',
        r.studentClass,
        r.studentId,
        r.studentName,
        r.idCard,
        r.title,
        r.year,
        r.term,
        r.amount.toFixed(2),
        r.status,
        r.payerName,
        r.ref1,
        r.ref2,
        r.approvedBy,
        r.approvedAt ? r.approvedAt.slice(0, 19).replace('T', ' ') : '',
        r.timestamp ? r.timestamp.slice(0, 19).replace('T', ' ') : '',
        r.reason
      ]);

      // Escape CSV (quote if contains comma, quote, or newline)
      const esc = (v) => {
        const s = String(v ?? '');
        if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };

      const csv = '\uFEFF' + [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n');
      // BOM เพื่อให้ Excel เปิดภาษาไทยถูกต้อง

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="payments-${new Date().toISOString().slice(0,10)}.csv"`);
      return res.status(200).send(csv);
    }

    return ok(res, { payments: result, total: result.length });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
