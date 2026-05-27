-- ════════════════════════════════════════════════════════════════
-- Migration v28: QR Tracking + Transfer Time
-- ════════════════════════════════════════════════════════════════
-- รัน SQL นี้ใน Supabase SQL Editor ก่อน deploy
-- ════════════════════════════════════════════════════════════════

-- 1. เก็บวันเวลาที่ผู้ปกครองโอนจริง (กรอกตอนอัปสลิป)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS transfer_at TIMESTAMPTZ;
COMMENT ON COLUMN payments.transfer_at IS 'วันเวลาที่ผู้ปกครองโอนเงินจริง (จากสลิป)';

-- 2. เก็บประวัติการเปิด QR (สำหรับติดตามว่า "เปิด QR แล้วแต่ยังไม่อัปสลิป")
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS qr_opened_at TIMESTAMPTZ,        -- ครั้งแรกที่กดดู QR
  ADD COLUMN IF NOT EXISTS qr_last_opened_at TIMESTAMPTZ,   -- ครั้งล่าสุดที่กดดู QR
  ADD COLUMN IF NOT EXISTS qr_open_count INTEGER DEFAULT 0; -- จำนวนครั้งที่กดดู

COMMENT ON COLUMN payments.qr_opened_at IS 'วันเวลาที่ผู้ปกครองกดดู QR ครั้งแรก';
COMMENT ON COLUMN payments.qr_last_opened_at IS 'วันเวลาที่ผู้ปกครองกดดู QR ครั้งล่าสุด';
COMMENT ON COLUMN payments.qr_open_count IS 'นับจำนวนครั้งที่ผู้ปกครองเปิด QR';

-- 3. Index สำหรับการค้นหา
CREATE INDEX IF NOT EXISTS idx_payments_transfer_at ON payments(transfer_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_qr_opened ON payments(qr_last_opened_at DESC) WHERE qr_open_count > 0;

-- ════════════════════════════════════════════════════════════════
-- ตรวจสอบหลังรัน:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'payments' AND column_name LIKE '%qr%' OR column_name = 'transfer_at';
-- ════════════════════════════════════════════════════════════════
