import { useGradeLevel } from '@/contexts/GradeLevelContext'
import { GradeBadge } from '@/components/GradeBadge'
import * as React from 'react'
import { RefreshCw, Users, ShoppingBag, BarChart3, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'
import { cleanStem } from '@/lib/labItem'
import { downloadText, toCsv } from '@/lib/examStudio'
import { formatDateTH } from '@/lib/utils'
import type { ExamAttemptRow, ItemRow, PaperRow, ParticipantType } from '@/types/database'

const GROUP_LABEL: Record<ParticipantType, string> = { student: 'นักเรียนในคอร์สหลัก', buyer: 'ผู้ซื้อทั่วไป (Public)' }

function stats(rows: ExamAttemptRow[]) {
  const done = rows.filter((r) => r.submitted_at && r.total)
  const pcts = done.map((r) => ((r.score ?? 0) / (r.total ?? 1)) * 100)
  return {
    n: done.length,
    avg: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0,
    max: pcts.length ? Math.max(...pcts) : 0,
    min: pcts.length ? Math.min(...pcts) : 0,
  }
}

// ผลสอบจากประตูจับเวลา: แยกคะแนน "ผู้ซื้อ" ออกจาก "นักเรียนในคอร์ส" แต่รวมสถิติความยากรายข้อ
export default function GateResultsPage() {
  const { gradeLevel } = useGradeLevel()
  const { toast } = useToast()
  const [papers, setPapers] = React.useState<PaperRow[]>([])
  const [paperId, setPaperId] = React.useState('')
  const [attempts, setAttempts] = React.useState<ExamAttemptRow[]>([])
  const [items, setItems] = React.useState<ItemRow[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    supabase
      .from('papers')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPapers((data ?? []) as PaperRow[]))
  }, [])

  const load = React.useCallback(async () => {
    if (!paperId) return
    setLoading(true)
    const paper = papers.find((p) => p.id === paperId)
    const [a, i] = await Promise.all([
      supabase.from('exam_attempts').select('*').eq('paper_id', paperId).order('started_at', { ascending: false }),
      supabase.from('items').select('*').in('item_id', paper?.item_ids ?? []),
    ])
    setLoading(false)
    if (a.error) return toast('ยังไม่มีตารางผลสอบ — รัน SQL migration ของ Time-Gate ก่อน', 'error')
    setAttempts((a.data ?? []) as ExamAttemptRow[])
    setItems((i.data ?? []) as ItemRow[])
  }, [paperId, papers, toast])
  React.useEffect(() => {
    load()
  }, [load])

  const paper = papers.find((p) => p.id === paperId)
  const byGroup = { student: attempts.filter((a) => a.participant_type === 'student'), buyer: attempts.filter((a) => a.participant_type === 'buyer') }
  const itemMap = new Map(items.map((it) => [it.item_id, it]))
  const itemStats = (paper?.item_ids ?? []).map((id, idx) => {
    let n = 0, c = 0
    for (const a of attempts) {
      if (!a.submitted_at || !(id in (a.results ?? {}))) continue
      n++
      if (a.results[id]) c++
    }
    return { no: idx + 1, id, item: itemMap.get(id), n, p: n ? c / n : null }
  })

  const refreshP = async () => {
    const { data, error } = await supabase.rpc('refresh_item_p_values', { p_min_answers: 5 })
    if (error) return toast(error.message, 'error')
    toast(`อัปเดตค่า p ของข้อสอบ ${data ?? 0} ข้อในคลังแล้ว (ใช้กับตัวกรอง "ข้อที่เด็กผิดบ่อย")`, 'success')
  }

  const exportCsv = () => {
    downloadText(
      toCsv([
        ['กลุ่ม', 'ชื่อ', 'รหัสนักเรียน/ติดต่อ', 'เริ่ม', 'ส่ง', 'คะแนน', 'เต็ม', 'ส่งเกินเวลา'],
        ...attempts.map((a) => [
          GROUP_LABEL[a.participant_type],
          a.participant_name ?? '',
          a.student_code ?? a.participant_contact ?? '',
          a.started_at,
          a.submitted_at ?? '',
          a.score ?? '',
          a.total ?? '',
          a.is_late ? 'ใช่' : '',
        ]),
      ]),
      `ผลสอบ-${paper?.paper_name ?? 'paper'}.csv`,
      'text/csv;charset=utf-8'
    )
  }

  // แสดงเฉพาะชุดของระดับชั้นที่เลือกบนแถบซ้าย (ชุดเก่าที่ไม่ระบุชั้น = ป.6)
  const gradePapers = papers.filter((p) => ((p.config as { gradeLevel?: string } | null)?.gradeLevel ?? 'ป.6') === gradeLevel)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-800">ผลสอบประตูจับเวลา <GradeBadge /></h1>
          <p className="text-sm text-muted-foreground">คะแนนแยกกลุ่ม ไม่ปนค่าเฉลี่ยคอร์ส · ความยากรายข้อรวมทุกกลุ่ม</p>
        </div>
        <div className="flex gap-2">
          <NativeSelect className="w-72" value={paperId} onChange={(e) => setPaperId(e.target.value)}>
            <option value="">— เลือกชุดข้อสอบ —</option>
            {gradePapers.map((p) => <option key={p.id} value={p.id}>{p.paper_name}</option>)}
          </NativeSelect>
          <Button variant="outline" onClick={refreshP} title="คำนวณ p-value จากผลสอบจริงกลับเข้าคลัง"><RefreshCw className="h-4 w-4" /> อัปเดตค่า p</Button>
        </div>
      </div>

      {loading && <LoadingBlock />}
      {paper && !loading && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {(['student', 'buyer'] as ParticipantType[]).map((g) => {
              const s = stats(byGroup[g])
              return (
                <Card key={g} className={g === 'buyer' ? 'border-gold-300' : ''}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">{g === 'student' ? <Users size={16} /> : <ShoppingBag size={16} />} {GROUP_LABEL[g]}</CardTitle>
                    <span className="text-xs text-muted-foreground">{s.n} คนที่ส่งแล้ว</span>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-2xl font-bold text-navy-800">{s.avg.toFixed(1)}%</p><p className="text-xs text-muted-foreground">เฉลี่ย</p></div>
                    <div><p className="text-2xl font-bold text-green-700">{s.max.toFixed(0)}%</p><p className="text-xs text-muted-foreground">สูงสุด</p></div>
                    <div><p className="text-2xl font-bold text-red-600">{s.min.toFixed(0)}%</p><p className="text-xs text-muted-foreground">ต่ำสุด</p></div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 size={16} /> ความยากรายข้อ (รวมทุกกลุ่ม)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">ข้อ</th><th>โจทย์</th><th>ตอบ (คน)</th><th>ตอบถูก</th></tr></thead>
                <tbody>
                  {itemStats.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-1 pr-2">{r.no}</td>
                      <td className="pr-2"><span className="line-clamp-1">{r.item ? cleanStem(r.item.stem) : r.id}</span></td>
                      <td>{r.n}</td>
                      <td className={r.p != null && r.p < 0.5 ? 'font-semibold text-red-600' : ''}>{r.p == null ? '-' : `${Math.round(r.p * 100)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>รายชื่อผู้เข้าสอบ</CardTitle>
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!attempts.length}><Download className="h-3 w-3" /> CSV</Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="py-1 pr-2 text-xs">{a.participant_type === 'buyer' ? '🛒' : '🎓'}</td>
                      <td className="pr-2">{a.participant_name ?? '-'}</td>
                      <td className="pr-2 text-xs text-muted-foreground">{a.student_code ?? a.participant_contact}</td>
                      <td className="pr-2 text-xs">{formatDateTH(a.started_at)}</td>
                      <td className="font-medium">{a.submitted_at ? `${a.score}/${a.total}` : 'ยังไม่ส่ง'}{a.is_late ? ' (เกินเวลา)' : ''}</td>
                    </tr>
                  ))}
                  {attempts.length === 0 && <tr><td className="py-4 text-center text-muted-foreground">ยังไม่มีผู้เข้าสอบชุดนี้</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
