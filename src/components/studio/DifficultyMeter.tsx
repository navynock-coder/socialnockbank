import { DIFFICULTY_BANDS, DIFFICULTY_BAND_COLORS, type DifficultyBand } from '@/lib/vocab'
import { difficultyMeter } from '@/lib/examStudio'
import type { ItemRow } from '@/types/database'
import { cn } from '@/lib/utils'

// แถบสัดส่วน ง่าย : กลาง : ยาก แบบเรียลไทม์ (เทียบกับเป้าหมายของ Blueprint ถ้ามี)
export function DifficultyMeter({
  items,
  target,
  compact,
  className,
  label = 'Difficulty Meter',
}: {
  items: ItemRow[]
  target?: Record<DifficultyBand, number> | null
  compact?: boolean
  className?: string
  label?: string
}) {
  const m = difficultyMeter(items)
  return (
    <div className={cn('space-y-1.5', className)}>
      {!compact && (
        <div className="flex items-center justify-between text-xs text-navy-700">
          <span className="font-semibold">{label}</span>
          <span>
            ในชุด {m.total} ข้อ · เฉลี่ย {m.avgStars.toFixed(1)} ★
          </span>
        </div>
      )}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100" role="img" aria-label="สัดส่วนความยาก">
        {DIFFICULTY_BANDS.map((b) =>
          m.pct[b] > 0 ? (
            <div key={b} style={{ width: `${m.pct[b]}%`, background: DIFFICULTY_BAND_COLORS[b] }} title={`${b} ${m.pct[b]}%`} />
          ) : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-navy-700">
        {DIFFICULTY_BANDS.map((b) => (
          <span key={b} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: DIFFICULTY_BAND_COLORS[b] }} />
            {b} {m.counts[b]} ({m.pct[b]}%)
            {target && (
              <span className={cn('text-muted-foreground', Math.abs(m.pct[b] - target[b]) > 10 && m.total > 0 && 'text-red-600 font-medium')}>
                / เป้า {target[b]}%
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
