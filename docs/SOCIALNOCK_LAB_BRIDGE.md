# SocialBank × SOCIALNOCK LAB — ห้องข้อสอบ + ประตูจับเวลา

เอกสารนี้อธิบายสิ่งที่เพิ่มใน SocialBank และสิ่งที่ฝั่ง SOCIALNOCK LAB (คนละโค้ดเบส) ต้องทำเพื่อเชื่อมกัน

## 1) ติดตั้งฝั่งฐานข้อมูล (ครั้งเดียว)

Supabase → SQL Editor → New query → วางไฟล์ `supabase/migrations/20261116_exam_studio_time_gate.sql` → Run

- `items` ได้คอลัมน์ `course_code`, `set_code`, `is_remixed`, `parent_item_id` และเติมรหัสคอร์ส/EP ให้ข้อสอบคอร์สที่นำเข้าแล้วอัตโนมัติ (เช่น `P3C8-23-009` → `P3C8` / `EP23`)
- `papers` ได้ `course_code`, `set_code`, `visibility`, `price`, `duration_minutes`, `max_attempts`, `valid_days`, `is_published`, `lab_synced_at`
- ตารางใหม่ `exam_bundles`, `exam_access_codes`, `course_students`, `exam_attempts` (เปิด RLS ทุกตาราง)
- ฟังก์ชันประตูสอบ `gate_login`, `gate_start`, `gate_save_progress`, `gate_submit`, `gate_report` — ผู้สอบเรียกได้โดยไม่ต้องล็อกอิน แต่ตรวจรหัส/วันหมดอายุ/จำนวนครั้งที่ฝั่งเซิร์ฟเวอร์ และไม่ส่งเฉลยออกไปก่อนส่งคำตอบ
- View สถิติ `lab_score_summary` (คะแนนแยก student/buyer) และ `lab_item_stats` (ความยากรายข้อรวมทุกกลุ่ม) + ฟังก์ชัน `refresh_item_p_values()`

รันซ้ำได้ ไม่ลบข้อมูลเดิม

## 2) หน้าใหม่ใน SocialBank

| เส้นทาง | ใช้ทำอะไร |
|---|---|
| `/studio` | 🏛️ ห้องคลังข้อสอบ SOCIALBANK: ตัวกรอง 3 ฐาน/5 สาระ/ดาว/Bloom/ผิดบ่อย, School DNA Blueprints + Difficulty Meter, บอร์ด EP + Anti-Duplicate Guard (P2C7/P3C8/P3C9 เป็นค่าเริ่มต้น), โต๊ะต่อยอดข้อสอบ, ตั้งขาย/แพ็ก/ออกรหัส + CSV, ส่งออก Word/PDF/Lab |
| `/gate` | ประตูจับเวลา (สาธารณะ) เข้าด้วยรหัสนักเรียน หรือรหัสบัตร `SN-XXXX-XXXX` + เบอร์/อีเมล → ทำข้อสอบจับเวลา → ใบสรุปผลวิเคราะห์รายสาระทันที |
| `/gate-results` | ผลสอบแยก "นักเรียนในคอร์ส" กับ "ผู้ซื้อทั่วไป" + ความยากรายข้อรวม + ปุ่มอัปเดตค่า p กลับเข้าคลัง |

ลิงก์ขายผ่าน LINE OA: `https://<โดเมน SocialBank>/gate?code=SN-XXXX-XXXX` (CSV ที่ดาวน์โหลดมีคอลัมน์ลิงก์ให้แล้ว)

## 3) สิ่งที่ฝั่ง SOCIALNOCK LAB ต้องทำ

### 3.1 ปุ่มทางเข้า (แถบเมนูบน ข้างปุ่ม `SOCIALNOCK 360°`)

```tsx
<a
  href="https://socialnockbank-iota.vercel.app/studio"
  target="_blank"
  rel="noopener"
  className="rounded-lg bg-[#d4a017] px-3 py-2 font-bold text-[#11253e] hover:bg-[#e8b931]"
>
  🏛️ ห้องคลังข้อสอบ SOCIALBANK
</a>
```

### 3.2 รับชุดข้อสอบเข้า Admin Store (Webhook)

หน้า `/studio` แท็บ "ส่งออก / Lab" ส่ง `POST` (Content-Type `text/plain`, body เป็น JSON) ไปยัง URL ที่ตั้งไว้
รูปแบบข้อมูล (`schema: "socialnock-lab/answer-key@1"`):

```json
{
  "schema": "socialnock-lab/answer-key@1",
  "action": "upsert_set",
  "source": "socialbank",
  "exported_at": "2026-11-16T13:00:00.000Z",
  "set": { "paper_id": "uuid|null", "title": "P3C10 EP1", "course_code": "P3C10", "set_code": "EP1", "duration_minutes": 60, "total_items": 50 },
  "rows": [
    {
      "ข้อ": 1,
      "รหัสข้อสอบ": "P1C4-06-021",
      "คำถาม": "พระอัสสชิ มีความสำคัญ…",
      "ตัวเลือก": "[\"ปัญจวัคคีย์\",\"พระอัครสาวก\",\"พระอสีติมหาสาวก\",\"ชฎิล 3 พี่น้อง\"]",
      "เฉลย": "ปัญจวัคคีย์",
      "เฉลยตัวอักษร": "ก",
      "คำอธิบายเฉลย": "…",
      "สาระ": "ศาสนา", "หัวข้อ": "", "ความยาก": 3, "Bloom": "จำ", "รูปภาพ": ""
    }
  ]
}
```

- `ตัวเลือก` เป็น JSON Array (string) ตามลำดับที่แสดงจริง (ถ้าเลือกสลับตัวเลือก ลำดับนี้คือหลังสลับแล้ว)
- `เฉลย` เป็นข้อความเต็มของตัวเลือกที่ถูก ตรงกับรูปแบบชีต "SOCIALNOCK เฉลยจากฟอร์ม"
- `คำถาม` ตัดเลขข้อเดิมออกแล้ว (`cleanStem`) ให้ Lab รันเลขข้อเอง

ตัวอย่าง Google Apps Script (ฝั่ง Lab) — Deploy เป็น Web app, Execute as: Me, Who has access: Anyone:

```js
function doPost(e) {
  const p = JSON.parse(e.postData.contents)
  if (p.schema !== 'socialnock-lab/answer-key@1') return ContentService.createTextOutput('bad schema')
  const ss = SpreadsheetApp.getActive()
  const name = `${p.set.course_code || 'SET'}-${p.set.set_code || ''}`.replace(/-$/, '')
  const sh = ss.getSheetByName(name) || ss.insertSheet(name)
  const headers = Object.keys(p.rows[0] || {})
  sh.clearContents()
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
  if (p.rows.length) sh.getRange(2, 1, p.rows.length, headers.length).setValues(p.rows.map((r) => headers.map((h) => r[h])))
  // TODO: เขียน/อัปเดตแถวใน Admin Store ของ Lab ด้วย p.set (title, duration_minutes, total_items)
  return ContentService.createTextOutput('ok')
}
```

> เพราะ Apps Script ไม่ตอบ CORS preflight ฝั่ง SocialBank จึงส่งแบบ `no-cors` และอ่านผลตอบกลับไม่ได้ ให้ตรวจผลในชีต/Admin Store ของ Lab

ถ้าไม่ใช้ Webhook: กด "ดาวน์โหลด JSON" หรือ "คัดลอกเป็นตารางไปวางในชีต" แล้ววางที่เซลล์ A1 ของชีตเฉลย

### 3.3 แยกคะแนนผู้ซื้อออกจากนักเรียนคอร์ส

ถ้า Lab ต้องการดึงผลจาก Time-Gate ไปแสดงในแดชบอร์ดของ Lab ให้ query ด้วยบัญชีครู (มี RLS):

```sql
select * from lab_score_summary where participant_type = 'student';  -- ค่าเฉลี่ยคอร์ส (ไม่ปนผู้ซื้อ)
select * from lab_score_summary where participant_type = 'buyer';    -- ผู้ซื้อทั่วไป
select * from lab_item_stats;                                        -- ความยากรายข้อรวมทุกกลุ่ม
```

## 4) ปุ่ม "ช่วยปรับโจทย์" ในโต๊ะต่อยอด

ระบบยังไม่มี AI/API key ฝังอยู่ ปุ่มลัดทั้ง 4 (ทันสมัย / ยกระดับวิเคราะห์ / ตัวเลือกหลอก / คำอธิบายอ้างอิงราชบัณฑิตฯ) จึงเติม "แม่แบบที่แก้ไขได้" ลงในช่องโจทย์ใหม่
และมีปุ่ม "คัดลอกพรอมต์ไปให้ Claude ช่วยร่าง" เพื่อใช้กับ Claude ในแชท (ไม่มีค่าใช้จ่าย API เพิ่ม) แล้ววางผลกลับมาก่อนกดบันทึก
ถ้าภายหลังต้องการเรียก AI อัตโนมัติ ให้เพิ่ม serverless function (เช่น Vercel) ที่ถือ API key ฝั่งเซิร์ฟเวอร์ แล้วเปลี่ยน `REMIX_ACTIONS` ใน `src/lib/remixTemplates.ts` ให้เรียก function นั้น
