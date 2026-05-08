// api/admin/students.js
//   GET    → list students
//   POST   → add/import (auto deduplicate by id_card)
//   PUT    → update (single)
//   DELETE → remove (single)
//
const supabase = require('../../lib/supabase');
const { requireAdmin, ok, fail, handleOptions } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(res);

  const user = requireAdmin(req);
  if (!user) return fail(res, 'ไม่ได้รับอนุญาต', 401);

  try {
    // ─────────────────────────────────────
    // GET → ดึงรายชื่อนักเรียน
    // ─────────────────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('class', { ascending: true });
      if (error) return fail(res, error.message, 500);
      return ok(res, {
        students: (data || []).map(s => ({
          idCard: s.id_card,
          studentId: s.student_id || '',
          name: s.name || '',
          class: s.class || '',
          imageUrl: s.image_url || ''
        }))
      });
    }

    // ─────────────────────────────────────
    // POST → เพิ่ม/import นักเรียน (auto deduplicate)
    // ─────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      const list = Array.isArray(body) ? body : (body.list || [body]);

      // 1. แปลง field names + clean ข้อมูล
      const allRows = list
        .map(p => ({
          id_card:    String(p.idCard    || p.ID_Card    || p['เลขบัตรประชาชน'] || '').trim().replace(/\D/g, '').slice(0, 13),
          student_id: String(p.studentId || p.Student_ID || p['รหัสนักเรียน']    || '').trim(),
          name:       String(p.name      || p.Name       || p['ชื่อ-สกุล']        || p['ชื่อ']    || '').trim(),
          class:      String(p.class     || p.Class      || p['ห้อง']             || p['ชั้น']    || '').trim(),
          image_url:  String(p.imageUrl  || p.Image_URL  || p['URL รูป']          || '').trim()
        }))
        .filter(r => r.id_card && r.id_card.length === 13 && r.name);  // กรองเฉพาะที่มีเลขบัตร 13 หลัก + ชื่อ

      if (allRows.length === 0) {
        return fail(res, 'ไม่พบข้อมูลที่ถูกต้อง — ตรวจสอบว่ามีเลขบัตรประชาชน 13 หลัก และชื่อ');
      }

      // 2. ⭐ Deduplicate by id_card — เก็บแถวสุดท้าย (ถ้าซ้ำ ใช้ข้อมูลล่าสุด)
      const seenMap = new Map();
      const duplicates = [];
      allRows.forEach(r => {
        if (seenMap.has(r.id_card)) {
          duplicates.push(r.id_card);
        }
        seenMap.set(r.id_card, r);  // overwrite — เก็บค่าใหม่กว่า
      });
      const rows = Array.from(seenMap.values());

      // 3. Upsert ทีละ batch (ลด timeout risk)
      const CHUNK_SIZE = 200;
      let totalUpserted = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const slice = rows.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
          .from('students')
          .upsert(slice, { onConflict: 'id_card' });

        if (error) {
          errors.push(`Batch ${i / CHUNK_SIZE + 1}: ${error.message}`);
          continue;
        }
        totalUpserted += slice.length;
      }

      // 4. ตอบกลับ
      const skipped = list.length - allRows.length;
      const message = `นำเข้าสำเร็จ ${totalUpserted} รายการ`
        + (duplicates.length > 0 ? ` (รวมข้อมูลซ้ำ ${duplicates.length} แถว ใช้ข้อมูลล่าสุด)` : '')
        + (skipped > 0 ? ` | ข้ามไป ${skipped} แถว (เลขบัตรไม่ครบหรือไม่มีชื่อ)` : '');

      if (errors.length > 0) {
        return fail(res, `บันทึกบางส่วนผิดพลาด: ${errors.join('; ')}`, 500);
      }

      return ok(res, {
        count: totalUpserted,
        skipped,
        duplicates: duplicates.length,
        message
      });
    }

    // ─────────────────────────────────────
    // PUT → แก้ไขข้อมูลนักเรียนเดี่ยว
    // ─────────────────────────────────────
    if (req.method === 'PUT') {
      const { idCard, studentId, name, class: cls, imageUrl } = req.body || {};
      if (!idCard) return fail(res, 'กรุณาระบุ idCard');

      const { error } = await supabase
        .from('students')
        .update({
          student_id: studentId || '',
          name: name || '',
          class: cls || '',
          image_url: imageUrl || ''
        })
        .eq('id_card', idCard);

      if (error) return fail(res, error.message, 500);
      return ok(res, { message: 'อัปเดตสำเร็จ' });
    }

    // ─────────────────────────────────────
    // DELETE → ลบนักเรียน
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
