import * as React from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Save, Trash2, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { STRAND_COLORS, type Strand } from '@/lib/vocab'
import { cleanStem } from '@/lib/labItem'
import type { DuplicateIndex } from '@/lib/examStudio'
import type { ItemRow } from '@/types/database'
import { cn } from '@/lib/utils'
import { DifficultyMeter } from './DifficultyMeter'
import { Stars } from './ItemCard'
import type { EpColumn, StudioBoard } from './useStudioBoard'

// บอร์ดวางแผนราย EP: ลากการ์ดข้ามคอลัมน์ / เรียงลำดับ / บันทึกแต่ละ EP เป็นชุดข้อสอบ (papers)
export function EpBoard({
  board,
  itemMap,
  dupIndex,
  savingId,
  onSetActive,
  onAdd,
  onRemove,
  onPatch,
  onMove,
  onToggle,
  onSave,
}: {
  board: StudioBoard
  itemMap: Map<string, ItemRow>
  dupIndex: DuplicateIndex
  savingId: string | null
  onSetActive: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onPatch: (id: string, patch: Partial<EpColumn>) => void
  onMove: (itemId: string, toColId: string, toIndex?: number) => void
  onToggle: (itemId: string) => void
  onSave: (col: EpColumn) => void
}) {
  const [dragId, setDragId] = React.useState<string | null>(null)

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {board.columns.map((col) => {
        const items = col.item_ids.map((id) => itemMap.get(id)).filter((x): x is ItemRow => !!x)
        const missing = col.item_ids.length - items.length
        const dupCount = items.filter((it) => dupIndex.check(it).length > 0).length
        const isActive = col.id === board.activeId
        return (
          <div
            key={col.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData('text/plain') || dragId
              if (id) onMove(id, col.id)
              setDragId(null)
            }}
            className={cn(
              'w-80 shrink-0 rounded-xl border bg-white flex flex-col max-h-[75vh]',
              isActive ? 'border-gold-400 ring-2 ring-gold-300' : 'border-border'
            )}
          >
            <div className={cn('rounded-t-xl p-3 space-y-2', isActive ? 'bg-navy-600 text-white' : 'bg-navy-50')}>
              <div className="flex items-center gap-2">
                <Input
                  value={col.set_code}
                  onChange={(e) => onPatch(col.id, { set_code: e.target.value.toUpperCase() })}
                  className="h-8 w-20 font-bold text-navy-900"
                />
                <Input
                  value={col.title}
                  placeholder="ชื่อชุด (ไม่บังคับ)"
                  onChange={(e) => onPatch(col.id, { title: e.target.value })}
                  className="h-8 text-navy-900"
                />
                <button onClick={() => onRemove(col.id)} title="ลบ EP นี้" className="opacity-70 hover:opacity-100">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>
                  {items.length} ข้อ{col.paper_id ? ' · บันทึกแล้ว' : ''}
                  {missing > 0 ? ` · หาไม่พบ ${missing}` : ''}
                </span>
                {!isActive ? (
                  <button onClick={() => onSetActive(col.id)} className="rounded bg-gold-400 px-2 py-0.5 font-semibold text-navy-900">
                    จัด EP นี้
                  </button>
                ) : (
                  <span className="rounded bg-gold-400 px-2 py-0.5 font-semibold text-navy-900">กำลังจัด</span>
                )}
              </div>
            </div>
            <div className="p-3 space-y-2 border-b border-border">
              <DifficultyMeter items={items} compact />
              {dupCount > 0 && (
                <p className="flex items-center gap-1 text-xs text-red-700">
                  <AlertTriangle size={12} /> ซ้ำกับคอร์สก่อนหน้า {dupCount} ข้อ
                </p>
              )}
            </div>
            <ol className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {items.map((it, idx) => {
                const dup = dupIndex.check(it)
                return (
                  <li
                    key={it.item_id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', it.item_id)
                      setDragId(it.item_id)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const id = e.dataTransfer.getData('text/plain') || dragId
                      if (id) onMove(id, col.id, idx)
                      setDragId(null)
                    }}
                    className={cn(
                      'group relative cursor-grab rounded-md border bg-white p-2 pl-3 text-xs',
                      dup.length ? 'border-red-300 bg-red-50/40' : 'border-border'
                    )}
                    title={dup.length ? `เคยใช้: ${dup.map((d) => d.where).join(', ')}` : it.item_id}
                  >
                    <span className="absolute left-0 top-0 h-full w-1 rounded-l-md" style={{ background: STRAND_COLORS[it.strand as Strand] }} />
                    <div className="flex items-start gap-1.5">
                      <span className="font-bold text-navy-700">{idx + 1}.</span>
                      <span className="flex-1 line-clamp-2 text-navy-900">{cleanStem(it.stem)}</span>
                      <div className="flex flex-col opacity-0 group-hover:opacity-100">
                        <button onClick={() => onMove(it.item_id, col.id, idx - 1)} title="เลื่อนขึ้น"><ArrowUp size={12} /></button>
                        <button onClick={() => onMove(it.item_id, col.id, idx + 1)} title="เลื่อนลง"><ArrowDown size={12} /></button>
                      </div>
                      <button onClick={() => onToggle(it.item_id)} className="opacity-0 group-hover:opacity-100" title="เอาออก">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Stars n={it.difficulty} /> {it.bloom} · {it.item_id}
                      {dup.length > 0 && <AlertTriangle size={11} className="text-red-600" />}
                    </div>
                  </li>
                )
              })}
              {items.length === 0 && (
                <li className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  ลากการ์ดมาวาง หรือกด "จัด EP นี้" แล้วเลือกจากแท็บคัดข้อ
                </li>
              )}
            </ol>
            <div className="p-2 border-t border-border">
              <Button size="sm" className="w-full" onClick={() => onSave(col)} disabled={items.length === 0 || savingId === col.id}>
                {savingId === col.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {col.paper_id ? 'อัปเดตชุดใน SocialBank' : 'บันทึกเป็นชุดข้อสอบ'}
              </Button>
            </div>
          </div>
        )
      })}
      <button
        onClick={onAdd}
        className="w-48 shrink-0 rounded-xl border-2 border-dashed border-gold-300 text-gold-700 hover:bg-gold-50 flex flex-col items-center justify-center gap-1 text-sm"
      >
        <Plus /> เพิ่ม EP
      </button>
    </div>
  )
}
