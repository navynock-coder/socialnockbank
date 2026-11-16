import { CheckCircle2, Printer, Target, TrendingDown, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ANSWER_TH_LABEL, STRAND_COLORS, type Strand } from '@/lib/vocab'
import { cleanStem } from '@/lib/labItem'
import type { GateReport } from '@/lib/gateApi'
import { cn } from '@/lib/utils'

// ใบสรุปผลอัตโนมัติหลังสอบ (Instant Score Analytics Report)
export function ScoreReport({ report, onBack }: { report: GateReport; onBack?: () => void }) {
  const pct = report.total ? Math.round((report.score / report.total) * 100) : 0
  const strands = report.strands
    .map((s) => ({ ...s, pct: s.total ? Math.round((s.correct / s.total) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct)
  const weak = strands.filter((s) => s.pct < 60)
  const wrong = report.items.filter((it) => !it.correct)
  const topicMiss = new Map<string, number>()
  wrong.forEach((it) => it.topic && topicMiss.set(it.topic, (topicMiss.get(it.topic) ?? 0) + 1))
  const topTopics = [...topicMiss.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-navy-800 to-navy-600 p-6 text-white">
        <p className="text-sm text-gold-300">{report.paper_name}</p>
        <div className="mt-2 flex flex-wrap items-end gap-6">
          <div>
            <p className="text-5xl font-bold text-gold-400">
              {report.score}
              <span className="text-2xl text-white">/{report.total}</span>
            </p>
            <p className="text-sm">คิดเป็น {pct}%{report.is_late ? ' · ส่งเกินเวลา' : ''}</p>
          </div>
          {report.group_avg_percent != null && (
            <div className="text-sm">
              <p className="text-navy-100">ค่าเฉลี่ยกลุ่ม{report.participant_type === 'buyer' ? 'ผู้ทำข้อสอบทั่วไป' : 'นักเรียนในคอร์ส'}</p>
              <p className="text-2xl font-semibold">{report.group_avg_percent}%</p>
            </div>
          )}
          <div className="ml-auto flex gap-2 no-print">
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> พิมพ์ / PDF</Button>
            {onBack && <Button className="bg-gold-500 text-navy-900 hover:bg-gold-400" onClick={onBack}>กลับหน้ารายการชุด</Button>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-navy-800"><Target size={16} /> ผลรายสาระ</h3>
          <div className="space-y-2">
            {strands.map((s) => (
              <div key={s.strand}>
                <div className="flex justify-between text-sm">
                  <span>{s.strand}</span>
                  <span className={cn('font-medium', s.pct < 60 ? 'text-red-600' : 'text-green-700')}>{s.correct}/{s.total} ({s.pct}%)</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100">
                  <div className="h-2.5 rounded-full" style={{ width: `${s.pct}%`, background: STRAND_COLORS[s.strand as Strand] ?? '#1e3a5f' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-navy-800"><TrendingDown size={16} /> จุดที่ควรทบทวน</h3>
          {weak.length === 0 ? (
            <p className="text-sm text-green-700">ทำได้ดีทุกสาระ (เกิน 60%) — ทบทวนข้อที่ผิดด้านล่างเพื่อเก็บคะแนนเต็ม</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {weak.map((s) => (
                <li key={s.strand}><b>{s.strand}</b> ได้ {s.pct}% — ผิด {s.total - s.correct} จาก {s.total} ข้อ</li>
              ))}
            </ul>
          )}
          {topTopics.length > 0 && (
            <p className="mt-3 text-sm text-navy-700">หัวข้อที่พลาดบ่อย: {topTopics.map(([t, n]) => `${t} (${n})`).join(', ')}</p>
          )}
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 font-semibold text-navy-800">เฉลยและคำอธิบายรายข้อ</h3>
        <div className="space-y-4">
          {report.items.map((it) => (
            <div key={it.item_id} className={cn('rounded-lg border p-3', it.correct ? 'border-green-200' : 'border-red-200 bg-red-50/30')}>
              <p className="flex items-start gap-2 font-medium text-navy-900">
                {it.correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                <span>ข้อ {it.no}. {cleanStem(it.stem)}</span>
              </p>
              {it.media_url && <img src={it.media_url} alt="" className="mt-2 max-w-[70%] rounded border" />}
              <div className="mt-2 space-y-0.5 pl-6 text-sm">
                {Object.entries(it.choices).map(([k, t]) => (
                  <p
                    key={k}
                    className={cn(
                      'rounded px-2',
                      k === it.answer && 'bg-green-100 font-medium text-green-800',
                      k === it.chosen && k !== it.answer && 'bg-red-100 text-red-700 line-through'
                    )}
                  >
                    {ANSWER_TH_LABEL[k]}. {t}
                    {k === it.chosen ? '  ← คำตอบของคุณ' : ''}
                  </p>
                ))}
                {!it.chosen && <p className="px-2 text-xs text-red-600">ไม่ได้ตอบข้อนี้</p>}
              </div>
              {it.explanation && <p className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-2 pl-6 text-sm text-navy-700">{it.explanation}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
