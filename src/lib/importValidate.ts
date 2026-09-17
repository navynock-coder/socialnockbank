import { ANSWERS, IMPORT_TEMPLATE_COLUMNS, PACKS, STATUSES, STRANDS, BLOOMS, TRAP_TYPES } from '@/lib/vocab'
import type { ItemRow } from '@/types/database'

export type RowSeverity = 'green' | 'yellow' | 'orange' | 'red'

export interface ImportRow {
  rowIndex: number
  data: Record<string, string>
  severity: RowSeverity
  issues: string[]
}

export function parseTSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delimiter).map((h) => h.trim())
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(delimiter)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? '').trim()
    })
    return obj
  })
  return { headers, rows }
}

export function validateRows(rows: Record<string, string>[], existingIds: Set<string>): ImportRow[] {
  const seenInBatch = new Map<string, number>()
  rows.forEach((r) => {
    const id = r.item_id
    if (!id) return
    seenInBatch.set(id, (seenInBatch.get(id) ?? 0) + 1)
  })

  return rows.map((data, i) => {
    const issues: string[] = []
    let severity: RowSeverity = 'green'
    const bump = (s: RowSeverity) => {
      const order: RowSeverity[] = ['green', 'yellow', 'orange', 'red']
      if (order.indexOf(s) > order.indexOf(severity)) severity = s
    }

    if (!data.item_id) {
      issues.push('ไม่มี item_id')
      bump('red')
    } else {
      if (existingIds.has(data.item_id)) {
        issues.push('item_id ซ้ำกับในระบบ')
        bump('red')
      }
      if ((seenInBatch.get(data.item_id) ?? 0) > 1) {
        issues.push('item_id ซ้ำกันเองในไฟล์ที่นำเข้า')
        bump('red')
      }
    }

    if (data.strand && !STRANDS.includes(data.strand as (typeof STRANDS)[number])) {
      issues.push(`สาระ "${data.strand}" ไม่อยู่ใน Controlled Vocabulary`)
      bump('orange')
    }
    if (!data.strand) {
      issues.push('ไม่มีค่า strand')
      bump('orange')
    }
    if (data.bloom && !BLOOMS.includes(data.bloom as (typeof BLOOMS)[number])) {
      issues.push(`bloom "${data.bloom}" ไม่อยู่ใน Controlled Vocabulary`)
      bump('orange')
    }
    if (!data.bloom) {
      issues.push('ไม่มีค่า bloom')
      bump('orange')
    }
    if (data.trap_type && !TRAP_TYPES.includes(data.trap_type as (typeof TRAP_TYPES)[number])) {
      issues.push(`trap_type "${data.trap_type}" ไม่อยู่ใน Controlled Vocabulary`)
      bump('orange')
    }
    if (data.status && !STATUSES.includes(data.status as (typeof STATUSES)[number])) {
      issues.push(`status "${data.status}" ไม่อยู่ใน Controlled Vocabulary`)
      bump('orange')
    }
    if (data.answer && !ANSWERS.includes(data.answer as (typeof ANSWERS)[number])) {
      issues.push(`answer "${data.answer}" ต้องเป็น A-E เท่านั้น`)
      bump('orange')
    }
    if (!data.answer) {
      issues.push('ไม่มีค่า answer')
      bump('orange')
    }
    if (data.pack && !PACKS.includes(data.pack as (typeof PACKS)[number])) {
      issues.push(`pack "${data.pack}" ไม่อยู่ใน Controlled Vocabulary`)
      bump('orange')
    }
    if (data.difficulty && (Number(data.difficulty) < 1 || Number(data.difficulty) > 5 || Number.isNaN(Number(data.difficulty)))) {
      issues.push('difficulty ต้องเป็นตัวเลข 1-5')
      bump('orange')
    }
    if (!data.stem) {
      issues.push('ไม่มีโจทย์ (stem)')
      bump('red')
    }

    const allText = `${data.stem ?? ''} ${data.choice_a ?? ''} ${data.choice_b ?? ''} ${data.choice_c ?? ''} ${data.choice_d ?? ''} ${data.explanation ?? ''}`
    if (allText.includes('???')) {
      issues.push('พบเครื่องหมาย ??? ในเนื้อหา — อาจแปลงไฟล์ผิดพลาด')
      bump('yellow')
    }
    if (data.explanation !== undefined && data.explanation !== '' && data.explanation.length < 40) {
      issues.push('คำอธิบายเฉลย (explanation) สั้นกว่า 40 ตัวอักษร')
      bump('yellow')
    }

    return { rowIndex: i, data, severity, issues }
  })
}

export function buildTemplateTSV(): string {
  return `${IMPORT_TEMPLATE_COLUMNS.join('\t')}\n`
}

export function toItemInsertPayload(data: Record<string, string>, userId: string | undefined) {
  return {
    item_id: data.item_id,
    school: data.school || null,
    year: Number(data.year) || new Date().getFullYear() - 543,
    pack: data.pack || null,
    exam_date: data.exam_date || null,
    strand: data.strand,
    topic: data.topic || null,
    subtopic: data.subtopic || null,
    bloom: data.bloom,
    difficulty: data.difficulty ? Number(data.difficulty) : null,
    stem: data.stem,
    choice_a: data.choice_a || null,
    choice_b: data.choice_b || null,
    choice_c: data.choice_c || null,
    choice_d: data.choice_d || null,
    choice_e: data.choice_e || null,
    answer: data.answer,
    explanation: data.explanation || null,
    trap_type: data.trap_type || null,
    media_url: data.media_url || null,
    stimulus_id: data.stimulus_id || null,
    status: 'ใช้งาน',
    p_value: null,
    user_id: userId,
  } satisfies Partial<ItemRow>
}
