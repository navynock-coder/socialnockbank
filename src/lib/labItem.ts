// ตัวช่วยอ่านข้อมูลข้อสอบสำหรับ SOCIALNOCK LAB: ล้างเลขข้อ, รหัสคอร์ส/ชุด, ฐานข้อมูล
import type { ItemRow } from '@/types/database'
import { TU_SCHOOL_CODE, type BankBase, type Origin } from '@/lib/vocab'

// ตัดเลขข้อที่ติดมากับโจทย์ออก เพื่อให้สลับข้อ/รันเลขใหม่ได้อิสระ
// รองรับ: "1. ", "12) ", "(3) ", "ข้อ 4. ", "ข้อที่ 5 ", "Q6: ", "๗. " (เลขไทย)
// เลขข้อต้องมีเครื่องหมายปิด (1. / 2) / (3) / 4:) จึงจะตัด — กันตัดโจทย์ที่ขึ้นต้นด้วยตัวเลขจริง เช่น "10 ประเทศสมาชิก..."
const LEADING_NUMBER = /^\s*(?:\(\s*[0-9๐-๙]{1,3}\s*\)|\[\s*[0-9๐-๙]{1,3}\s*\]|[0-9๐-๙]{1,3}\s*[.)：:])\s+/
// มีคำนำหน้า "ข้อ/ข้อที่/Q" ตัดได้แม้ไม่มีเครื่องหมาย
const LEADING_LABEL = /^\s*(?:ข้อที่|ข้อ|Q|No\.?)\s*[0-9๐-๙]{1,3}\s*[.)：:]?\s*/i

export function cleanStem(stem: string | null | undefined): string {
  if (!stem) return ''
  let s = stem.replace(/^﻿/, '')
  // ทำซ้ำ 2 รอบ กันเคส "ข้อ 3. 3) โจทย์..."
  for (let i = 0; i < 2; i++) {
    const before = s
    s = s.replace(LEADING_LABEL, '').replace(LEADING_NUMBER, '')
    if (s === before) break
  }
  return s.trim()
}

// คีย์เปรียบเทียบโจทย์ซ้ำ: ล้างเลขข้อ ช่องว่าง เครื่องหมาย และตัวพิมพ์
export function stemKey(stem: string | null | undefined): string {
  return cleanStem(stem)
    .toLowerCase()
    .replace(/[\s"'“”‘’?？!.,()[\]:;\-–—_/\\]+/g, '')
}

const COURSE_RE = /^(P\dC\d+)-(\d+)-/
const KTP_RE = /^KTP\d*-([A-Z]+\d+)-/
const TUC_RE = /^TUC-([A-Z]+\d+)-/

export function itemCourseCode(item: Pick<ItemRow, 'item_id' | 'course_code' | 'source'>): string | null {
  if (item.course_code) return item.course_code
  const m = item.item_id.match(COURSE_RE)
  if (m) return m[1]
  if (KTP_RE.test(item.item_id)) return 'KTP'
  if (TUC_RE.test(item.item_id)) return 'TUC'
  const s = item.source?.match(/\b(P\dC\d+)\b/)
  return s ? s[1] : null
}

export function itemSetCode(item: Pick<ItemRow, 'item_id' | 'set_code'>): string | null {
  if (item.set_code) return item.set_code
  const m = item.item_id.match(COURSE_RE)
  if (m) return `EP${m[2]}`
  const k = item.item_id.match(KTP_RE) ?? item.item_id.match(TUC_RE)
  return k ? k[1] : null
}

type OriginFields = Pick<ItemRow, 'item_id' | 'school' | 'source' | 'course_code' | 'origin' | 'target_school'>

// ที่มา: ใช้ค่าในฐานข้อมูลก่อน (items.origin) ถ้ายังว่าง (ยังไม่รัน migration) ให้เดาด้วยกติกาเดียวกับ trigger
export function itemOrigin(item: OriginFields): Origin {
  if (item.origin === 'ข้อสอบจริง' || item.origin === 'ข้อสอบคอร์ส') return item.origin
  return itemCourseCode(item) || (item.source ?? '').startsWith('คอร์ส') ? 'ข้อสอบคอร์ส' : 'ข้อสอบจริง'
}

// โรงเรียนที่ข้อนี้เกี่ยวข้อง: ข้อสอบจริง = โรงเรียนที่ออกข้อสอบ, ข้อสอบคอร์ส = โรงเรียนเป้าหมายของคอร์ส
export function itemSchool(item: OriginFields): string | null {
  if (itemOrigin(item) === 'ข้อสอบจริง') return item.school ?? null
  if (item.target_school) return item.target_school
  if (itemCourseCode(item) === 'TUC' || (item.source ?? '').includes('เตรียม')) return TU_SCHOOL_CODE
  return null
}

// 3 ฐานหลัก: เตรียมอุดมฯ (ข้อสอบจริง) / โรงเรียนอื่น (ข้อสอบจริง) / คอร์สติวครูน็อค
export function itemBase(item: OriginFields): BankBase {
  if (itemOrigin(item) === 'ข้อสอบคอร์ส') return 'คอร์สติวครูน็อค'
  return item.school === TU_SCHOOL_CODE ? 'เตรียมอุดมฯ (ข้อสอบจริง)' : 'โรงเรียนอื่น (ข้อสอบจริง)'
}

// เฉพาะโรงเรียนที่มีข้อสอบใน items (ใช้ซ่อนโรงเรียนที่ไม่มีข้อในระดับชั้นที่เลือก)
// mode 'real' = นับเฉพาะข้อสอบจริงของโรงเรียน, 'any' = นับโรงเรียนเป้าหมายของคอร์สด้วย
export function schoolsWithItems<S extends { code: string }>(schools: S[], items: ItemRow[], mode: 'real' | 'any' = 'real'): S[] {
  const used = new Set<string>()
  for (const it of items) {
    const code = mode === 'real' ? (itemOrigin(it) === 'ข้อสอบจริง' ? it.school : null) : itemSchool(it)
    if (code) used.add(code)
  }
  return schools.filter((s) => used.has(s.code))
}

export function choiceList(item: ItemRow): { key: string; text: string }[] {
  const pairs: [string, string | null][] = [
    ['A', item.choice_a],
    ['B', item.choice_b],
    ['C', item.choice_c],
    ['D', item.choice_d],
    ['E', item.choice_e],
  ]
  return pairs.filter(([, t]) => !!t && t.trim() !== '').map(([key, text]) => ({ key, text: text as string }))
}
