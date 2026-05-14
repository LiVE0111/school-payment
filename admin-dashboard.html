-- ════════════════════════════════════════════════════════════
-- School Payment System - Migration v12 (Phase A)
-- เพิ่ม: receipts table, activity_logs
-- รันใน Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- 1. เพิ่ม columns ใน payments สำหรับ receipt
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_no TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_issued_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payments_receipt_no ON payments(receipt_no) WHERE receipt_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status_year_term ON payments(status, year, term);

-- 2. ตารางเลขที่ใบเสร็จล่าสุด (สำหรับ generate running number)
CREATE TABLE IF NOT EXISTS receipt_counter (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_number INTEGER NOT NULL DEFAULT 0,
  year_prefix TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO receipt_counter (id, current_number, year_prefix)
VALUES (1, 0, EXTRACT(YEAR FROM CURRENT_DATE)::TEXT)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE receipt_counter DISABLE ROW LEVEL SECURITY;

-- 3. Activity logs (audit trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_username TEXT,
  action TEXT NOT NULL,        -- 'approve', 'reject', 'bulk_approve', 'export', etc.
  target_type TEXT,            -- 'payment', 'student', 'settings', 'admin'
  target_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_admin ON activity_logs(admin_username);

ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
