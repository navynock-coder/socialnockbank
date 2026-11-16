import * as React from 'react'

// สถานะบอร์ดจัดชุดราย EP (Kanban) — เก็บร่างไว้ในเบราว์เซอร์ แยกตามระดับชั้น
export interface EpColumn {
  id: string
  set_code: string // EP1, EP2, ...
  title: string
  item_ids: string[]
  paper_id?: string | null // ผูกกับแถวใน papers หลังบันทึก
}

export interface StudioBoard {
  course_code: string
  columns: EpColumn[]
  activeId: string
}

const newId = () => Math.random().toString(36).slice(2, 10)

export function makeColumn(n: number): EpColumn {
  return { id: newId(), set_code: `EP${n}`, title: '', item_ids: [] }
}

function initial(): StudioBoard {
  const cols = [makeColumn(1), makeColumn(2), makeColumn(3)]
  return { course_code: 'P3C10', columns: cols, activeId: cols[0].id }
}

function read(key: string): StudioBoard {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const b = JSON.parse(raw) as StudioBoard
      if (b && Array.isArray(b.columns) && b.columns.length > 0) return b
    }
  } catch {
    // ignore
  }
  return initial()
}

export function useStudioBoard(gradeLevel: string) {
  const key = `socialbank.studioBoard.${gradeLevel}`
  const [board, setBoard] = React.useState<StudioBoard>(() => read(key))

  React.useEffect(() => {
    setBoard(read(key))
  }, [key])

  React.useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(board))
    } catch {
      // ignore
    }
  }, [key, board])

  const active = board.columns.find((c) => c.id === board.activeId) ?? board.columns[0]

  // item_id → set_code ของ EP ที่ข้อนั้นอยู่
  const placement = React.useMemo(() => {
    const m = new Map<string, string>()
    board.columns.forEach((c) => c.item_ids.forEach((id) => m.set(id, c.set_code)))
    return m
  }, [board.columns])

  const update = React.useCallback((fn: (b: StudioBoard) => StudioBoard) => setBoard((b) => fn(b)), [])

  const api = React.useMemo(
    () => ({
      setCourse: (course_code: string) => update((b) => ({ ...b, course_code })),
      setActive: (id: string) => update((b) => ({ ...b, activeId: id })),
      addColumn: () =>
        update((b) => {
          const col = makeColumn(b.columns.length + 1)
          return { ...b, columns: [...b.columns, col], activeId: col.id }
        }),
      removeColumn: (id: string) =>
        update((b) => {
          const columns = b.columns.filter((c) => c.id !== id)
          if (columns.length === 0) columns.push(makeColumn(1))
          return { ...b, columns, activeId: columns.some((c) => c.id === b.activeId) ? b.activeId : columns[0].id }
        }),
      patchColumn: (id: string, patch: Partial<EpColumn>) =>
        update((b) => ({ ...b, columns: b.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      // คลิกการ์ด: ถ้าอยู่ EP ไหนอยู่แล้วให้เอาออก ไม่งั้นเพิ่มลง EP ที่กำลังจัด
      toggle: (itemId: string) =>
        update((b) => {
          const inCol = b.columns.find((c) => c.item_ids.includes(itemId))
          if (inCol) {
            return { ...b, columns: b.columns.map((c) => (c.id === inCol.id ? { ...c, item_ids: c.item_ids.filter((x) => x !== itemId) } : c)) }
          }
          return { ...b, columns: b.columns.map((c) => (c.id === b.activeId ? { ...c, item_ids: [...c.item_ids, itemId] } : c)) }
        }),
      addMany: (ids: string[], replace: boolean) =>
        update((b) => ({
          ...b,
          columns: b.columns.map((c) => {
            if (c.id !== b.activeId) return { ...c, item_ids: c.item_ids.filter((x) => !ids.includes(x)) }
            const base = replace ? [] : c.item_ids
            return { ...c, item_ids: [...base, ...ids.filter((x) => !base.includes(x))] }
          }),
        })),
      // ย้ายข้อระหว่าง EP (drag & drop) หรือเรียงลำดับใหม่ในคอลัมน์เดียวกัน
      move: (itemId: string, toColId: string, toIndex?: number) =>
        update((b) => {
          const columns = b.columns.map((c) => ({ ...c, item_ids: c.item_ids.filter((x) => x !== itemId) }))
          const target = columns.find((c) => c.id === toColId)
          if (target) {
            const idx = toIndex == null ? target.item_ids.length : Math.max(0, Math.min(toIndex, target.item_ids.length))
            target.item_ids.splice(idx, 0, itemId)
          }
          return { ...b, columns }
        }),
      loadColumns: (course_code: string, columns: EpColumn[]) =>
        update(() => ({ course_code, columns: columns.length ? columns : [makeColumn(1)], activeId: (columns[0] ?? { id: '' }).id })),
    }),
    [update]
  )

  return { board, active, placement, ...api }
}
