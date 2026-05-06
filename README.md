# 📚 คู่มือเทคนิค — School Payment System

> **Version 10** • พฤษภาคม 2026
> ระบบชำระค่าบำรุงการศึกษา รองรับผู้ใช้ 1,000+ คน

---

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [สถาปัตยกรรม](#2-สถาปัตยกรรม)
3. [การไหลของข้อมูล](#3-การไหลของข้อมูล)
4. [ฐานข้อมูล](#4-ฐานข้อมูล)
5. [API Endpoints](#5-api-endpoints)
6. [ความปลอดภัย](#6-ความปลอดภัย)
7. [ขีดจำกัดและการขยายระบบ](#7-ขีดจำกัด)
8. [การสำรองและกู้คืนข้อมูล](#8-backup)
9. [การแก้ไขปัญหา](#9-troubleshooting)
10. [สรุปและคำแนะนำ](#10-สรุป)

---

## 1. ภาพรวมระบบ

ระบบรับชำระค่าบำรุงการศึกษาออนไลน์ ทดแทน Google Apps Script ที่มีข้อจำกัดเรื่อง quota และความเร็ว

### Stack ที่ใช้

| ชั้น | เทคโนโลยี | Free Tier |
|---|---|---|
| Frontend | HTML, CSS, JavaScript (Vanilla) | N/A |
| Hosting / Serverless | Vercel | 100GB-hour/เดือน |
| Database | Supabase PostgreSQL | 500MB |
| File Storage | Supabase Storage | 1GB |
| Authentication | JWT + bcrypt | — |

### คุณสมบัติหลัก

- 👨‍👩‍👧‍👦 **ผู้ปกครอง:** ค้นหาด้วยเลขบัตร 13 หลัก, สแกน QR, อัปสลิป
- 🛡️ **Admin:** ดู/อนุมัติ/ปฏิเสธ, ออกบิล, จัดการนักเรียน-ห้อง
- 👑 **Super Admin:** เพิ่ม/ลบ admin คนอื่น
- 🤖 **Chatbot:** FAQ Bot 2 ภาษา (ไทย/อังกฤษ)

---

## 2. สถาปัตยกรรม

```
┌─────────────┐   HTTPS    ┌──────────────────┐
│   Browser   │ ─────────▶ │     Vercel        │
│ (มือถือ/PC) │            │  • Static HTML/JS │
└─────────────┘            │  • Serverless API │
       │                   └────────┬──────────┘
       │ Direct upload              │ SQL/REST
       │ (สลิปเท่านั้น)             │
       ▼                            ▼
┌──────────────────────────────────────────────┐
│             Supabase Cloud                    │
│  • PostgreSQL Database (7 tables)            │
│  • Storage Bucket "slips"                    │
└──────────────────────────────────────────────┘
```

### บทบาทของแต่ละส่วน

**Browser**
- โหลดไฟล์ HTML/CSS/JS จาก Vercel
- สร้าง QR Code (EMV format) ฝั่ง client
- อัปโหลดสลิป**ตรง**ไปยัง Supabase Storage (ลดภาระ Vercel)

**Vercel**
- Static Hosting + Serverless Functions
- API endpoints ที่ /api/* (12 functions)
- CDN ระดับโลก, auto-deploy จาก GitHub

**Supabase**
- PostgreSQL Database 7 ตาราง
- Storage Bucket "slips"
- REST API อัตโนมัติ (PostgREST)

### เปรียบเทียบกับ Google Apps Script

| คุณสมบัติ | GAS เดิม | Stack ใหม่ |
|---|---|---|
| ผู้ใช้พร้อมกัน | ~50 คน | 1,000+ คน |
| ความเร็ว | 1-3 วินาที | <200ms |
| Quota รายวัน | จำกัด | แทบไม่จำกัด |
| ราคา | ฟรี | ฟรี |

---

## 3. การไหลของข้อมูล

### 3.1 การค้นหานักเรียน

```
Browser              Vercel API           Supabase
   │                    │                     │
   │── search 13-digit ─▶│                    │
   │                    │── SELECT students ─▶│
   │                    │◀── student data ────│
   │                    │── SELECT payments ─▶│
   │                    │◀── payments[] ──────│
   │                    │── SELECT settings ─▶│
   │                    │◀── settings ────────│
   │◀── JSON response ──│                     │
   │ (สร้าง QR ฝั่ง Browser)                  │
```

**ขั้นตอน:**
1. Browser ตรวจ format: ตัวเลข 13 หลักเท่านั้น
2. ส่ง GET `/api/student/search?idCard=XXX`
3. Vercel เรียก Function → Query 3 ตาราง
4. คืน JSON: `{found, student, payments, taxId, billerSuffix}`
5. Browser สร้าง QR Code ฝั่ง client

### 3.2 การชำระเงินและอัปโหลดสลิป

**สร้าง QR Code (EMV Format)**
1. อ่าน `taxId, billerSuffix, ref1, ref2, amount` จาก response
2. สร้าง EMV Payload ตามมาตรฐาน Bank of Thailand
   - Tag 30 = Bill Payment
   - Tag 29 = PromptPay (นิติบุคคล)
3. คำนวณ CRC16-CCITT checksum
4. ใช้ qrcode-generator สร้าง SVG

**อัปโหลดสลิป**
1. ผู้ปกครองสแกน QR + โอนเงิน
2. กดปุ่ม "แจ้งโอนเงิน" → กรอกชื่อ + เลือกไฟล์
3. ตรวจขนาดไฟล์ (max 5MB)
4. POST **ตรง** ไป Supabase Storage `/storage/v1/object/slips/<filename>`
5. ใช้ anon key เป็น Authorization
6. POST `/api/payment/upload-slip` ส่ง URL ที่ได้
7. API บันทึก `status="กำลังตรวจสอบ"`, `slip_url`, `payer_name`

> ⚠️ **ทำไมอัปสลิปตรงไม่ผ่าน Vercel?**
> เพื่อลด Bandwidth ของ Vercel (Free tier 100GB/เดือน) — Vercel แค่บันทึก URL ไม่ต้องรับไฟล์จริง

### 3.3 การเข้าสู่ระบบของ Admin (JWT)

```
Browser → POST /api/auth?action=login + {username, password}
       ← Vercel
            ├─ SELECT admins WHERE username=?
            ├─ bcrypt.compare(password, password_hash)
            ├─ jwt.sign({id, username, role}, JWT_SECRET, {expiresIn: '8h'})
            └─ Return {token, name, role, username}

Browser → localStorage.setItem('adminToken', token)
       → ทุก request ต่อไป: Authorization: Bearer <token>
```

> ✅ **ความปลอดภัย:**
> - Password เก็บเป็น bcrypt hash (cost 10)
> - ไม่มี plain text ในระบบเลย
> - Token expire 8 ชั่วโมง

### 3.4 การออกบิลใหม่ (Admin)

ใช้ทรัพยากรมากที่สุด — อาจสร้าง 1,000 records ในครั้งเดียว

1. Admin POST `/api/admin/create-bill` พร้อม `targetClasses[]`
2. Query students ที่อยู่ในห้องที่เลือก
3. สร้าง `batch_id = "B" + timestamp`
4. คำนวณ ref1, ref2 สำหรับแต่ละคน
5. **Insert แบบ chunk ละ 500** records (Supabase limit)
6. บันทึก billing_history

> ⚠️ การ chunk ป้องกัน timeout ของ Vercel Function (max 10 วินาที)

### 3.5 Chatbot Flow

1. ผู้ปกครองพิมพ์ → keyword matching หา intent
2. ถ้า intent = "ค่าเทอม" → ขอเลขบัตร → query `/api/student/search`
3. ถ้า intent ทั่วไป → ตอบจาก script
4. ถ้าไม่ match → ถาม "ส่งให้ admin?"
5. ถ้าตกลง → POST `/api/settings?action=ask` → บันทึกใน `inquiries`
6. Admin เห็นในแท็บ "คำถาม" + badge แสดงจำนวน

---

## 4. ฐานข้อมูล

### Schema 7 ตาราง

```
admins                    settings
  id (PK)                   key (PK)
  username (unique)         value
  password_hash             description
  role
  
classes                   inquiries
  class_name (unique)       id (PK)
                            question
students                    id_card, contact
  id_card (unique) ◀──┐   status
  student_id          │   
  name                │   
  class               │   
                      │   
payments              │   
  trans_id (unique)   │   
  id_card ────────────┘   (FK ที่ระดับ logic)
  year, term, amount      
  status, slip_url, ref1, ref2
  batch_id ──────────┐
                     │
billing_history      │
  batch_id ──────────┘
  admin_name, count
```

### ตาราง admins

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| id | BIGSERIAL | PK |
| username | TEXT UNIQUE | ใช้ login |
| password_hash | TEXT | bcrypt ($2a$10$...) |
| name | TEXT | ชื่อแสดง |
| role | TEXT | admin / superadmin |
| created_at | TIMESTAMPTZ | |

### ตาราง payments

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| trans_id | TEXT UNIQUE | T + timestamp + index |
| id_card | TEXT | เชื่อมกับ students |
| year, term | TEXT | |
| amount | NUMERIC | |
| status | TEXT | รอชำระ/กำลังตรวจสอบ/ชำระแล้ว/ชำระไม่สำเร็จ |
| slip_url | TEXT | URL สลิป |
| ref1, ref2 | TEXT | สำหรับ Bill Payment |
| batch_id | TEXT | เชื่อม billing_history |

### ตาราง settings (key-value)

| Key | ใช้ที่ไหน |
|---|---|
| SYSTEM_STATUS | เปิด/ปิดระบบ (ON/OFF) |
| TAX_ID | Tax ID 13 หลัก |
| BILLER_SUFFIX | Suffix Bill Payment |
| SCHOOL_NAME | ชื่อโรงเรียน |
| LOGO_URL | URL โลโก้ |
| ANNOUNCEMENT | ประกาศ |
| ANNOUNCEMENT_ON | เปิด/ปิดประกาศ |
| CONTACT_PHONE/LINE/EMAIL | ติดต่อ (chatbot) |

---

## 5. API Endpoints

12 endpoints (ใต้ขีดจำกัด Vercel Hobby)

### สาธารณะ (ไม่ต้อง login)

| Method | Path | รายละเอียด |
|---|---|---|
| GET | `/api/settings` | settings สาธารณะ |
| GET | `/api/student/search?idCard=X` | ค้นหานักเรียน |
| POST | `/api/payment/upload-slip` | บันทึก URL สลิป |
| GET | `/api/admin/classes` | รายการห้อง |
| POST | `/api/auth?action=login` | Admin login |
| POST | `/api/settings?action=ask` | ส่งคำถาม chatbot |

### ต้อง Login (มี JWT)

| Method | Path | รายละเอียด |
|---|---|---|
| GET | `/api/admin/payments` | รายการชำระ + filter |
| POST | `/api/admin/payment-action` | อนุมัติ/ปฏิเสธ |
| GET/POST/DEL | `/api/admin/students` | จัดการนักเรียน |
| GET/POST/DEL | `/api/admin/classes` | จัดการห้อง |
| POST | `/api/admin/create-bill` | ออกบิลครั้งละมาก |
| GET/POST | `/api/admin/billing-history` | ประวัติ |
| GET | `/api/admin/stats` | สรุปยอด |
| POST | `/api/auth?action=change-password` | เปลี่ยนรหัส |
| POST | `/api/settings` | บันทึก settings |
| GET/POST | `/api/settings?action=inquiries` | ดู/อัปเดตคำถาม |

### Super Admin เท่านั้น

| Method | Path | รายละเอียด |
|---|---|---|
| GET/POST/DEL | `/api/admin/manage-admins` | จัดการ admin |

### ตัวอย่าง

**Login**
```http
POST /api/auth?action=login
Content-Type: application/json

{ "username": "admin", "password": "secret123" }
```

```json
{
  "success": true,
  "token": "eyJhbGciOi...",
  "name": "Super Admin",
  "role": "superadmin"
}
```

**ค้นหานักเรียน**
```http
GET /api/student/search?idCard=1234567890123
```

```json
{
  "success": true,
  "found": true,
  "student": { "name": "...", "class": "ม.1/1" },
  "payments": [{ "transId": "...", "amount": 2500 }]
}
```

---

## 6. ความปลอดภัย

ระบบใช้หลัก **Defense in Depth** — ป้องกันหลายชั้น

### 6.1 การจัดเก็บรหัสผ่าน

- ✅ ทุก password เก็บเป็น **bcrypt hash** (cost 10)
- ✅ ไม่มี plain text ใน DB / logs / env vars
- ✅ ใช้ `bcrypt.compare()` ทนต่อ timing attack
- ✅ ทุก hash ใช้ salt แตกต่าง — แม้รหัสเดียวกัน hash ไม่เหมือน

ตัวอย่าง: `$2a$10$5NIO6W/NW9bJhB0deMAtpucP0tooJtQibQriH2iXzC4xtW3Jt3HeO`

### 6.2 JWT Authentication

- Token expire 8 ชั่วโมง
- ลายเซ็น HMAC-SHA256 ด้วย JWT_SECRET (เก็บใน Vercel env)
- ไม่เก็บข้อมูลลับใน payload (แค่ id, username, role)
- ทุก API ที่ต้องสิทธิ์เรียก `requireAdmin(req)` ก่อนทำงาน

### 6.3 Service Role Key vs Anon Key

| Key | ที่เก็บ | อำนาจ | ใช้ทำอะไร |
|---|---|---|---|
| **Anon Key** | Frontend (เปิดเผยได้) | จำกัดตาม RLS policy | อัปสลิปไป Storage |
| **Service Role Key** | Vercel env (ลับ!) | ข้าม RLS ทุกอย่าง | API ทุกตัว |

> 🚨 **Service Role Key มีอำนาจสูงสุด** ห้ามแชร์ ห้าม commit เข้า GitHub

### 6.4 Storage Policy

Bucket "slips" เป็น **Public** แต่การอัปโหลดถูกควบคุมด้วย:

```sql
CREATE POLICY "Allow anonymous uploads to slips"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'slips');
```

> ⚠️ Public bucket = ใครรู้ URL เปิดดูได้ → ถ้ากังวลเรื่อง privacy ควรเปลี่ยนเป็น Private + signed URL

### 6.5 Input Validation

- ทุก API ตรวจ input ก่อนใช้
- Supabase client ใช้ parameterized query (กัน SQL injection)
- Frontend ตรวจ ID card 13 หลัก
- จำกัดสลิป 5MB (กัน DoS)

### 6.6 HTTPS

- ทุกการเชื่อมต่อเป็น HTTPS (TLS 1.3)
- Vercel จัดให้อัตโนมัติ
- Token ระหว่างทางถูกเข้ารหัสตลอด

### 6.7 จุดที่ต้องระวัง

⚠️ **Browser Console:** ใครเปิด DevTools เห็น API call → ทุก API ต้อง validate ฝั่ง server

⚠️ **localStorage Token:** ถ้ามี XSS ในเว็บ Token ถูกขโมย → ห้ามแสดง user-generated content โดยไม่ escape

⚠️ **URL ของสลิป:** เปิดได้สาธารณะ → ถ้าข้อมูลสำคัญ พิจารณา private bucket

🚨 **Supabase RLS ปิดอยู่:** ถ้าใครได้ Service Role Key = เข้าได้ทั้งหมด

### 6.8 Best Practices

- ✅ เปลี่ยน password admin ครั้งแรกที่ใช้
- ✅ ห้ามแชร์ username/password
- ✅ Backup DB สม่ำเสมอ
- ✅ ตรวจ inquiries ทุกวัน
- ✅ ลบ admin ที่ไม่ใช้แล้ว
- ✅ JWT_SECRET ห้ามเปลี่ยนถ้าไม่จำเป็น

---

## 7. ขีดจำกัด

### Free Tier Limits

| ทรัพยากร | Free | รองรับ 1,000 คน? |
|---|---|---|
| Vercel Functions | 100GB-hour/เดือน | ✅ ใช้สบาย |
| Vercel Bandwidth | 100GB/เดือน | ✅ ใช้สบาย |
| Vercel Functions Limit | 12 functions | ⚠️ ใกล้เต็ม |
| Supabase DB | 500MB | ✅ 100,000+ บิล |
| Supabase Storage | 1GB | ✅ ~5,000 สลิป |
| Supabase Bandwidth | 5GB/เดือน | ✅ |
| Active Users | 50,000 MAU | ✅ |

### เมื่อไหร่ควรอัปเกรด

- 💾 **Storage 1GB เต็ม** → ลบสลิปเก่า หรือ Supabase Pro ($25/เดือน, 100GB)
- 🗃️ **DB 500MB เต็ม** → ลบ payments เก่ากว่า 3 ปี หรือ Pro
- ⚙️ **Functions เกิน 12** → รวม endpoint หรือ Vercel Pro

### การขยายในอนาคต

- 🏫 **Multi-school:** เพิ่ม `school_id` ในทุกตาราง
- 📲 **LINE Notify:** แจ้งเตือนตอนอัปสลิปใหม่
- 📧 **Email อัตโนมัติ:** EmailJS / Resend
- 📱 **Mobile App:** React Native / Flutter ใช้ API เดียวกัน
- 🤖 **AI Bot:** Gemini / Claude API
- 👁️ **OCR สลิป:** Google Cloud Vision / Easy Slip API

---

## 8. Backup

Supabase Free มี backup รายวัน 7 วัน (อัตโนมัติ) แต่ควรทำ manual เพิ่ม

### Method 1: Export CSV (ง่ายสุด)

1. Supabase → Table Editor
2. คลิกตาราง → Export → CSV
3. ทำกับ: students, payments, billing_history, classes, settings, admins, inquiries

### Method 2: pg_dump

```bash
# Settings → Database → Connection string
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql
```

### Method 3: Schedule Backup

ใช้ Vercel Cron Job (ฟรี 1 cron/project) export JSON → Google Drive

### Restore

**จาก CSV:**
1. Table Editor → ตาราง
2. Insert → Import CSV → Map columns

**จาก SQL dump:**
```bash
psql "postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres" < backup.sql
```

### สำรองสลิป

- Storage ไม่มี auto-backup
- Download zip ของ bucket ทุกเดือน
- Storage → bucket slips → Select all → Download

---

## 9. Troubleshooting

### ปัญหาทั่วไป

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| Login ไม่ผ่าน | password hash ไม่ตรง / SUPABASE_URL ผิด | ตรวจ env vars + รัน setup ใหม่ |
| QR Code ไม่ขึ้น | Tax ID ไม่ครบ 13 หลัก / Library load ไม่ทัน | ตรวจ settings + รีเฟรช |
| อัปสลิปไม่ได้ | Storage Policy ขาด / SUPABASE_URL ผิด | รัน CREATE POLICY + ตรวจ app.js |
| Deploy fail "12 functions" | API เกิน 12 ไฟล์ | รวม endpoint ด้วย query param |
| "Invalid path" error | SUPABASE_URL มี /rest/v1/ ติดมา | แก้เหลือแค่ https://xxx.supabase.co |
| ออกบิล timeout | นักเรียนเยอะเกิน | ปรับ CHUNK_SIZE |
| Token หมดอายุบ่อย | JWT expire 8 ชม. | แก้ใน lib/auth.js |

### Debug Tools

**Vercel Logs**
- Dashboard → Project → Logs
- Functions tab: เห็น error API ทุกตัว

**Supabase Logs**
- Logs → API/Database/Storage
- เห็น query ทุกตัว

**Browser**
- F12 → Console: error JavaScript
- Network: ดู request/response
- Application → Local Storage: ดู Token

---

## 10. สรุป

### จุดแข็ง

- 💰 ฟรี 100% ตราบใดที่ไม่เกิน free tier
- 🚀 รองรับ 1,000+ ผู้ใช้พร้อมกัน
- 🔒 ปลอดภัย: bcrypt + JWT + HTTPS
- 📱 Mobile-first design
- 🔄 Auto-deploy จาก GitHub
- 💾 Backup ง่ายผ่าน CSV
- 🤖 Chatbot ฟรี ตอบ FAQ พื้นฐาน

### ข้อจำกัด

- ⚠️ Free tier มีขีดจำกัด (เพียงพอสำหรับโรงเรียนทั่วไป)
- ⚠️ ไม่มี email/SMS แจ้งเตือนอัตโนมัติ
- ⚠️ สลิปเป็น public URL
- ⚠️ ไม่มี OCR อ่านสลิปอัตโนมัติ

### คำแนะนำการใช้งาน

1. ✅ ตั้งค่าให้ครบหลัง deploy (Tax ID, Suffix, ชื่อโรงเรียน, ติดต่อ)
2. ✅ สร้าง admin หลายคน (1 superadmin + admin ปกติ)
3. ✅ Backup CSV ทุกสิ้นเทอม
4. ✅ ตรวจคำถาม chatbot สัปดาห์ละครั้ง
5. ✅ ลบสลิปเก่าทุกปีการศึกษา (Backup ก่อน)

---

*— จบเอกสาร —*
