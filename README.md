# SocialBank — คลังข้อสอบสังคมศึกษา ครูน็อค

ระบบจัดการคลังข้อสอบและออกชุดข้อสอบสอบเข้า ม.1 วิชาสังคมศึกษา สำหรับติวเตอร์คนเดียว
(React + TypeScript + Tailwind CSS + Supabase)

## สิ่งที่มีในโปรเจกต์นี้

- **หน้าแดชบอร์ด**: การ์ดสรุป, Master Heatmap (สาระ × โรงเรียน), Top 15 หัวข้อย่อย, เทรนด์รายปี
- **คลังข้อสอบ**: ตาราง filter/search/pagination, เพิ่ม/แก้ไข/ลบ, อัปโหลด/วางรูปภาพ
- **นำเข้าข้อมูล**: วาง/อัปโหลด TSV, ตรวจสอบและไฮไลต์ปัญหาก่อนนำเข้าจริง
- **ออกชุดข้อสอบ**: 3 โหมด, Blueprint Mode (stratified sampling), สลับตัวเลือก, ป้องกันข้อมั่วเมื่อคลังไม่พอ
- **พิมพ์ชุดข้อสอบ**: ฉบับนักเรียน / เฉลยละเอียด / กระดาษคำตอบ พร้อมลายน้ำและ @media print
- **School DNA Card**: วิเคราะห์ลักษณะเฉพาะแต่ละสนามสอบ
- **Authentication**: Supabase Auth (email/password) + Row Level Security ต่อผู้ใช้
- **Storage**: อัปโหลด/วางรูปภาพประกอบข้อสอบเข้า bucket `exam-media`

## ขั้นตอนติดตั้ง

### 1) สร้าง Supabase project

ไปที่ https://supabase.com/dashboard สร้างโปรเจกต์ใหม่ (เลือก region สิงคโปร์เพื่อ latency ต่ำสำหรับผู้ใช้ในไทย)

### 2) รัน SQL migration

เปิด **SQL Editor** ในโปรเจกต์ Supabase ของคุณ → New query → คัดลอกทั้งหมดจากไฟล์
`supabase/schema.sql` ในโปรเจกต์นี้ไปวางแล้วกด Run

ไฟล์นี้จะ:
- สร้างตาราง `schools` (พร้อมข้อมูล 10 โรงเรียนตามสเปก), `items`, `stimulus`, `papers`
- ใส่ CHECK constraint บังคับ Controlled Vocabulary ที่ระดับฐานข้อมูล
- เปิด Row Level Security ให้ผู้ใช้แต่ละคนเห็นเฉพาะข้อมูลของตัวเอง (ตาราง `schools` อ่านได้ทุกคนที่ล็อกอิน)
- สร้าง Storage bucket ชื่อ `exam-media` (public read, insert/update/delete เฉพาะเจ้าของไฟล์)

ตาราง `items` / `stimulus` / `papers` จะว่างเปล่าหลังรัน — **ไม่มีการใส่ข้อมูลข้อสอบตัวอย่างที่แต่งขึ้นเอง**
ตามข้อกำหนด ให้นำเข้าข้อมูลจริงผ่านหน้า "นำเข้าข้อมูล" ในแอปเท่านั้น

### 3) ตั้งค่า Environment Variables

คัดลอก `.env.example` เป็น `.env` แล้วใส่ค่าจาก Supabase project ของคุณ
(Project Settings → API → Project URL และ anon public key)

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 4) ปิดการยืนยันอีเมล (แนะนำสำหรับผู้ใช้คนเดียว)

ถ้าต้องการเข้าใช้งานได้ทันทีหลังสมัครสมาชิกโดยไม่ต้องกดยืนยันอีเมล ไปที่
Authentication → Providers → Email → ปิด "Confirm email"
(ถ้าเปิดไว้ ต้องกดลิงก์ยืนยันในอีเมลก่อนเข้าสู่ระบบได้)

### 5) ติดตั้งและรัน

```bash
npm install
npm run dev
```

เปิด http://localhost:5173 แล้วสมัครสมาชิกด้วยอีเมล/รหัสผ่านของคุณในหน้า Login

### 6) Build สำหรับใช้งานจริง

```bash
npm run build
```

ไฟล์ที่ build แล้วอยู่ในโฟลเดอร์ `dist/` — นำไป deploy ได้ที่ Vercel, Netlify, Cloudflare Pages ฯลฯ
(อย่าลืมตั้งค่า Environment Variables ทั้งสองตัวในระบบ deploy ด้วย)

## การนำเข้าข้อมูลข้อสอบจริง 942 ข้อ

ไฟล์ดิบที่ให้มามีเฉพาะ "โจทย์ + ตัวเลือก" และเฉลยบางส่วนแบบข้อความปนกัน ยังไม่ได้จัดรูปแบบเป็น
TSV 21 คอลัมน์ตามสเปก (ไม่มี strand/topic/subtopic/bloom/difficulty/trap_type ที่จัดหมวดไว้)

แนะนำให้:
1. ไปที่หน้า "นำเข้าข้อมูล" → กด "ดาวน์โหลดเทมเพลต TSV" เพื่อดูโครงคอลัมน์ที่ต้องกรอก
2. เตรียมข้อมูลแต่ละข้อให้ครบ 21 คอลัมน์ (ใช้ Excel/Google Sheets จัดหมวดหมู่ตาม Controlled Vocabulary
   ที่ระบุในสเปก: strand, bloom, trap_type, status, answer, pack)
3. วางข้อมูล TSV ในหน้า "นำเข้าข้อมูล" แล้วกด "ตรวจสอบก่อนนำเข้า" ระบบจะไฮไลต์แถวที่มีปัญหาให้แก้ไขก่อน

## Controlled Vocabulary (บังคับใช้ทุกที่ในระบบ + ระดับฐานข้อมูล)

- strand: ศาสนา, หน้าที่พลเมือง, เศรษฐศาสตร์, ประวัติศาสตร์, ภูมิศาสตร์
- bloom: จำ, เข้าใจ, วิเคราะห์
- trap_type: ไม่ใช่/ยกเว้น, ถูกครึ่งเดียว, อ่านตาราง-แผนภูมิ, สลับตัวเลข-ศักราช, คำใกล้เคียง, ไม่มีกับดัก
- status: ใช้งาน, พักไว้, เก็บประวัติ
- answer: A, B, C, D, E
- pack: PP62-63, PP63-64, PP64-65, PP65-66, PP66-67, PP67-68

## โครงสร้างโปรเจกต์

```
src/
  pages/          6 หน้าหลักของระบบ
  components/     ui primitives, layout (sidebar), items (form/modal)
  hooks/          useAllItems, useSchools
  lib/            supabase client, vocab, importValidate, paperGenerator, utils
  contexts/       AuthContext
  types/          hand-written types สำหรับตาราง Supabase
supabase/
  schema.sql      migration หลัก — รันครั้งเดียวตอนตั้งค่าโปรเจกต์
```

## หมายเหตุด้านความปลอดภัยของข้อมูล

- ทุกตาราง (`items`, `stimulus`, `papers`) มี Row Level Security เปิดอยู่ ผู้ใช้เห็นเฉพาะแถวที่ `user_id`
  ตรงกับบัญชีตัวเอง (ใช้ `auth.uid()`)
- Paper Generator จะสุ่มเฉพาะข้อที่ `status = 'ใช้งาน'` เท่านั้น และแจ้งเตือนทันทีถ้าคลังไม่พอตามเงื่อนไข
  (จะไม่สร้างข้อมั่วโดยเด็ดขาด)
- ค่าที่ไม่อยู่ใน Controlled Vocabulary ถูกบล็อกด้วย CHECK constraint ที่ระดับฐานข้อมูล
  (ไม่ใช่แค่ validation ฝั่ง client)
