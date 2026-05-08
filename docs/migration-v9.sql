-- ════════════════════════════════════════════════════════════
-- School Payment System - Migration v9
-- เพิ่มตาราง inquiries สำหรับ chatbot
-- รันใน Supabase SQL Editor (รันได้หลายครั้ง ปลอดภัย)
-- ════════════════════════════════════════════════════════════

-- ตาราง Inquiries (คำถามจาก chatbot ที่ตอบไม่ได้ ส่งมาที่ admin)
CREATE TABLE IF NOT EXISTS inquiries (
  id BIGSERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  id_card TEXT,
  contact TEXT,
  lang TEXT DEFAULT 'th',
  status TEXT DEFAULT 'pending', -- pending / resolved
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at DESC);

ALTER TABLE inquiries DISABLE ROW LEVEL SECURITY;

-- เพิ่ม settings ใหม่ (contact info)
INSERT INTO settings (key, value, description) VALUES
  ('CONTACT_PHONE', '', 'เบอร์ติดต่อโรงเรียน'),
  ('CONTACT_LINE',  '', 'LINE ID ของโรงเรียน'),
  ('CONTACT_EMAIL', '', 'อีเมลติดต่อโรงเรียน')
ON CONFLICT (key) DO NOTHING;
