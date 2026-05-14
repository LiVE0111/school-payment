// api/admin/payments.js
//   GET                          → ดึง payments (server-side pagination)
//   GET ?action=export           → Export CSV (streaming)
//   GET ?action=summary          → สถิติย่อ (เร็วกว่า /stats)
//
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  const action = req.query.action;

  try {
    // ─────────────────────────────────────
    // ACTION: export → Streaming CSV
    // ─────────────────────────────────────
    if (action === 'export') {
      const { status, cls, year, term, search } = req.query;

      const headers = [
        'เลขที่ใบเสร็จ', 'ห้อง', 'รหัสนักเรียน', 'ชื่อ-สกุล', 'เลขบัตรประชาชน',
        'รายการ', 'ปี', 'เทอม', 'จำนวนเงิน', 'สถานะ',
        'ชื่อผู้ชำระ', 'Ref.1', 'Ref.2', 'อนุมัติโดย', 'วันที่อนุมัติ',
        'วันที่อัปเดต', 'หมายเหตุ', 'ประเภทบิล'
      ];

      const esc = (v) => {
        const s = String(v ?? '');
        if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };

      // เริ่ม CSV header
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="payments-${new Date().toISOString().slice(0,10)}.csv"`);
      res.setHeader('Cache-Control', 'no-cache');

      // BOM + headers
      res.write('\uFEFF' + headers.map(esc).join(',') + '\r\n');

      // ดึงนักเรียนทั้งหมด (small dataset)
      const { data: students } = await supabase.from('students').select('id_card,name,class,student_id');
      const stuMap = {};
      (students || []).forEach(s => { stuMap[s.id_card] = s; });

      // Stream payments ทีละ batch (1000 rows ต่อ batch)
      const BATCH = 1000;
      let from = 0;
      let totalRows = 0;
      const MAX_TIME_MS = 8000;  // กัน Vercel timeout 10s
      const startTime = Date.now();

      while (true) {
        if (Date.now() - startTime > MAX_TIME_MS) {
          res.write('\r\n# WARNING: Export อาจไม่ครบ — ใช้ filter ที่แคบกว่านี้\r\n');
          break;
        }

        let q = supabase.from('payments')
          .select('*')
          .order('updated_at', { ascending: false })
          .range(from, from + BATCH - 1);

        if (status && status !== 'ALL') q = q.eq('status', status);
        if (year && year !== 'ALL') q = q.eq('year', String(year));
        if (term && term !== 'ALL') q = q.eq('term', String(term));

        const { data: chunk, error } = await q;
        if (error) {
          res.write(`\r\n# ERROR: ${error.message}\r\n`);
          break;
        }
        if (!chunk || chunk.length === 0) break;

        chunk.forEach(p => {
          const stu = stuMap[p.id_card] || {};
          if (cls && cls !== 'ALL' && stu.class !== cls) return;

          if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            const hay = [stu.name, stu.student_id, p.id_card, p.ref1, p.ref2, p.receipt_no, p.payer_name]
              .filter(Boolean).join(' ').toLowerCase();
            if (!hay.includes(q)) return;
          }

          const row = [
            p.receipt_no || '',
            stu.class || '',
            stu.student_id || '',
            stu.name || '',
            p.id_card || '',
            p.title || '',
            p.year || '',
            p.term || '',
            Number(p.amount || 0).toFixed(2),
            p.status || '',
            p.payer_name || '',
            p.ref1 || '',
            p.ref2 || '',
            p.approved_by || '',
            p.approved_at ? p.approved_at.slice(0, 19).replace('T', ' ') : '',
            p.updated_at ? p.updated_at.slice(0, 19).replace('T', ' ') : '',
            p.reason || '',
            p.bill_type || 'batch'
          ];
          res.write(row.map(esc).join(',') + '\r\n');
          totalRows++;
        });

        if (chunk.length < BATCH) break;
        from += BATCH;
      }

      res.end();
      return;
    }

    // ─────────────────────────────────────
    // ACTION: summary → สถิติย่อ (เร็ว)
    // ─────────────────────────────────────
    if (action === 'summary') {
      const { cls, year, term } = req.query;

      const statuses = ['รอชำระ', 'กำลังตรวจสอบ', 'ชำระแล้ว', 'ชำระไม่สำเร็จ'];
      const summary = { total: 0, totalAmount: 0 };

      for (const s of statuses) {
        let q = supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', s);
        if (year && year !== 'ALL') q = q.eq('year', String(year));
        if (term && term !== 'ALL') q = q.eq('term', String(term));

        const { count } = await q;
        summary[s] = count || 0;
        summary.total += count || 0;
      }

      // ยอดรวมที่ชำระแล้ว
      let qPaid = supabase.from('payments').select('amount').eq('status', 'ชำระแล้ว');
      if (year && year !== 'ALL') qPaid = qPaid.eq('year', String(year));
      if (term && term !== 'ALL') qPaid = qPaid.eq('term', String(term));

      const { data: paidData } = await qPaid;
      summary.totalAmount = (paidData || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

      return ok(res, summary);
    }

    // ─────────────────────────────────────
    // DEFAULT: GET (พร้อม pagination)
    // ─────────────────────────────────────
    const { status, cls, year, term, search, page, pageSize } = req.query;
    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limit = Math.min(PAGE_SIZE_MAX, Math.max(10, parseInt(pageSize || PAGE_SIZE_DEFAULT, 10)));
    const offset = (pageNum - 1) * limit;

    // 1. Build base query
    let q = supabase.from('payments').select('*', { count: 'exact' }).order('updated_at', { ascending: false });

    if (status && status !== 'ALL') q = q.eq('status', status);
    if (year && year !== 'ALL') q = q.eq('year', String(year));
    if (term && term !== 'ALL') q = q.eq('term', String(term));

    // 2. Pagination
    q = q.range(offset, offset + limit - 1);

    const { data: payments, error, count: totalCount } = await q;
    if (error) return fail(res, error.message, 500);

    // 3. ดึงนักเรียน (เฉพาะที่จำเป็น)
    const idCards = (payments || []).map(p => p.id_card).filter(Boolean);
    const { data: students } = idCards.length > 0
      ? await supabase.from('students').select('id_card,name,class,student_id,status').in('id_card', idCards)
      : { data: [] };

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
      billType: p.bill_type || 'batch',
      receiptNo: p.receipt_no || '',
      receiptIssuedAt: p.receipt_issued_at || '',
      approvedBy: p.approved_by || '',
      approvedAt: p.approved_at || '',
      studentName: (stuMap[p.id_card] || {}).name || '-',
      studentId: (stuMap[p.id_card] || {}).student_id || '',
      studentClass: (stuMap[p.id_card] || {}).class || '-',
      studentStatus: (stuMap[p.id_card] || {}).status || 'active'
    }));

    // 4. Filter ในเมมโมรี (สำหรับ class + search ที่ต้อง join)
    if (cls && cls !== 'ALL') {
      result = result.filter(r => r.studentClass === cls);
    }

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

    return ok(res, {
      payments: result,
      pagination: {
        page: pageNum,
        pageSize: limit,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasMore: offset + limit < (totalCount || 0)
      }
    });
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
