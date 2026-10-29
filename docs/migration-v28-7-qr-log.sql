-- ════════════════════════════════════════════════════════════════
-- Migration v28.7: เก็บประวัติการเปิด QR ทุกครั้ง (JSONB array)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS qr_open_log JSONB DEFAULT '[]'::jsonb;
-- เก็บ array ของ timestamp ทุกครั้งที่เปิด QR
-- เช่น: ["2026-05-27T08:30:00Z", "2026-05-27T09:15:00Z", ...]

COMMENT ON COLUMN payments.qr_open_log IS 'ประวัติเวลาทุกครั้งที่เปิด QR (JSONB array of ISO timestamps)';
