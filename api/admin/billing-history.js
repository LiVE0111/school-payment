// api/admin/billing-history.js - GET + POST (update batch)
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('billing_history')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return fail(res, error.message, 500);

      return ok(res, {
        history: (data || []).map(h => ({
          batchId: h.batch_id,
          date: h.created_at,
          admin: h.admin_name,
          year: h.year,
          term: h.term,
          target: h.target,
          count: h.count
        }))
      });
    }

    // POST: อัปเดต title/amount/docUrl ของ batch ที่ "ยังรอชำระ"
    if (req.method === 'POST') {
      const { batchId, title, amount, docUrl } = req.body || {};
      if (!batchId) return fail(res, 'ไม่พบ batchId');

      const update = { updated_at: new Date().toISOString() };
      if (title !== undefined)  update.title = title;
      if (amount !== undefined) update.amount = Number(amount);
      if (docUrl !== undefined) update.doc_url = docUrl;

      const { error, count } = await supabase
        .from('payments')
        .update(update, { count: 'exact' })
        .eq('batch_id', batchId)
        .eq('status', 'รอชำระ');

      if (error) return fail(res, error.message, 500);
      return ok(res, { count: count || 0 });
    }

    return fail(res, 'Method not allowed', 405);
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
