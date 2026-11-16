// สะพานเชื่อม SocialBank → SOCIALNOCK LAB
// แปลงชุดข้อสอบเป็นรูปแบบชีต "SOCIALNOCK เฉลยจากฟอร์ม":
//   - ตัวเลือก = JSON Array ของข้อความตัวเลือก (เรียงตามลำดับที่แสดง)
//   - เฉลย    = ข้อความเต็มของตัวเลือกที่ถูก (ไม่ใช่แค่ ก/ข/ค/ง)
//   - คำอธิบายเฉลย ดึงจากคลัง
import { ANSWER_TH_LABEL } from '@/lib/vocab'
import { cleanStem } from '@/lib/labItem'
import { getChoiceText, type GeneratedItem } from '@/lib/paperGenerator'

export const LAB_SCHEMA = 'socialnock-lab/answer-key@1'

export interface LabSetMeta {
  paper_id?: string | null
  title: string
  course_code: string | null
  set_code: string | null
  duration_minutes: number
  visibility?: string
  price?: number
  max_attempts?: number
  valid_days?: number
}

export interface LabRow {
  ข้อ: number
  รหัสข้อสอบ: string
  คำถาม: string
  ตัวเลือก: string // JSON Array string
  เฉลย: string
  เฉลยตัวอักษร: string
  คำอธิบายเฉลย: string
  สาระ: string
  หัวข้อ: string
  ความยาก: number | null
  Bloom: string
  รูปภาพ: string
}

export interface LabPayload {
  schema: typeof LAB_SCHEMA
  action: 'upsert_set'
  source: 'socialbank'
  exported_at: string
  set: LabSetMeta & { total_items: number }
  rows: LabRow[]
}

export function toLabRows(items: GeneratedItem[]): LabRow[] {
  return items.map((gi, idx) => {
    const texts = gi.shuffle.order.map((k) => getChoiceText(gi.item, k) ?? '')
    const answerIdx = ['A', 'B', 'C', 'D', 'E'].indexOf(gi.shuffle.newAnswer)
    return {
      ข้อ: idx + 1,
      รหัสข้อสอบ: gi.item.item_id,
      คำถาม: cleanStem(gi.item.stem),
      ตัวเลือก: JSON.stringify(texts),
      เฉลย: texts[answerIdx] ?? '',
      เฉลยตัวอักษร: ANSWER_TH_LABEL[gi.shuffle.newAnswer] ?? gi.shuffle.newAnswer,
      คำอธิบายเฉลย: gi.item.explanation ?? '',
      สาระ: gi.item.strand,
      หัวข้อ: gi.item.topic ?? '',
      ความยาก: gi.item.difficulty,
      Bloom: gi.item.bloom,
      รูปภาพ: gi.item.media_url ?? '',
    }
  })
}

export function buildLabPayload(meta: LabSetMeta, items: GeneratedItem[]): LabPayload {
  return {
    schema: LAB_SCHEMA,
    action: 'upsert_set',
    source: 'socialbank',
    exported_at: new Date().toISOString(),
    set: { ...meta, total_items: items.length },
    rows: toLabRows(items),
  }
}

// TSV สำหรับวางลง Google Sheet "SOCIALNOCK เฉลยจากฟอร์ม" ได้ทันที
export function labRowsToTsv(rows: LabRow[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0]) as (keyof LabRow)[]
  const clean = (v: unknown) => String(v ?? '').replace(/[\t\r\n]+/g, ' ')
  return [headers.join('\t'), ...rows.map((r) => headers.map((h) => clean(r[h])).join('\t'))].join('\n')
}

// ---------------------------------------------------------------------------
// ส่งเข้า Admin Store ของ Lab ผ่าน Webhook (เช่น Google Apps Script Web App ของ Lab)
// ตั้ง URL ได้ในหน้า Exam Studio (เก็บในเบราว์เซอร์นี้) หรือ env VITE_LAB_WEBHOOK_URL
// ---------------------------------------------------------------------------
const WEBHOOK_KEY = 'socialbank.labWebhookUrl'

export function getLabWebhookUrl(): string {
  try {
    const v = localStorage.getItem(WEBHOOK_KEY)
    if (v) return v
  } catch {
    // ignore
  }
  return (import.meta.env.VITE_LAB_WEBHOOK_URL as string | undefined) ?? ''
}

export function setLabWebhookUrl(url: string) {
  try {
    if (url) localStorage.setItem(WEBHOOK_KEY, url)
    else localStorage.removeItem(WEBHOOK_KEY)
  } catch {
    // ignore
  }
}

// Apps Script ไม่ตอบ CORS preflight → ส่งเป็น text/plain แบบ no-cors (อ่านผลตอบกลับไม่ได้ แต่ข้อมูลถึงปลายทาง)
export async function pushToLab(url: string, payload: LabPayload): Promise<{ ok: boolean; opaque: boolean; message: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
    if (res.type === 'opaque') return { ok: true, opaque: true, message: 'ส่งข้อมูลแล้ว (ปลายทางไม่คืนสถานะ ให้ตรวจใน Lab)' }
    return { ok: res.ok, opaque: false, message: res.ok ? 'ส่งเข้า Lab สำเร็จ' : `Lab ตอบกลับ ${res.status}` }
  } catch (e) {
    return { ok: false, opaque: false, message: e instanceof Error ? e.message : 'ส่งไม่สำเร็จ' }
  }
}
