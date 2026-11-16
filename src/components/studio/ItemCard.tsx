import { AlertTriangle, Check, Plus, Wand2, Star } from 'lucide-react'
import { STRAND_COLORS, type Strand } from '@/lib/vocab'
import { cleanStem, itemBase, itemCourseCode, itemSetCode } from '@/lib/labItem'
import type { DuplicateHit } from '@/lib/examStudio'
import type { ItemRow } from '@/types/database'
import { cn } from '@/lib/utils'

export function Stars({ n }: { n: number | null }) {
  const v = n ?? 0
  return (
    <span className="inline-flex" aria-label={`ความยาก ${v} ดาว`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={11} className={i <= v ? 'fill-gold-400 text-gold-500' : 'text-gray-300'} />
      ))}
    </span>
  )
}

// การ์ดข้อสอบสีตามสาระ — คลิกเพื่อเพิ่ม/เอาออกจาก EP ที่กำลังจัด
export function ItemCard({
  item,
  selectedIn,
  dupHits,
  onToggle,
  onRemix,
  onView,
}: {
  item: ItemRow
  selectedIn: string | null
  dupHits: DuplicateHit[]
  onToggle: () => void
  onRemix: () => void
  onView: () => void
}) {
  const color = STRAND_COLORS[item.strand as Strand] ?? '#64748b'
  const course = itemCourseCode(item)
  const set = itemSetCode(item)
  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-white p-3 pl-4 shadow-sm transition hover:shadow-md',
        selectedIn ? 'ring-2 ring-gold-400 border-gold-300' : 'border-border'
      )}
    >
      <span className="absolute left-0 top-0 h-full w-1.5 rounded-l-lg" style={{ background: color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded px-1.5 py-0.5 font-semibold text-white" style={{ background: color }}>
            {item.strand}
          </span>
          <Stars n={item.difficulty} />
          <span className="rounded bg-navy-50 px-1.5 py-0.5 text-navy-700">{item.bloom}</span>
          {item.is_remixed && <span className="rounded bg-purple-50 px-1.5 py-0.5 text-purple-700">ต่อยอด</span>}
          {item.p_value != null && item.p_value < 0.5 && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">ผิดบ่อย {Math.round(item.p_value * 100)}%</span>
          )}
        </div>
        <button
          onClick={onToggle}
          className={cn(
            'shrink-0 rounded-full p-1.5 transition',
            selectedIn ? 'bg-gold-400 text-navy-900' : 'bg-navy-50 text-navy-700 hover:bg-gold-100'
          )}
          title={selectedIn ? `อยู่ใน ${selectedIn} — คลิกเพื่อเอาออก` : 'เพิ่มลง EP ที่กำลังจัด'}
        >
          {selectedIn ? <Check size={14} /> : <Plus size={14} />}
        </button>
      </div>
      <button onClick={onView} className="mt-2 block w-full text-left text-sm text-navy-900 line-clamp-3">
        {cleanStem(item.stem)}
      </button>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">
          {item.item_id} · {itemBase(item)}
          {course ? ` · ${course}${set ? `/${set}` : ''}` : item.school ? ` · ${item.school} ${item.year}` : ''}
        </span>
        <button onClick={onRemix} className="inline-flex items-center gap-1 text-gold-700 hover:underline shrink-0">
          <Wand2 size={12} /> ต่อยอด
        </button>
      </div>
      {dupHits.length > 0 && (
        <div className="mt-2 flex items-start gap-1 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>เคยใช้แล้ว: {dupHits.slice(0, 2).map((h) => h.where).join(', ')}{dupHits.length > 2 ? ` +${dupHits.length - 2}` : ''}</span>
        </div>
      )}
      {selectedIn && <span className="absolute -top-2 right-8 rounded-full bg-gold-400 px-2 text-[10px] font-bold text-navy-900">{selectedIn}</span>}
    </div>
  )
}
