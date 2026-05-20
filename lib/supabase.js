// lib/supabase.js - Supabase client (ใช้ใน API)
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in env');
}

// ใช้ service_role key เพื่อข้าม RLS (เรา validate เองที่ backend)
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false }
});

module.exports = supabase;
