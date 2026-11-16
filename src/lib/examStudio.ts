// ตรรกะของ "ห้องข้อสอบ SocialBank" (Exam Studio): School DNA Blueprints, Difficulty Meter,
// จัดชุดอัตโนมัติตามสูตร, Anti-Duplicate Guard, รหัสเข้าสอบ และ CSV
import { STRANDS, BLOOMS, DIFFICULTY_BANDS, difficultyBand, type Strand, type Bloom, type DifficultyBand } from '@/lib/vocab'
import { itemCourseCode, itemSetCode, stemKey } from '@/lib/labItem'
import type { ItemRow, PaperRow } from '@/types/database'

// ---------------------------------------------------------------------------
// School DNA Blueprints
// ---------------------------------------------------------------------------
export interface Blueprint {
  id: string
  name: string
  description: string
  totalCount: number
  strandPct: Record<Strand, number>
  bandPct: Record<DifficultyBand, number>
  bloomPct: Record<Bloom, number>
  durationMinutes: number
}

const even = (): Record<Strand, number> => Object.fromEntries(STRANDS.map((s) => [s, 20])) as Record<Strand, number>

// สูตรตั้งต้น (แก้สัดส่วนได้ในหน้าจอ) — ถ้าคลังมีข้อสอบจริงของโรงเรียนนั้น ให้กด "DNA จากข้อสอบจริง" แทนจะแม่นกว่า
export const PRESET_BLUEPRINTS: Blueprint[] = [
  {
    id: 'pds',
    name: 'สูตรสาธิตปทุมวัน',
    description: 'เน้นวิเคราะห์/ตีความ ข้อยากเยอะ ภูมิศาสตร์-ประวัติศาสตร์เด่น',
    totalCount: 50,
    strandPct: { ศาสนา: 15, หน้าที่พลเมือง: 20, เศรษฐศาสตร์: 20, ประวัติศาสตร์: 20, ภูมิศาสตร์: 25 },
    bandPct: { ง่าย: 20, กลาง: 40, ยาก: 40 },
    bloomPct: { จำ: 20, เข้าใจ: 35, วิเคราะห์: 45 },
    durationMinutes: 60,
  },
  {
    id: 'ssw',
    name: 'สูตรสามเสนฯ',
    description: 'กระจายครบ 5 สาระ ความยากปานกลาง วัดความเข้าใจเป็นหลัก',
    totalCount: 40,
    strandPct: even(),
    bandPct: { ง่าย: 30, กลาง: 50, ยาก: 20 },
    bloomPct: { จำ: 35, เข้าใจ: 40, วิเคราะห์: 25 },
    durationMinutes: 50,
  },
  {
    id: 'tu',
    name: 'สูตรเตรียมอุดมฯ',
    description: 'สอบเข้า ม.4 เน้นเชื่อมโยงข่าว/สถานการณ์ ข้อกลาง-ยาก',
    totalCount: 40,
    strandPct: even(),
    bandPct: { ง่าย: 20, กลาง: 45, ยาก: 35 },
    bloomPct: { จำ: 25, เข้าใจ: 40, วิเคราะห์: 35 },
    durationMinutes: 60,
  },
  {
    id: 'speed',
    name: 'สูตรสปีดเทสต์',
    description: '20 ข้อ 15 นาที ทบทวนเร็ว ข้อง่าย-กลาง',
    totalCount: 20,
    strandPct: even(),
    bandPct: { ง่าย: 50, กลาง: 40, ยาก: 10 },
    bloomPct: { จำ: 60, เข้าใจ: 30, วิเคราะห์: 10 },
    durationMinutes: 15,
  },
]

function pctOf<T extends string>(keys: readonly T[], items: ItemRow[], get: (it: ItemRow) => string): Record<T, number> {
  const total = items.length || 1
  return Object.fromEntries(keys.map((k) => [k, Math.round((items.filter((it) => get(it) === k).length / total) * 100)])) as Record<T, number>
}

// DNA จากข้อสอบจริงของโรงเรียน (คำนวณสัดส่วนจากคลัง)
export function blueprintFromSchool(code: string, nameTh: string, allItems: ItemRow[], totalCount = 40): Blueprint | null {
  const items = allItems.filter((it) => it.school === code)
  if (items.length === 0) return null
  return {
    id: `dna-${code}`,
    name: `DNA ${nameTh}`,
    description: `คำนวณจากข้อสอบจริง ${items.length} ข้อในคลัง`,
    totalCount,
    strandPct: pctOf(STRANDS, items, (it) => it.strand),
    bandPct: pctOf(DIFFICULTY_BANDS, items, (it) => difficultyBand(it.difficulty)),
    bloomPct: pctOf(BLOOMS, items, (it) => it.bloom),
    durationMinutes: 60,
  }
}

// ---------------------------------------------------------------------------
// Difficulty Meter
// ---------------------------------------------------------------------------
export interface MeterResult {
  counts: Record<DifficultyBand, number>
  pct: Record<DifficultyBand, number>
  avgStars: number
  total: number
}

export function difficultyMeter(items: ItemRow[]): MeterResult {
  const counts = { ง่าย: 0, กลาง: 0, ยาก: 0 } as Record<DifficultyBand, number>
  let sum = 0
  for (const it of items) {
    counts[difficultyBand(it.difficulty)]++
    sum += it.difficulty ?? 3
  }
  const total = items.length
  const pct = Object.fromEntries(
    DIFFICULTY_BANDS.map((b) => [b, total ? Math.round((counts[b] / total) * 100) : 0])
  ) as Record<DifficultyBand, number>
  return { counts, pct, avgStars: total ? sum / total : 0, total }
}

// ---------------------------------------------------------------------------
// จัดชุดอัตโนมัติตาม Blueprint
// ---------------------------------------------------------------------------
function largestRemainder<T extends string>(keys: readonly T[], pct: Record<T, number>, total: number): Record<T, number> {
  const sumPct = keys.reduce((a, k) => a + (pct[k] || 0), 0) || 1
  const raw = keys.map((k) => ((pct[k] || 0) / sumPct) * total)
  const out = raw.map(Math.floor)
  let rest = total - out.reduce((a, b) => a + b, 0)
  raw
    .map((v, i) => ({ i, f: v - Math.floor(v) }))
    .sort((a, b) => b.f - a.f)
    .forEach(({ i }) => {
      if (rest > 0) {
        out[i]++
        rest--
      }
    })
  return Object.fromEntries(keys.map((k, i) => [k, out[i]])) as Record<T, number>
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface AutoPickResult {
  picked: ItemRow[]
  shortages: { strand: Strand; missing: number }[]
}

export function autoPickByBlueprint(
  pool: ItemRow[],
  bp: Blueprint,
  opts: { exclude?: Set<string>; isDuplicate?: (it: ItemRow) => boolean } = {}
): AutoPickResult {
  const strandNeed = largestRemainder(STRANDS, bp.strandPct, bp.totalCount)
  const bandNeed = largestRemainder(DIFFICULTY_BANDS, bp.bandPct, bp.totalCount)
  const bloomNeed = largestRemainder(BLOOMS, bp.bloomPct, bp.totalCount)
  const used = new Set(opts.exclude ?? [])
  const usedStems = new Set<string>()
  const picked: ItemRow[] = []
  const shortages: { strand: Strand; missing: number }[] = []

  for (const strand of STRANDS) {
    let need = strandNeed[strand]
    const candidates = shuffle(pool.filter((it) => it.strand === strand && !used.has(it.item_id)))
    while (need > 0) {
      let best: ItemRow | null = null
      let bestScore = -Infinity
      for (const it of candidates) {
        if (used.has(it.item_id)) continue
        const key = stemKey(it.stem)
        if (usedStems.has(key)) continue
        const score =
          (bandNeed[difficultyBand(it.difficulty)] > 0 ? 2 : 0) +
          (bloomNeed[it.bloom as Bloom] > 0 ? 1 : 0) -
          (opts.isDuplicate?.(it) ? 3 : 0)
        if (score > bestScore) {
          bestScore = score
          best = it
          if (score >= 3) break
        }
      }
      if (!best) break
      used.add(best.item_id)
      usedStems.add(stemKey(best.stem))
      picked.push(best)
      bandNeed[difficultyBand(best.difficulty)]--
      if (best.bloom in bloomNeed) bloomNeed[best.bloom as Bloom]--
      need--
    }
    if (need > 0) shortages.push({ strand, missing: need })
  }
  return { picked, shortages }
}

// ---------------------------------------------------------------------------
// Anti-Duplicate Guard
// ---------------------------------------------------------------------------
export interface DuplicateHit {
  course: string
  where: string // เช่น "P3C8 · EP23 (P3C8-23-009)"
}

export interface DuplicateIndex {
  check: (it: ItemRow) => DuplicateHit[]
}

export function buildDuplicateIndex(allItems: ItemRow[], papers: PaperRow[], guardCourses: readonly string[]): DuplicateIndex {
  const guard = new Set(guardCourses)
  const byStem = new Map<string, DuplicateHit[]>()
  const byItemId = new Map<string, DuplicateHit[]>()
  const push = (m: Map<string, DuplicateHit[]>, k: string, h: DuplicateHit) => {
    const arr = m.get(k)
    if (arr) {
      if (!arr.some((x) => x.where === h.where)) arr.push(h)
    } else m.set(k, [h])
  }
  for (const it of allItems) {
    const c = itemCourseCode(it)
    if (!c || !guard.has(c)) continue
    const set = itemSetCode(it)
    const hit = { course: c, where: `${c}${set ? ` · ${set}` : ''} (${it.item_id})` }
    push(byItemId, it.item_id, hit)
    const k = stemKey(it.stem)
    if (k.length >= 8) push(byStem, k, hit)
  }
  // ชุดสอบที่บันทึกไว้แล้วในคอร์สที่เฝ้าระวัง
  for (const p of papers) {
    if (!p.course_code || !guard.has(p.course_code)) continue
    for (const id of p.item_ids ?? []) {
      push(byItemId, id, { course: p.course_code, where: `${p.course_code}${p.set_code ? ` · ${p.set_code}` : ''} (ชุด "${p.paper_name}")` })
    }
  }
  return {
    check(it) {
      const hits = [...(byItemId.get(it.item_id) ?? [])]
      const k = stemKey(it.stem)
      for (const h of byStem.get(k) ?? []) {
        if (!h.where.includes(`(${it.item_id})`) && !hits.some((x) => x.where === h.where)) hits.push(h)
      }
      return hits
    },
  }
}

// ---------------------------------------------------------------------------
// รหัสบัตรเข้าสอบ + CSV
// ---------------------------------------------------------------------------
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ตัด I O 0 1 ที่อ่านสับสน

export function generateAccessCode(prefix = 'SN'): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
  return `${prefix}-${chars.slice(0, 4)}-${chars.slice(4)}`
}

export function generateAccessCodes(n: number, prefix = 'SN'): string[] {
  const set = new Set<string>()
  while (set.size < n) set.add(generateAccessCode(prefix))
  return [...set]
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // BOM ให้ Excel อ่านภาษาไทยถูก
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
