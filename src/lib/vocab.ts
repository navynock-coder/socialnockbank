// Controlled Vocabulary — ห้ามให้ค่านอกรายการนี้หลุดเข้าฐานข้อมูลเด็ดขาด
// ใช้ค่าเดียวกันทุกที่ในระบบ: filter, form, import validator, paper generator

export const STRANDS = [
  'ศาสนา',
  'หน้าที่พลเมือง',
  'เศรษฐศาสตร์',
  'ประวัติศาสตร์',
  'ภูมิศาสตร์',
] as const
export type Strand = (typeof STRANDS)[number]

export const BLOOMS = ['จำ', 'เข้าใจ', 'วิเคราะห์'] as const
export type Bloom = (typeof BLOOMS)[number]

export const TRAP_TYPES = [
  'ไม่ใช่/ยกเว้น',
  'ถูกครึ่งเดียว',
  'อ่านตาราง-แผนภูมิ',
  'สลับตัวเลข-ศักราช',
  'คำใกล้เคียง',
  'ไม่มีกับดัก',
] as const
export type TrapType = (typeof TRAP_TYPES)[number]

export const STATUSES = ['ใช้งาน', 'พักไว้', 'เก็บประวัติ'] as const
export type ItemStatus = (typeof STATUSES)[number]

export const ANSWERS = ['A', 'B', 'C', 'D', 'E'] as const
export type AnswerKey = (typeof ANSWERS)[number]

export const PACKS = [
  'PP62-63',
  'PP63-64',
  'PP64-65',
  'PP65-66',
  'PP66-67',
  'PP67-68',
] as const
export type Pack = (typeof PACKS)[number]

export const DIFFICULTIES = [1, 2, 3, 4, 5] as const

export const YEARS = [62, 63, 64, 65, 66, 67, 68, 69] as const

export const ANSWER_TH_LABEL: Record<string, string> = {
  A: 'ก',
  B: 'ข',
  C: 'ค',
  D: 'ง',
  E: 'จ',
}

export const STRAND_COLORS: Record<Strand, string> = {
  ศาสนา: '#f97316',
  หน้าที่พลเมือง: '#1e3a5f',
  เศรษฐศาสตร์: '#16a34a',
  ประวัติศาสตร์: '#7c3aed',
  ภูมิศาสตร์: '#0891b2',
}

export function isValid<T extends readonly string[]>(list: T, value: string | null | undefined) {
  if (!value) return false
  return (list as readonly string[]).includes(value)
}

export const IMPORT_TEMPLATE_COLUMNS = [
  'item_id',
  'school',
  'year',
  'pack',
  'exam_date',
  'strand',
  'topic',
  'subtopic',
  'bloom',
  'difficulty',
  'stem',
  'choice_a',
  'choice_b',
  'choice_c',
  'choice_d',
  'choice_e',
  'answer',
  'explanation',
  'trap_type',
  'media_url',
  'stimulus_id',
] as const
