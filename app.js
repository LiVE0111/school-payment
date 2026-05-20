// public/app.js - shared frontend helpers
//
// แก้ค่าตรงนี้ → ใส่ Supabase Project URL + anon key
// (ANON KEY ปลอดภัย ใช้บน frontend ได้ เพราะถูก lock ด้วย RLS/policy)
//
// ⚠️ สำคัญ: ก่อน deploy แก้ค่าด้านล่างให้ตรงกับ project ของคุณ
window.SUPABASE_URL  = window.SUPABASE_URL  || 'https://fpeizvycjwfqnccapnuu.supabase.co';
window.SUPABASE_ANON = window.SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWl6dnljandmcW5jY2FwbnV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDM0MjAsImV4cCI6MjA5MzQxOTQyMH0.IoGs7Zcz23BkRoIlFsZ6GJ0o3Z890c2RI58_pZ3ys58';

// Sanitize URL: ลบ trailing slash + path ที่ไม่ควรมี
(function () {
  let u = String(window.SUPABASE_URL || '').trim();
  // ลบส่วน /rest/v1 หรือ /storage/v1 ที่อาจติดมา
  u = u.replace(/\/rest\/v1\/?$/i, '').replace(/\/storage\/v1\/?$/i, '');
  // ลบ slash ท้าย
  u = u.replace(/\/+$/, '');
  window.SUPABASE_URL = u;
})();

// ──────────────────────────────────────────────────────────
// API helper - เรียก /api/... endpoints
// ──────────────────────────────────────────────────────────
async function api(path, opts) {
  opts = opts || {};
  const token = localStorage.getItem('adminToken');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const url = '/api' + path;
  let res;
  try {
    res = await fetch(url, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  } catch (e) {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + e.message);
  }

  let data;
  try { data = await res.json(); } catch (e) { data = {}; }

  if (!res.ok || data.success === false) {
    throw new Error(data.error || ('HTTP ' + res.status));
  }
  return data;
}

// ──────────────────────────────────────────────────────────
// Upload สลิปไป Supabase Storage โดยตรง
// ──────────────────────────────────────────────────────────
async function uploadSlipToStorage(file, transId) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeExt = ext || 'jpg';
  const bucket = 'slips';
  // ชื่อไฟล์ - ห้ามมีอักขระพิเศษ ใช้แค่ ตัวอักษร ตัวเลข _ . -
  const safeTransId = String(transId).replace(/[^a-zA-Z0-9]/g, '');
  const fileName = safeTransId + '_' + Date.now() + '.' + safeExt;
  const url = window.SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + fileName;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + window.SUPABASE_ANON,
      'apikey': window.SUPABASE_ANON,
      'Content-Type': file.type || 'image/jpeg',
      'x-upsert': 'true'
    },
    body: file
  });

  if (!res.ok) {
    let errMsg = 'HTTP ' + res.status;
    try {
      const errJson = await res.json();
      errMsg = errJson.message || errJson.error || JSON.stringify(errJson);
    } catch (_) {
      try { errMsg = await res.text(); } catch (_) {}
    }
    throw new Error('อัปโหลดไม่สำเร็จ: ' + errMsg);
  }

  // คืนค่า public URL
  return window.SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + fileName;
}

// ──────────────────────────────────────────────────────────
// Logout (admin)
// ──────────────────────────────────────────────────────────
function adminLogout() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminName');
  localStorage.removeItem('adminRole');
  localStorage.removeItem('adminUsername');
  window.location.href = '/admin';
}

// expose
window.api = api;
window.uploadSlipToStorage = uploadSlipToStorage;
window.adminLogout = adminLogout;
