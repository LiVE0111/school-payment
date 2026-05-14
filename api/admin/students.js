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
    // POST ?action=promote-single → เลื่อนชั้นรายบุคคล (เปลี่ยนห้อง)
    // body: { idCard, newClass, notes? }
    // ─────────────────────────────────────
    if (req.method === 'POST' && action === 'promote-single') {
      const { idCard, newClass, notes } = req.body || {};
      if (!idCard) return fail(res, 'กรุณาระบุ idCard');
      if (!newClass) return fail(res, 'กรุณาระบุ newClass (ห้องใหม่)');

      // ตรวจว่านักเรียนมีจริงไหม
      const { data: student, error: errStu } = await supabase
        .from('students')
        .select('id_card,name,class')
        .eq('id_card', idCard)
        .maybeSingle();

      if (errStu) return fail(res, errStu.message, 500);
      if (!student) return fail(res, 'ไม่พบนักเรียน', 404);

      const oldClass = student.class;
      if (oldClass === newClass) {
        return fail(res, 'นักเรียนอยู่ห้อง ' + newClass + ' อยู่แล้ว');
      }

      // อัปเดตห้อง + เพิ่มหมายเหตุ
      const noteText = notes || `เลื่อนชั้น ${oldClass} → ${newClass} (${new Date().toLocaleDateString('th-TH')})`;
      const { error: errUpd } = await supabase
        .from('students')
        .update({
          class: newClass,
          notes: noteText
        })
        .eq('id_card', idCard);

      if (errUpd) return fail(res, errUpd.message, 500);

      // นับบิลค้างชำระเก่า (เพื่อแจ้งเตือน)
      const { count: pendingCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('id_card', idCard)
        .in('status', ['รอชำระ', 'กำลังตรวจสอบ', 'ชำระไม่สำเร็จ']);

      return ok(res, {
        message: `เลื่อนชั้น ${student.name}: ${oldClass} → ${newClass}`,
        student: { idCard: student.id_card, name: student.name, oldClass, newClass },
        pendingBills: pendingCount || 0,
        info: pendingCount > 0 ? `⚠️ นักเรียนคนนี้มีบิลค้างชำระเก่า ${pendingCount} รายการ (ยังคงอยู่ในระบบ ผู้ปกครองชำระได้ตามปกติ)` : null
      });
    }

    // ─────────────────────────────────────
    // POST ?action=promote-batch → เลื่อนชั้นทั้งห้อง / ทั้งช่วงชั้น
    // body: { fromClass, toClass, idCards? (ถ้าไม่ระบุ = ทั้งห้อง) }
    // หรือ: { promotions: [{ fromClass, toClass }, ...] } (หลายห้องพร้อมกัน)
    // ─────────────────────────────────────
    if (req.method === 'POST' && action === 'promote-batch') {
      const { fromClass, toClass, idCards, promotions, dryRun } = req.body || {};

      // โหมด: หลายห้องพร้อมกัน
      if (Array.isArray(promotions) && promotions.length > 0) {
        const results = [];
        const errors = [];
        let totalUpdated = 0;
        let totalPendingBills = 0;

        for (const p of promotions) {
          if (!p.fromClass || !p.toClass) {
            errors.push(`${p.fromClass || '?'} → ${p.toClass || '?'}: ข้อมูลไม่ครบ`);
            continue;
          }

          // ดึงนักเรียนในห้องเดิม (เฉพาะ active)
          const { data: studs } = await supabase
            .from('students')
            .select('id_card,name')
            .eq('class', p.fromClass)
            .neq('status', 'transferred_out')
            .neq('status', 'graduated');

          const list = studs || [];
          if (list.length === 0) {
            results.push({ from: p.fromClass, to: p.toClass, updated: 0, note: 'ไม่มีนักเรียน' });
            continue;
          }

          if (dryRun) {
            results.push({ from: p.fromClass, to: p.toClass, willUpdate: list.length });
            totalUpdated += list.length;
            continue;
          }

          // อัปเดตทั้งห้อง
          const today = new Date().toLocaleDateString('th-TH');
          const { error: errUpd } = await supabase
            .from('students')
            .update({
              class: p.toClass,
              notes: `เลื่อนชั้น ${p.fromClass} → ${p.toClass} (${today})`
            })
            .eq('class', p.fromClass)
            .neq('status', 'transferred_out')
            .neq('status', 'graduated');

          if (errUpd) {
            errors.push(`${p.fromClass} → ${p.toClass}: ${errUpd.message}`);
            continue;
          }

          // นับบิลค้างของทั้งห้อง
          const idCardList = list.map(s => s.id_card);
          const { count: pCount } = await supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .in('id_card', idCardList)
            .in('status', ['รอชำระ', 'กำลังตรวจสอบ', 'ชำระไม่สำเร็จ']);

          totalPendingBills += (pCount || 0);
          totalUpdated += list.length;
          results.push({ from: p.fromClass, to: p.toClass, updated: list.length, pendingBills: pCount || 0 });
        }

        return ok(res, {
          dryRun: !!dryRun,
          totalUpdated,
          totalPendingBills,
          results,
          errors,
          message: dryRun
            ? `จะเลื่อน ${totalUpdated} คน ใน ${results.length} ห้อง (ทดสอบ)`
            : `เลื่อนชั้น ${totalUpdated} คน ใน ${results.length} ห้องเรียบร้อย`
        });
      }

      // โหมด: ห้องเดียว
      if (!fromClass || !toClass) {
        return fail(res, 'กรุณาระบุ fromClass + toClass หรือ promotions[]');
      }

      // ดึงนักเรียนในห้องเดิม
      let query = supabase
        .from('students')
        .select('id_card,name')
        .eq('class', fromClass)
        .neq('status', 'transferred_out')
        .neq('status', 'graduated');

      // ถ้าระบุ idCards = เลื่อนเฉพาะคนที่เลือก
      if (Array.isArray(idCards) && idCards.length > 0) {
        query = query.in('id_card', idCards);
      }

      const { data: studs, error: errSel } = await query;
      if (errSel) return fail(res, errSel.message, 500);

      const list = studs || [];
      if (list.length === 0) return fail(res, 'ไม่พบนักเรียนในห้อง ' + fromClass);

      // Dry run = แค่ดูว่าจะเลื่อนกี่คน
      if (dryRun) {
        const idCardList = list.map(s => s.id_card);
        const { count: pCount } = await supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .in('id_card', idCardList)
          .in('status', ['รอชำระ', 'กำลังตรวจสอบ', 'ชำระไม่สำเร็จ']);

        return ok(res, {
          dryRun: true,
          willUpdate: list.length,
          pendingBills: pCount || 0,
          students: list,
          message: `จะเลื่อน ${list.length} คน จาก ${fromClass} → ${toClass}`
        });
      }

      // อัปเดตจริง
      const today = new Date().toLocaleDateString('th-TH');
      const idCardList = list.map(s => s.id_card);
      const { error: errUpd } = await supabase
        .from('students')
        .update({
          class: toClass,
          notes: `เลื่อนชั้น ${fromClass} → ${toClass} (${today})`
        })
        .in('id_card', idCardList);

      if (errUpd) return fail(res, errUpd.message, 500);

      // นับบิลค้าง
      const { count: pendingCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .in('id_card', idCardList)
        .in('status', ['รอชำระ', 'กำลังตรวจสอบ', 'ชำระไม่สำเร็จ']);

      return ok(res, {
        updated: list.length,
        from: fromClass,
        to: toClass,
        pendingBills: pendingCount || 0,
        message: `เลื่อน ${list.length} คน จาก ${fromClass} → ${toClass} เรียบร้อย`,
        info: pendingCount > 0
          ? `⚠️ มีบิลค้างชำระเก่า ${pendingCount} รายการ (ยังคงอยู่ในระบบ ผู้ปกครองชำระได้ตามปกติ)`
          : null
      });
    }

    // ─────────────────────────────────────
    // POST ?action=graduate → จบการศึกษา (status=graduated)
    // body: { idCards: [...] } หรือ { fromClass }
    // ─────────────────────────────────────
    if (req.method === 'POST' && action === 'graduate') {
      const { idCards, fromClass } = req.body || {};

      let query = supabase.from('students').update({
        status: 'graduated',
        notes: `จบการศึกษา (${new Date().toLocaleDateString('th-TH')})`
      });

      if (Array.isArray(idCards) && idCards.length > 0) {
        query = query.in('id_card', idCards);
      } else if (fromClass) {
        query = query.eq('class', fromClass);
      } else {
        return fail(res, 'กรุณาระบุ idCards หรือ fromClass');
      }

      const { error } = await query;
      if (error) return fail(res, error.message, 500);

      return ok(res, { message: 'อัปเดตสถานะเป็น "จบการศึกษา" เรียบร้อย' });
    }

    // ─────────────────────────────────────
    // GET ?action=payment-history → ประวัติบิลของนักเรียน (ข้ามปี/เทอม)
    // ?idCard=...
    // ─────────────────────────────────────
    if (req.method === 'GET' && action === 'payment-history') {
      const idCard = req.query.idCard;
      if (!idCard) return fail(res, 'กรุณาระบุ idCard');

      const { data: student } = await supabase
        .from('students')
        .select('id_card,name,class,student_id,status')
        .eq('id_card', idCard)
        .maybeSingle();

      const { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id_card', idCard)
        .order('year', { ascending: false })
        .order('term', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) return fail(res, error.message, 500);

      // สรุปสถานะ
      const summary = { total: 0, paid: 0, pending: 0, failed: 0, pendingAmount: 0, paidAmount: 0 };
      (payments || []).forEach(p => {
        summary.total++;
        const amt = Number(p.amount || 0);
        if (p.status === 'ชำระแล้ว') { summary.paid++; summary.paidAmount += amt; }
        else if (p.status === 'รอชำระ' || p.status === 'กำลังตรวจสอบ') { summary.pending++; summary.pendingAmount += amt; }
        else if (p.status === 'ชำระไม่สำเร็จ') summary.failed++;
      });

      return ok(res, {
        student,
        payments: payments || [],
        summary
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
