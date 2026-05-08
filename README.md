# 🏫 ระบบชำระค่าบำรุงการศึกษา (School Payment System)

ระบบใหม่ทดแทน Google Apps Script รองรับผู้ใช้ 1,000+ คนพร้อมกัน

## 🎯 สถาปัตยกรรม

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Browser   │ ───▶ │    Vercel    │ ───▶ │   Supabase   │
│  (มือถือ)    │      │  (Frontend + │      │  PostgreSQL  │
└─────────────┘      │  Serverless) │      │  + Storage   │
                     └──────────────┘      └──────────────┘
```

- **Frontend:** HTML/CSS/JS ธรรมดา (เหมือนเดิม) บน **Vercel** (ฟรี)
- **Backend API:** Vercel Serverless Functions (Node.js) — ฟรี 100GB-hour/เดือน
- **Database:** **Supabase PostgreSQL** — ฟรี 500MB
- **Storage (สลิป):** **Supabase Storage** — ฟรี 1GB
- **Auth Admin:** เก็บใน DB + bcrypt hash

## 📋 ขั้นตอนติดตั้ง (ใช้เวลา ~30 นาที)

### 1. สร้างบัญชี Supabase (ฟรี)

1. ไปที่ https://supabase.com → Sign in with GitHub
2. คลิก **New Project**
3. ตั้งชื่อ project เช่น `school-payment`
4. ตั้ง Database Password (จดไว้)
5. เลือก Region: **Southeast Asia (Singapore)**
6. รอ ~2 นาที

### 2. สร้างตารางใน Supabase

1. คลิก **SQL Editor** ทางซ้าย
2. คลิก **New query**
3. คัดลอกเนื้อหาจากไฟล์ `docs/schema.sql` ไปวาง
4. คลิก **Run**

### 3. สร้าง Storage Bucket สำหรับสลิป

1. คลิก **Storage** ทางซ้าย
2. คลิก **New bucket** ตั้งชื่อ `slips` ติ๊ก **Public bucket**
3. คลิก **Save**

### 4. หา API Keys

1. คลิก **Settings** → **API**
2. คัดลอก:
   - `Project URL` (เช่น `https://xxx.supabase.co`)
   - `anon public` key (สำหรับ frontend)
   - `service_role` key (สำหรับ backend - **อย่าเปิดเผย!**)

### 5. สร้างบัญชี GitHub (ถ้ายังไม่มี) และ Vercel

1. ไปที่ https://github.com → Sign up
2. สร้าง repo ใหม่ (ชื่ออะไรก็ได้) **Private**
3. อัปโหลดโฟลเดอร์โปรเจกต์นี้ทั้งหมด
4. ไปที่ https://vercel.com → Sign in with GitHub
5. คลิก **Add New Project** → Import repo ที่เพิ่งสร้าง

### 6. ตั้งค่า Environment Variables ใน Vercel

ใน Vercel Project Settings → **Environment Variables** เพิ่ม:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL จากข้อ 4 |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_KEY` | service_role key |
| `JWT_SECRET` | สุ่มขึ้นมา 32 ตัวอักษร เช่น `my-super-secret-key-2024-xxx` |

จากนั้น **Redeploy** (Deployments → คลิกจุด 3 จุด → Redeploy)

### 7. สร้าง Admin คนแรก

1. ไปที่ Supabase → **SQL Editor**
2. รัน:
```sql
-- รหัสผ่าน "admin1234" ที่ผ่านการ hash แล้ว
INSERT INTO admins (username, password_hash, name, role)
VALUES ('admin', '$2b$10$rXJh6E7vPKpQ2N4yFVxPXuYQpHJM9vL6kHcZwWqMxJpLnTcGpF8FW', 'Super Admin', 'superadmin');
```

### 8. เสร็จสิ้น!

เปิด URL จาก Vercel เช่น `https://your-project.vercel.app`

- หน้าผู้ปกครอง: `/`
- หน้า Admin: `/admin`
- บัญชีเริ่มต้น: `admin` / `admin1234` (**กรุณาเปลี่ยนรหัสผ่านทันที**)

## 🔧 ตั้งค่าเพิ่มเติม

ใน Admin Dashboard → **ตั้งค่าระบบ**:
- กรอก Tax ID (เลข 13 หลัก) สำหรับ QR PromptPay นิติบุคคล
- กรอกชื่อโรงเรียน
- กรอก Logo URL

## 🆚 เปรียบเทียบกับ Google Apps Script

| หัวข้อ | Google Apps Script | ระบบใหม่ |
|---|---|---|
| ผู้ใช้พร้อมกัน | ~50 คน | 1,000+ คน |
| ความเร็ว | ช้า (1-3 วินาที/request) | เร็ว (<200ms) |
| Storage | Drive (จำกัด) | Supabase 1GB ฟรี |
| Quota | จำกัด/วัน | ไม่จำกัด (ใน free tier) |
| ราคา | ฟรี | ฟรี (ในขีดจำกัด) |
