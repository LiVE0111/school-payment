-- ════════════════════════════════════════════════════════════
-- School Payment System - Database Schema
-- รันใน Supabase SQL Editor ครั้งเดียว
-- ════════════════════════════════════════════════════════════

-- 1. ตาราง Admins (เจ้าหน้าที่)
CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'admin', -- admin / superadmin
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ตาราง Students (นักเรียน)
CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  id_card TEXT UNIQUE NOT NULL,
  student_id TEXT,
  name TEXT NOT NULL,
  class TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_students_id_card ON students(id_card);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class);

-- 3. ตาราง Classes (ห้องเรียน)
CREATE TABLE IF NOT EXISTS classes (
  id BIGSERIAL PRIMARY KEY,
  class_name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ตาราง Payments (รายการชำระ)
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  trans_id TEXT UNIQUE NOT NULL,
  id_card TEXT NOT NULL,
  year TEXT,
  term TEXT,
  amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'รอชำระ',  -- รอชำระ, กำลังตรวจสอบ, ชำระแล้ว, ชำระไม่สำเร็จ
  slip_url TEXT,
  payer_name TEXT,
  reason TEXT,
  title TEXT,
  doc_url TEXT,
  ref1 TEXT,
  ref2 TEXT,
  batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_id_card ON payments(id_card);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_batch_id ON payments(batch_id);
CREATE INDEX IF NOT EXISTS idx_payments_year_term ON payments(year, term);

-- 5. ตาราง BillingHistory (ประวัติการออกบิล)
CREATE TABLE IF NOT EXISTS billing_history (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT,
  admin_name TEXT,
  year TEXT,
  term TEXT,
  target TEXT,
  count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. ตาราง Settings (การตั้งค่าระบบ)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ค่าเริ่มต้น
INSERT INTO settings (key, value, description) VALUES
  ('SYSTEM_STATUS', 'ON', 'สถานะระบบ ON/OFF'),
  ('CLOSED_MESSAGE', 'ระบบปิดให้บริการชั่วคราว กรุณาติดต่อเจ้าหน้าที่', 'ข้อความตอนระบบปิด'),
  ('TAX_ID', '', 'เลขประจำตัวผู้เสียภาษี 13 หลัก'),
  ('BILLER_SUFFIX', '00', 'Suffix 2 หลักท้าย Biller ID'),
  ('SCHOOL_NAME', 'โรงเรียน', 'ชื่อโรงเรียน'),
  ('LOGO_URL', '', 'URL รูปโลโก้')
ON CONFLICT (key) DO NOTHING;

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON payments;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ════════════════════════════════════════════════════════════
-- RLS Policies (Row Level Security)
-- ปิดไว้เพราะเราใช้ service_role key ใน backend
-- ════════════════════════════════════════════════════════════
ALTER TABLE admins         DISABLE ROW LEVEL SECURITY;
ALTER TABLE students       DISABLE ROW LEVEL SECURITY;
ALTER TABLE classes        DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments       DISABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings       DISABLE ROW LEVEL SECURITY;
