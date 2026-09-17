import { STRANDS, BLOOMS, ANSWERS, type Strand } from '@/lib/vocab'
import type { ItemRow } from '@/types/database'

export interface GeneratorConfig {
  mode: 'single' | 'multi' | 'all'
  schoolCodes: string[]
  blueprintMode: boolean
  manualPercents: Record<Strand, number> // used when blueprintMode = false, must total 100
  totalCount: number
  yearFrom: number
  yearTo: number
  difficultyTarget: number // 1.0 - 5.0
  avoidPaperItemIds: string[]
  recentItemIds?: string[] // ข้อที่เคยออกในชุดล่าสุด N ชุด — ใช้ "ลดสิทธิ์" ไม่ใช่ตัดทิ้งเด็ดขาด กันชุดซ้ำหน้าเดิม
  shuffleChoices: boolean
}

export interface ShuffleResult {
  order: string[] // original answer keys in new display order, e.g. ['C','A','D','B']
  newAnswer: string
}

export interface GeneratedItem {
  item: ItemRow
  shuffle: ShuffleResult
}

export interface StrandBreakdown {
  strand: Strand
  targetPct: number
  targetCount: number
  actualCount: number
  actualPct: number
}

export interface GenerateResult {
  items: GeneratedItem[]
  breakdown: StrandBreakdown[]
  avgDifficultyActual: number
  shortages: { strand: Strand; missing: number }[]
  poolSize: number
  difficultyWarning: string | null
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function filterPool(allItems: ItemRow[], config: GeneratorConfig): ItemRow[] {
  const excluded = new Set(config.avoidPaperItemIds)
  return allItems.filter((it) => {
    if (it.status !== 'ใช้งาน') return false
    if (excluded.has(it.item_id)) return false
    if (it.year < config.yearFrom || it.year > config.yearTo) return false
    if (config.mode === 'single' || config.mode === 'multi') {
      if (!it.school || !config.schoolCodes.includes(it.school)) return false
    }
    return true
  })
}

export function computeNaturalStrandPercents(pool: ItemRow[]): Record<Strand, number> {
  const total = pool.length || 1
  const result = {} as Record<Strand, number>
  for (const s of STRANDS) {
    result[s] = (pool.filter((it) => it.strand === s).length / total) * 100
  }
  return result
}

function computeBloomPercentsWithinStrand(pool: ItemRow[], strand: Strand) {
  const items = pool.filter((it) => it.strand === strand)
  const total = items.length || 1
  const result: Record<string, number> = {}
  for (const b of BLOOMS) {
    result[b] = items.filter((it) => it.bloom === b).length / total
  }
  return result
}

// น้ำหนักโทษสำหรับข้อที่เพิ่งออกไปในชุดล่าสุด — ทำให้ไม่ถูกเลือกซ้ำถ้ายังมีตัวเลือกอื่นที่ใกล้ความยากเป้าหมายพอกัน
// แต่ไม่ตัดทิ้งเด็ดขาด เพื่อไม่ให้เกิด "ขาดข้อ" ปลอมๆ เวลาคลังในสาระนั้นมีน้อย
const RECENCY_PENALTY = 0.75

function pickClosestToDifficulty(
  candidates: ItemRow[],
  n: number,
  target: number,
  recentItemIds?: Set<string>
): ItemRow[] {
  const shuffled = shuffleArray(candidates)
  const scored = shuffled.map((it) => {
    const distance = Math.abs((it.difficulty ?? 3) - target)
    const penalty = recentItemIds?.has(it.item_id) ? RECENCY_PENALTY : 0
    return { it, score: distance + penalty }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, n).map((s) => s.it)
}

export function generatePaper(allItems: ItemRow[], config: GeneratorConfig): GenerateResult {
  const pool = filterPool(allItems, config)
  const recentSet = config.recentItemIds && config.recentItemIds.length > 0 ? new Set(config.recentItemIds) : undefined

  const percents: Record<Strand, number> = config.blueprintMode
    ? computeNaturalStrandPercents(pool)
    : config.manualPercents

  // เป้าหมายจำนวนข้อต่อสาระ ปัดเศษให้รวมได้พอดีกับ totalCount
  const rawTargets = STRANDS.map((s) => (percents[s] / 100) * config.totalCount)
  const floored = rawTargets.map(Math.floor)
  let remainder = config.totalCount - floored.reduce((a, b) => a + b, 0)
  const fracOrder = rawTargets
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  const targetCounts = [...floored]
  for (let k = 0; k < fracOrder.length && remainder > 0; k++) {
    targetCounts[fracOrder[k].i]++
    remainder--
  }

  const selected: ItemRow[] = []
  const shortages: { strand: Strand; missing: number }[] = []

  STRANDS.forEach((strand, idx) => {
    const need = targetCounts[idx]
    if (need <= 0) return
    const strandPool = pool.filter((it) => it.strand === strand && !selected.includes(it))
    const bloomPct = computeBloomPercentsWithinStrand(pool, strand)

    const bloomTargets = BLOOMS.map((b) => Math.round(need * bloomPct[b]))
    // adjust rounding to sum to `need`
    let diff = need - bloomTargets.reduce((a, b) => a + b, 0)
    let bi = 0
    while (diff !== 0 && BLOOMS.length > 0) {
      const idx2 = bi % BLOOMS.length
      if (diff > 0) {
        bloomTargets[idx2]++
        diff--
      } else if (bloomTargets[idx2] > 0) {
        bloomTargets[idx2]--
        diff++
      }
      bi++
      if (bi > 1000) break
    }

    let strandSelected: ItemRow[] = []
    BLOOMS.forEach((bloom, bIdx) => {
      const bloomNeed = bloomTargets[bIdx]
      if (bloomNeed <= 0) return
      const candidates = strandPool.filter((it) => it.bloom === bloom && !strandSelected.includes(it))
      const picked = pickClosestToDifficulty(candidates, bloomNeed, config.difficultyTarget, recentSet)
      strandSelected = strandSelected.concat(picked)
    })

    // ถ้ายังไม่ครบ (bloom ไม่พอ) ให้เติมจาก strand pool ที่เหลือ ไม่สนใจ bloom
    if (strandSelected.length < need) {
      const remaining = strandPool.filter((it) => !strandSelected.includes(it))
      const more = pickClosestToDifficulty(remaining, need - strandSelected.length, config.difficultyTarget, recentSet)
      strandSelected = strandSelected.concat(more)
    }

    if (strandSelected.length < need) {
      shortages.push({ strand, missing: need - strandSelected.length })
    }

    selected.push(...strandSelected)
  })

  const finalItems = shuffleArray(selected)

  const generatedItems: GeneratedItem[] = finalItems.map((item) => ({
    item,
    shuffle: config.shuffleChoices ? shuffleChoicesFor(item) : identityShuffle(item),
  }))

  const breakdown: StrandBreakdown[] = STRANDS.map((s, idx) => {
    const actualCount = finalItems.filter((it) => it.strand === s).length
    return {
      strand: s,
      targetPct: percents[s],
      targetCount: targetCounts[idx],
      actualCount,
      actualPct: finalItems.length > 0 ? (actualCount / finalItems.length) * 100 : 0,
    }
  })

  const avgDifficultyActual =
    finalItems.length > 0
      ? finalItems.reduce((sum, it) => sum + (it.difficulty ?? 3), 0) / finalItems.length
      : 0

  // แจ้งเตือนเมื่อ "ความยากที่ได้จริง" ห่างจากเป้าหมายมาก — สื่อสารตรงๆ ว่าคลังในเงื่อนไขนี้ยังไม่มีข้อยาก/ง่ายพอ
  // แทนที่จะเงียบแล้วยัดข้อที่ใกล้เคียงที่สุดเท่าที่มีมาให้ดูเหมือนสำเร็จ
  const farItems = finalItems.filter((it) => Math.abs((it.difficulty ?? 3) - config.difficultyTarget) >= 1.5)
  const difficultyWarning =
    finalItems.length > 0 && farItems.length / finalItems.length >= 0.2
      ? `คลังข้อสอบตามเงื่อนไขนี้ยังมีข้อที่ความยากใกล้เคียงเป้าหมาย (${config.difficultyTarget.toFixed(
          1
        )}) ไม่พอ — ${farItems.length} จาก ${finalItems.length} ข้อ ห่างจากเป้าหมายมากกว่า 1.5 ระดับ ควรเพิ่มข้อสอบยาก/ง่ายเข้าคลังในสาระ/บลูมที่ขาด`
      : null

  return { items: generatedItems, breakdown, avgDifficultyActual, shortages, poolSize: pool.length, difficultyWarning }
}

function availableChoiceKeys(item: ItemRow): string[] {
  const keys: string[] = []
  if (item.choice_a) keys.push('A')
  if (item.choice_b) keys.push('B')
  if (item.choice_c) keys.push('C')
  if (item.choice_d) keys.push('D')
  if (item.choice_e) keys.push('E')
  return keys.length > 0 ? keys : [...ANSWERS]
}

function identityShuffle(item: ItemRow): ShuffleResult {
  return { order: availableChoiceKeys(item), newAnswer: item.answer }
}

function shuffleChoicesFor(item: ItemRow): ShuffleResult {
  const keys = availableChoiceKeys(item)
  const order = shuffleArray(keys)
  const newIndex = order.indexOf(item.answer)
  const newAnswerKey = ANSWERS[newIndex] ?? item.answer
  return { order, newAnswer: newAnswerKey }
}

export function getChoiceText(item: ItemRow, originalKey: string): string | null {
  const map: Record<string, string | null> = {
    A: item.choice_a,
    B: item.choice_b,
    C: item.choice_c,
    D: item.choice_d,
    E: item.choice_e,
  }
  return map[originalKey] ?? null
}
