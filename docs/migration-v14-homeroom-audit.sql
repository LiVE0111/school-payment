-- ════════════════════════════════════════════════════════════
-- School Payment System - Migration v14
-- 1. Homeroom Teacher role (เพิ่ม assigned_classes ใน admins)
-- 2. เพิ่ม index ให้ activity_logs (สำหรับ Audit Log UI)
-- ════════════════════════════════════════════════════════════

-- ── 1. admins: เพิ่ม assigned_classes ──
-- รองรับ role 'homeroom' ที่เห็นเฉพาะห้องที่รับผิดชอบ
ALTER TABLE admins ADD COLUMN IF NOT EXISTS assigned_classes TEXT[];
-- เช่น: ['ม.4/1', 'ม.4/2']  — ครูประจำชั้น 2 ห้อง

ALTER TABLE admins ADD COLUMN IF NOT EXISTS display_name TEXT;
-- ชื่อแสดง เช่น "ครูสมชาย สวยงาม"

CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);

-- ── 2. activity_logs: indexes เพิ่ม (สำหรับกรอง) ──
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_target ON activity_logs(target_type, target_id);

-- ── 3. (optional) เพิ่ม role check ──
-- ทำเป็น comment ไว้ ไม่ enforce
-- ALTER TABLE admins ADD CONSTRAINT chk_admin_role CHECK (role IN ('admin', 'super', 'homeroom'));
