// api/admin/students.js
//   GET    → list students (รองรับ filter status)
//   POST   → add/import (auto deduplicate, รองรับ G-code)
//   PUT    → update (รวม update id_card เมื่อได้บัตรจริง)
//   DELETE → remove
//
//   POST ?action=enroll-late → ลงทะเบียนนักเรียนย้ายเข้ากลางเทอม + ออกบิลด้วย
//   POST ?action=update-id   → อัปเดต ID จากชั่วคราว (G-code) เป็นเลขบัตรจริง
//
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

// ─────────────────────────────────────────────
// Validation: ตรวจ id_card ทั้ง 13 หลัก หรือ G-code
// ─────────────────────────────────────────────
function validateIdCard(idCard) {
  const id = String(idCard || '').trim();
  if (!id) return { valid: false, error: 'ไม่มี ID' };

  // เลขบัตรประชาชน 13 หลัก (เลขล้วน)
  if (/^\d{13}$/.test(id)) return { valid: true, type: 'real' };

  // G-code: G + 12 หลัก (เด็กต่างด้าว) — Ministry of Education format
  if (/^G\d{12}$/i.test(id)) return { valid: true, type: 'g-code' };

  // TEMP-XXXXXX: ชั่วคราว 6+ หลัก (เด็กรอบัตร)
  if (/^TEMP-\d{6,}$/i.test(id)) return { valid: true, type: 'temp' };

  return { valid: false, error: 'ID ไม่ถูกต้อง — ต้องเป็นเลขบัตร 13 หลัก, G-code (G + 12 หลัก) หรือ TEMP-XXXXXX' };
}

// ─────────────────────────────────────────────
// Helper: Generate TEMP ID อัตโนมัติ
// ─────────────────────────────────────────────
async function generateTempId() {
  const ts = Date.now().toString().slice(-9);  // 9 หลักท้ายของ timestamp
  return 'TEMP-' + ts;
}

// แปลงห้อง เช่น "ม.1/1" → "101"
function classToCode(c) {
  const m = String(c).match(/(\d+)[\/\-](\d+)/);
  if (m) return (m[1] + ('00' + m[2]).slice(-2)).slice(0, 3);
  return ('000' + String(c).replace(/\D/g, '').slice(0, 3)).slice(-3);
}

function buildRef2(cls, term, year) {
  return classToCode(cls)
       + String(term).replace(/\D/g, '').slice(-1)
       + String(year).replace(/\D/g, '').slice(-2);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  const action = req.query.action;

  try {
    // ─────────────────────────────────────
    // POST ?action=enroll-late → ย้ายเข้ากลางเทอม
    // ─────────────────────────────────────
    if (req.method === 'POST' && action === 'enroll-late') {
      const {
        idCard, studentId, name, class: cls, imageUrl,
        notes,                          // หมายเหตุ
        bills                            // [{ year, term, amount, title, docUrl }]
      } = req.body || {};

      if (!name) return fail(res, 'กรุณาระบุชื่อ');
      if (!cls) return fail(res, 'กรุณาระบุห้อง');

      // ถ้าไม่มี idCard → สร้าง TEMP-xxx อัตโนมัติ
      let finalId = idCard ? String(idCard).trim() : await generateTempId();
      const validation = validateIdCard(finalId);
      if (!validation.valid) return fail(res, validation.error);

      // ตรวจว่า ID ซ้ำหรือไม่
      const { data: existing } = await supabase
        .from('students')
        .select('id_card')
        .eq('id_card', finalId)
        .maybeSingle();

      if (existing) return fail(res, `มี ID ${finalId} ในระบบอยู่แล้ว`);

      // 1. สร้างนักเรียน
      const { error: errStu } = await supabase.from('students').insert({
        id_card: finalId,
        student_id: studentId || '',
        name,
        class: cls,
        image_url: imageUrl || '',
        status: 'transferred_in',
        notes: notes || `ย้ายเข้ากลางเทอม ${new Date().toLocaleDateString('th-TH')}`,
        enrolled_at: new Date().toISOString()
      });

      if (errStu) return fail(res, errStu.message, 500);

      // 2. สร้างบิลให้ (ถ้ามี)
      let billsCreated = 0;
      if (Array.isArray(bills) && bills.length > 0) {
        const now = Date.now();
        const billRows = bills.map((b, i) => ({
          trans_id: 'T' + now + i,
          id_card: finalId,
          year: String(b.year || ''),
          term: String(b.term || ''),
          amount: Number(b.amount || 0),
          status: 'รอชำระ',
          title: b.title || 'ค่าบำรุงการศึกษา',
          doc_url: b.docUrl || '',
          ref1: validation.type === 'real' ? finalId : '',  // ถ้าเป็น TEMP/G ไม่ใส่ ref1
          ref2: buildRef2(cls, b.term, b.year),
          batch_id: 'LATE-' + now,
          bill_type: 'late_enrollment'
        }));

        const { error: errBill } = await supabase.from('payments').insert(billRows);
        if (errBill) return fail(res, 'นักเรียนสร้างแล้วแต่บิลผิดพลาด: ' + errBill.message, 500);
        billsCreated = billRows.length;
      }

      return ok(res, {
        idCard: finalId,
        type: validation.type,
        billsCreated,
        message: `เพิ่มนักเรียน ${name} (${finalId}) เรียบร้อย${billsCreated ? ` พร้อมบิล ${billsCreated} รายการ` : ''}`
      });
    }

    // ─────────────────────────────────────
    // POST ?action=update-id → อัปเดต ID จาก TEMP/G เป็นเลขบัตรจริง
    // ─────────────────────────────────────
    if (req.method === 'POST' && action === 'update-id') {
      const { oldId, newId } = req.body || {};
      if (!oldId || !newId) return fail(res, 'กรุณาระบุ oldId + newId');

      const validation = validateIdCard(newId);
      if (!validation.valid) return fail(res, validation.error);
      if (validation.type !== 'real') return fail(res, 'เลข ID ใหม่ต้องเป็นเลขบัตรประชาชน 13 หลัก');

      // ตรวจว่า newId ไม่ซ้ำ
      const { data: dup } = await supabase
        .from('students')
        .select('id_card')
        .eq('id_card', newId)
        .maybeSingle();

      if (dup) return fail(res, `เลขบัตร ${newId} มีในระบบอยู่แล้ว`);

      // อัปเดตทั้ง students และ payments (ทำใน transaction)
      // 1. อัปเดต students
      const { error: errStu } = await supabase
        .from('students')
        .update({
          id_card: newId,
          status: 'active',
          notes: null
        })
        .eq('id_card', oldId);

      if (errStu) return fail(res, errStu.message, 500);

      // 2. อัปเดต payments (id_card + ref1)
      const { error: errPay } = await supabase
        .from('payments')
        .update({
          id_card: newId,
          ref1: newId
        })
        .eq('id_card', oldId);

      if (errPay) return fail(res, 'นักเรียนอัปเดตแล้วแต่ payments error: ' + errPay.message, 500);

      return ok(res, {
        message: `อัปเดต ID จาก ${oldId} → ${newId} เรียบร้อย`,
        oldId, newId
      });
    }

    // ─────────────────────────────────────
    // GET → ดึงรายชื่อนักเรียน (รองรับ filter status)
    // ─────────────────────────────────────
    if (req.method === 'GET') {
      const { status: statusFilter, class: clsFilter } = req.query;

      let q = supabase.from('students').select('*').order('class', { ascending: true });
      if (statusFilter && statusFilter !== 'ALL') q = q.eq('status', statusFilter);
      if (clsFilter && clsFilter !== 'ALL') q = q.eq('class', clsFilter);

      const { data, error } = await q;
      if (error) return fail(res, error.message, 500);

      return ok(res, {
        students: (data || []).map(s => ({
          idCard: s.id_card,
          studentId: s.student_id || '',
          name: s.name || '',
          class: s.class || '',
          imageUrl: s.image_url || '',
          status: s.status || 'active',
          notes: s.notes || '',
          enrolledAt: s.enrolled_at,
          idType: validateIdCard(s.id_card).type || 'unknown'
        }))
      });
    }

    // ─────────────────────────────────────
    // POST → เพิ่ม/import (auto deduplicate)
    // ─────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      const list = Array.isArray(body) ? body : (body.list || [body]);

      const allRows = [];
      const invalidRows = [];

      list.forEach((p, idx) => {
        let idCard = String(p.idCard || p.ID_Card || p['เลขบัตรประชาชน'] || p['เลขบัตร'] || '').trim();

        // ถ้าเป็นตัวเลขล้วน → อาจเป็นเลขบัตร (clean digits)
        if (/^\d+$/.test(idCard)) idCard = idCard.replace(/\D/g, '').slice(0, 13);

        const name = String(p.name || p.Name || p['ชื่อ-สกุล'] || p['ชื่อ'] || '').trim();

        const validation = validateIdCard(idCard);
        if (!validation.valid) {
          invalidRows.push({ row: idx + 2, reason: validation.error || 'ID ไม่ถูกต้อง' });
          return;
        }
        if (!name) {
          invalidRows.push({ row: idx + 2, reason: 'ไม่มีชื่อ' });
          return;
        }

        allRows.push({
          id_card: idCard,
          student_id: String(p.studentId || p.Student_ID || p['รหัสนักเรียน'] || '').trim(),
          name,
          class: String(p.class || p.Class || p['ห้อง'] || p['ชั้น'] || '').trim(),
          image_url: String(p.imageUrl || p.Image_URL || p['URL รูป'] || '').trim(),
          status: validation.type === 'real' ? 'active' : 'pending_id',
          notes: validation.type !== 'real' ? `ID ชั่วคราว — รอเลขบัตรจริง (${validation.type})` : null
        });
      });

      if (allRows.length === 0) {
        return fail(res, 'ไม่พบข้อมูลที่ใช้ได้ — ตรวจ format เลขบัตร และชื่อ');
      }

      // Deduplicate
      const seenMap = new Map();
      const duplicates = [];
      allRows.forEach(r => {
        if (seenMap.has(r.id_card)) duplicates.push(r.id_card);
        seenMap.set(r.id_card, r);
      });
      const rows = Array.from(seenMap.values());

      // Upsert ทีละ batch
      const CHUNK_SIZE = 200;
      let totalUpserted = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const slice = rows.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('students').upsert(slice, { onConflict: 'id_card' });
        if (error) {
          errors.push(`Batch ${i / CHUNK_SIZE + 1}: ${error.message}`);
          continue;
        }
        totalUpserted += slice.length;
      }

      const skipped = list.length - allRows.length;
      const message = `นำเข้าสำเร็จ ${totalUpserted} รายการ`
        + (duplicates.length > 0 ? ` (ซ้ำ ${duplicates.length} แถว ใช้ข้อมูลล่าสุด)` : '')
        + (skipped > 0 ? ` | ข้าม ${skipped} แถว` : '');

      if (errors.length > 0) return fail(res, `บันทึกบางส่วนผิดพลาด: ${errors.join('; ')}`, 500);

      return ok(res, { count: totalUpserted, skipped, duplicates: duplicates.length, message });
    }

    // ─────────────────────────────────────
    // PUT → แก้ไข
    // ─────────────────────────────────────
    if (req.method === 'PUT') {
      const { idCard, studentId, name, class: cls, imageUrl, status, notes } = req.body || {};
      if (!idCard) return fail(res, 'กรุณาระบุ idCard');

      const updates = {
        student_id: studentId || '',
        name: name || '',
        class: cls || '',
        image_url: imageUrl || ''
      };
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;

      const { error } = await supabase.from('students').update(updates).eq('id_card', idCard);
      if (error) return fail(res, error.message, 500);
      return ok(res, { message: 'อัปเดตสำเร็จ' });
    }

    // ─────────────────────────────────────
    // DELETE
    // ─────────────────────────────────────
    if (req.method === 'DELETE') {
      const idCard = req.query.idCard || (req.body && req.body.idCard);
      if (!idCard) return fail(res, 'กรุณาระบุ idCard');

      const { error } = await supabase.from('students').delete().eq('id_card', idCard);
      if (error) return fail(res, error.message, 500);
      return ok(res, { message: 'ลบสำเร็จ' });
    }

    return fail(res, 'Method not allowed', 405);
  } catch (e) {
    return fail(res, e.message, 500);
  }
};
