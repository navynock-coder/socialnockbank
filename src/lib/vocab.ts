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
  'PP68-69',
  'PP69-70',
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

// ชื่อคอร์ส/แหล่ง (ข้อความอิสระ) เช่น 'คอร์สคาถาพัน' — ขึ้นต้นด้วย "คอร์ส" = ข้อสอบคอร์ส, ค่าว่าง = ข้อสอบจริงจากโรงเรียน
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

// ============================================================================
// SOCIALNOCK LAB — รหัสคอร์ส / ชุดสอบ / การขาย
// ============================================================================

// รหัสคอร์สที่ใช้ใน Lab (ส่วนหน้าของ item_id เช่น P3C8-23-009 → P3C8)
export const LAB_COURSE_CODES = [
  'P1C1', 'P1C2', 'P1C3', 'P1C4',
  'P2C5', 'P2C6', 'P2C7',
  'P3C8', 'P3C9', 'P3C10',
  'KTP', 'TUC',
] as const
export type LabCourseCode = (typeof LAB_COURSE_CODES)[number]

// คอร์สก่อนหน้าที่ใช้ตรวจ "ข้อซ้ำ" (Anti-Duplicate Guard) เป็นค่าเริ่มต้น
export const ANTI_DUPLICATE_COURSES = ['P2C7', 'P3C8', 'P3C9'] as const

// ที่มาของข้อสอบ (คอลัมน์ items.origin) — ข้อสอบจริงของโรงเรียน กับ ข้อในคอร์สติวครูน็อค
export const ORIGINS = ['ข้อสอบจริง', 'ข้อสอบคอร์ส'] as const
export type Origin = (typeof ORIGINS)[number]

// รหัสโรงเรียนเตรียมอุดมศึกษา (ข้อสอบจริง 60–69 และเป้าหมายของคอร์ส TUC)
export const TU_SCHOOL_CODE = 'TU'

// 3 ฐานข้อมูลหลักของคลัง (คำนวณจาก origin + โรงเรียน)
// "คอร์สเข้าเตรียม" (TUC) อยู่ในคอร์สติวครูน็อค ไม่ใช่ข้อสอบจริงของเตรียมอุดมฯ
export const BANK_BASES = ['เตรียมอุดมฯ (ข้อสอบจริง)', 'โรงเรียนอื่น (ข้อสอบจริง)', 'คอร์สติวครูน็อค'] as const
export type BankBase = (typeof BANK_BASES)[number]

// ระดับความยาก 3 แถบสำหรับ Difficulty Meter (difficulty 1–5 ดาว)
export const DIFFICULTY_BANDS = ['ง่าย', 'กลาง', 'ยาก'] as const
export type DifficultyBand = (typeof DIFFICULTY_BANDS)[number]
export function difficultyBand(d: number | null | undefined): DifficultyBand {
  const v = d ?? 3
  return v <= 2 ? 'ง่าย' : v >= 4 ? 'ยาก' : 'กลาง'
}
export const DIFFICULTY_BAND_COLORS: Record<DifficultyBand, string> = {
  ง่าย: '#16a34a',
  กลาง: '#eab308',
  ยาก: '#dc2626',
}

// การเปิดขายชุดข้อสอบ
export const PAPER_VISIBILITIES = ['course', 'single_sale', 'bundle_pack'] as const
export const PAPER_VISIBILITY_LABEL: Record<(typeof PAPER_VISIBILITIES)[number], string> = {
  course: 'ใช้ในคอร์สหลัก',
  single_sale: 'ขายรายชุด',
  bundle_pack: 'มัดรวมเป็นแพ็ก',
}

export const ACCESS_CODE_STATUS_LABEL: Record<'unused' | 'active' | 'expired', string> = {
  unused: 'ยังไม่ใช้',
  active: 'เปิดใช้แล้ว',
  expired: 'หมดอายุ',
}
