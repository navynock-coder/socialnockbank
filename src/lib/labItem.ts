// ตัวช่วยอ่านข้อมูลข้อสอบสำหรับ SOCIALNOCK LAB: ล้างเลขข้อ, รหัสคอร์ส/ชุด, ฐานข้อมูล
import type { ItemRow } from '@/types/database'
import type { BankBase } from '@/lib/vocab'

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

// 3 ฐานหลัก: เตรียมอุดมฯ / คอร์สติวครูน็อค / โรงเรียนอื่น
export function itemBase(item: Pick<ItemRow, 'item_id' | 'school' | 'source' | 'course_code'>): BankBase {
  const src = item.source ?? ''
  if (item.school === 'TU' || src.includes('เตรียม') || item.item_id.startsWith('TUC-')) return 'เตรียมอุดมฯ'
  if (src.startsWith('คอร์ส') || itemCourseCode(item)) return 'คอร์สติวครูน็อค'
  return 'โรงเรียนอื่น'
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
