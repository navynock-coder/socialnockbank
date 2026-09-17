import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[SocialBank] ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — คัดลอก .env.example เป็น .env แล้วใส่ค่าจาก Supabase project ของคุณ'
  )
}

// หมายเหตุ: ไม่ผูก Database generic type กับ client เพื่อความยืดหยุ่นในการ insert/update
// ยึดความถูกต้องของโครงสร้างข้อมูลจาก types/database.ts (ItemRow, SchoolRow, ...) ที่ใช้ทั่วแอปแทน
export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export const EXAM_MEDIA_BUCKET = 'exam-media'
