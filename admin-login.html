-- ════════════════════════════════════════════════════════════
-- School Payment System - Migration v13
-- 1. รองรับ flexible ID (G-code, TEMP) สำหรับนักเรียนยังไม่มีบัตร
-- 2. Late enrollment (ย้ายเข้ากลางเทอม)
-- 3. Performance indexes สำหรับ 1500+ records
-- ════════════════════════════════════════════════════════════

-- ── 1. Students: รองรับสถานะและ late enrollment ──
ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
-- 'active' / 'pending_id' (รอบัตร) / 'transferred_in' / 'transferred_out' / 'graduated'

ALTER TABLE students ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE students ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class);
CREATE INDEX IF NOT EXISTS idx_students_name_trgm ON students USING gin(name gin_trgm_ops);

-- ⚠️ ติดตั้ง pg_trgm extension ก่อน (ใน Supabase ติดตั้งให้แล้ว)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 2. Payments: เพิ่ม bill_type + indexes ──
ALTER TABLE payments ADD COLUMN IF NOT EXISTS bill_type TEXT DEFAULT 'batch';
-- 'batch' (ออกหมู่) / 'individual' (รายบุคคล) / 'late_enrollment' (ย้ายเข้า)

CREATE INDEX IF NOT EXISTS idx_payments_bill_type ON payments(bill_type);
CREATE INDEX IF NOT EXISTS idx_payments_id_card_status ON payments(id_card, status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_year_term ON payments(year, term);

-- ── 3. Storage tracking ──
CREATE TABLE IF NOT EXISTS storage_stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_db_size BIGINT DEFAULT 0,
  total_storage_size BIGINT DEFAULT 0,
  total_slip_count INTEGER DEFAULT 0,
  total_payment_rows INTEGER DEFAULT 0,
  total_student_rows INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row_storage CHECK (id = 1)
);

INSERT INTO storage_stats (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE storage_stats DISABLE ROW LEVEL SECURITY;

-- ── 4. Function: get database size ──
CREATE OR REPLACE FUNCTION get_db_stats()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT,
  total_size_bytes BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname || '.' || relname AS table_name,
    n_live_tup AS row_count,
    pg_total_relation_size(schemaname || '.' || relname) AS total_size_bytes
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname || '.' || relname) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_db_stats() TO anon, authenticated, service_role;
