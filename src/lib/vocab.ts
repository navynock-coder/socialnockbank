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

// ระดับชั้น — แยกคลังข้อสอบตามระดับชั้นของผู้เรียน
// 'ป.6' = ข้อสอบระดับ ป.6 (สอบเข้า ม.1) ซึ่งเป็นข้อมูลเดิมทั้งหมดในคลัง
// ข้อสอบที่ไม่มีค่า grade_level (ข้อมูลเก่าก่อนเพิ่มคอลัมน์) ให้ถือเป็น 'ป.6' เสมอ
export const GRADE_LEVELS = ['ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'] as const
export type GradeLevel = (typeof GRADE_LEVELS)[number]
export const DEFAULT_GRADE_LEVEL: GradeLevel = 'ป.6'

export const GRADE_LEVEL_LABEL: Record<GradeLevel, string> = {
  'ป.6': 'ป.6 (สอบเข้า ม.1)',
  'ม.1': 'ม.1',
  'ม.2': 'ม.2',
  'ม.3': 'ม.3 (สอบเข้า ม.4)',
  'ม.4': 'ม.4',
  'ม.5': 'ม.5',
  'ม.6': 'ม.6 (สอบเข้ามหาวิทยาลัย)',
}

export function itemGradeLevel(row: { grade_level?: string | null }): GradeLevel {
  const g = row.grade_level
  return g && (GRADE_LEVELS as readonly string[]).includes(g) ? (g as GradeLevel) : DEFAULT_GRADE_LEVEL
}

// แหล่งที่มาของข้อสอบ (ข้อความอิสระ) เช่น 'คอร์สคาถาพัน' — ค่าว่าง = ข้อสอบจริงจากโรงเรียน
export const SOURCE_SUGGESTIONS = ['คอร์สคาถาพัน', 'คอร์สเข้าเตรียม 69'] as const

export const DIFFICULTIES = [1, 2, 3, 4, 5] as const

export const YEARS = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69] as const

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
  'grade_level',
  'source',
] as const
