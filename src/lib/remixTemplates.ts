// ปุ่มลัดช่วยปรับโจทย์ใน Exam Remix Workshop
// ระบบนี้ไม่มี AI/API key ฝังอยู่ ปุ่มจึงทำงานเป็น "แม่แบบที่แก้ไขได้" (เติมโครงให้ครูเขียนต่อ)
// และมีปุ่ม "คัดลอกพรอมต์" สำหรับนำไปให้ Claude ในแชทช่วยร่าง แล้ววางผลกลับมา
import { ANSWER_TH_LABEL } from '@/lib/vocab'
import { cleanStem } from '@/lib/labItem'

export interface RemixDraft {
  stem: string
  choice_a: string
  choice_b: string
  choice_c: string
  choice_d: string
  choice_e: string
  answer: string
  explanation: string
  bloom: string
  difficulty: number
  trap_type: string
  topic: string
}

const CHOICE_FIELDS = ['choice_a', 'choice_b', 'choice_c', 'choice_d', 'choice_e'] as const
type ChoiceField = (typeof CHOICE_FIELDS)[number]
const fieldOf = (key: string): ChoiceField => `choice_${key.toLowerCase()}` as ChoiceField

export function correctText(d: RemixDraft): string {
  return d[fieldOf(d.answer)] ?? ''
}

const THAI_YEAR = new Date().getFullYear() + 543

export const REMIX_ACTIONS = [
  {
    id: 'modernize',
    label: 'ปรับให้ทันสมัย (อิงข่าว)',
    apply(d: RemixDraft): RemixDraft {
      return {
        ...d,
        stem: `[สถานการณ์ปัจจุบัน พ.ศ. ${THAI_YEAR}: ระบุข่าว/เหตุการณ์จริง เช่น นโยบายรัฐ ภัยพิบัติ เศรษฐกิจโลก ที่เกี่ยวกับ "${d.topic || 'หัวข้อนี้'}"]\nจากสถานการณ์ข้างต้น ${cleanStem(d.stem)}`,
      }
    },
  },
  {
    id: 'analyze',
    label: 'ยกระดับเป็นข้อวิเคราะห์',
    apply(d: RemixDraft): RemixDraft {
      return {
        ...d,
        stem: `พิจารณาข้อมูลต่อไปนี้\n[ข้อมูล/ตาราง/ข้อความสั้น 2–3 บรรทัด ที่นักเรียนต้องอ่านแล้วตีความ]\n\nจากข้อมูลข้างต้น ข้อใด "สรุปได้ถูกต้องที่สุด" เกี่ยวกับ ${cleanStem(d.stem).replace(/[?？]\s*$/, '')}`,
        bloom: 'วิเคราะห์',
        difficulty: Math.min(5, (d.difficulty || 3) + 1),
      }
    },
  },
  {
    id: 'distractors',
    label: 'สร้างตัวเลือกหลอก',
    apply(d: RemixDraft): RemixDraft {
      const right = correctText(d) || '[คำตอบที่ถูก]'
      const templates = [
        `[ถูกครึ่งเดียว] ${right} แต่ … (เติมเงื่อนไขที่ผิด)`,
        `[คำใกล้เคียง] (คำ/ชื่อที่สะกดหรือความหมายคล้าย "${right}")`,
        `[สลับเหตุ-ผล] (กลับด้านความสัมพันธ์ของคำตอบที่ถูก)`,
        `[ข้อเท็จจริงจริงแต่ไม่ตอบคำถาม] (ข้อความถูกต้องแต่ไม่เกี่ยวกับโจทย์)`,
      ]
      const next = { ...d, trap_type: d.trap_type || 'ถูกครึ่งเดียว' }
      let t = 0
      for (const f of CHOICE_FIELDS.slice(0, 4)) {
        if (f === fieldOf(d.answer)) continue
        next[f] = templates[t++] ?? next[f]
      }
      return next
    },
  },
  {
    id: 'explain',
    label: 'สร้างคำอธิบายเฉลยละเอียด (อ้างอิงราชบัณฑิตฯ)',
    apply(d: RemixDraft): RemixDraft {
      const lines = [`✅ เฉลย ข้อ ${ANSWER_TH_LABEL[d.answer] ?? d.answer}. ${correctText(d)}`, `เหตุผล: …`, '']
      for (const f of CHOICE_FIELDS) {
        const key = f.slice(-1).toUpperCase()
        if (key === d.answer || !d[f]) continue
        lines.push(`❌ ข้อ ${ANSWER_TH_LABEL[key]}. ${d[f]} — ผิดเพราะ …`)
      }
      lines.push(
        '',
        `📚 อ้างอิง: พจนานุกรม ฉบับราชบัณฑิตยสถาน พ.ศ. 2554 ให้ความหมายของคำว่า "…" ว่า "…"`,
        `💡 จำง่าย: …`
      )
      return { ...d, explanation: lines.join('\n') }
    },
  },
] as const

// พรอมต์สำหรับคัดลอกไปให้ Claude ในแชทช่วยร่าง (ไม่มีค่าใช้จ่าย API เพิ่ม)
export function buildRemixPrompt(original: RemixDraft, goal: string): string {
  const choices = CHOICE_FIELDS.map((f) => original[f] && `${ANSWER_TH_LABEL[f.slice(-1).toUpperCase()]}. ${original[f]}`)
    .filter(Boolean)
    .join('\n')
  return [
    'ช่วยต่อยอดข้อสอบสังคมศึกษาข้อนี้ (ใช้แนวทาง socialbank-item-writing-quality)',
    `เป้าหมาย: ${goal}`,
    '',
    `โจทย์เดิม: ${cleanStem(original.stem)}`,
    choices,
    `เฉลยเดิม: ${ANSWER_TH_LABEL[original.answer] ?? original.answer}`,
    original.explanation ? `คำอธิบายเดิม: ${original.explanation}` : '',
    '',
    'ตอบกลับเป็น: โจทย์ใหม่ / ตัวเลือก ก–ง / เฉลย / คำอธิบายเฉลยละเอียด (ระบุเหตุผลทุกตัวเลือก และอ้างอิงความหมายจากพจนานุกรมฉบับราชบัณฑิตยสถานเมื่อมีศัพท์สำคัญ)',
  ]
    .filter((l) => l !== '')
    .join('\n')
}
