// ข้อมูลกลางของเอกสารแบบ SOCIALNOCK LAB (ใช้ทั้งหน้าพิมพ์และไฟล์ Word ให้หน้าตาเดียวกับไฟล์ที่ Lab ส่งออก)
import { STRANDS } from '@/lib/vocab'
import { getChoiceText, type GeneratedItem } from '@/lib/paperGenerator'
import { cleanStem } from '@/lib/labItem'

export const LAB_COURSE_LINE = 'สังคมศึกษา ครูน็อค · SOCIALNOCK'
export const LAB_LOGO_URL = '/socialnock-logo.png'
export const TH_CH = ['ก', 'ข', 'ค', 'ง', 'จ']

// สีประจำสาระเดียวกับ Lab (ส1–ส5)
export const LAB_STRAND: { code: string; color: string }[] = [
  { code: 'ส1', color: '#7a4fb5' },
  { code: 'ส2', color: '#1f6fb2' },
  { code: 'ส3', color: '#0d7a6e' },
  { code: 'ส4', color: '#a8611a' },
  { code: 'ส5', color: '#5a7d1e' },
]
export function strandMeta(strand: string | null | undefined) {
  const i = (STRANDS as readonly string[]).indexOf(strand ?? '')
  return i >= 0 ? { ...LAB_STRAND[i], name: STRANDS[i] } : null
}

// นับตัวอักษรแบบที่ตาเห็น (สระ/วรรณยุกต์ไทยไม่นับแยก) — ตัวเลือกสั้นทุกตัวจะจัดเป็น 2 คอลัมน์
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null
export function graphemeLength(s: string): number {
  return segmenter ? [...segmenter.segment(s)].length : Array.from(s).length
}
export const choicesAreShort = (choices: string[]) => choices.every((c) => graphemeLength(c) <= 30)

export interface LabQuestion {
  no: number
  stem: string
  choices: string[]
  answer: number // 0-based index of the correct choice in display order
  explanation: string
  trap: string
  strand: string
  topic: string
  itemId: string
  mediaUrl: string | null
}

export function toLabQuestions(items: GeneratedItem[]): LabQuestion[] {
  return items.map((gi, i) => {
    const choices = gi.shuffle.order.map((k) => getChoiceText(gi.item, k) ?? '')
    return {
      no: i + 1,
      stem: cleanStem(gi.item.stem),
      choices,
      answer: ['A', 'B', 'C', 'D', 'E'].indexOf(gi.shuffle.newAnswer),
      explanation: gi.item.explanation ?? '',
      trap: gi.item.trap_type ?? '',
      strand: gi.item.strand,
      topic: gi.item.topic ?? '',
      itemId: gi.item.item_id,
      mediaUrl: gi.item.media_url,
    }
  })
}

export function strandCounts(qs: LabQuestion[]) {
  const m = new Map<string, number>()
  qs.forEach((q) => m.set(q.strand, (m.get(q.strand) ?? 0) + 1))
  return [...m.entries()].sort((a, b) => (STRANDS as readonly string[]).indexOf(a[0]) - (STRANDS as readonly string[]).indexOf(b[0]))
}
