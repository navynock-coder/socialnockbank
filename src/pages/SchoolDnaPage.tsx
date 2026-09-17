import * as React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NativeSelect, Input, Label } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { useAllItems } from '@/hooks/useItems'
import { useSchools } from '@/hooks/useSchools'
import { STRANDS, STRAND_COLORS, BLOOMS } from '@/lib/vocab'

export default function SchoolDnaPage() {
  const { items, loading } = useAllItems()
  const { schools, loading: schoolsLoading } = useSchools()
  const [schoolCode, setSchoolCode] = React.useState('')
  const [examMinutes, setExamMinutes] = React.useState<Record<string, number>>({})

  const school = schools.find((s) => s.code === schoolCode)
  const schoolItems = React.useMemo(() => items.filter((it) => it.school === schoolCode), [items, schoolCode])
  const years = Array.from(new Set(schoolItems.map((it) => it.year))).sort()

  const strandPie = STRANDS.map((s) => ({
    strand: s,
    count: schoolItems.filter((it) => it.strand === s).length,
  })).filter((d) => d.count > 0)

  const bloomBar = BLOOMS.map((b) => ({
    bloom: b,
    count: schoolItems.filter((it) => it.bloom === b).length,
  }))

  const everyYearTopics = React.useMemo(() => {
    if (years.length === 0) return []
    const bySubtopic = new Map<string, Set<number>>()
    schoolItems.forEach((it) => {
      if (!it.subtopic) return
      if (!bySubtopic.has(it.subtopic)) bySubtopic.set(it.subtopic, new Set())
      bySubtopic.get(it.subtopic)!.add(it.year)
    })
    const threshold = years.length * 0.6
    return Array.from(bySubtopic.entries())
      .map(([subtopic, yearSet]) => ({ subtopic, count: yearSet.size, years: Array.from(yearSet).sort() }))
      .filter((r) => r.count >= threshold)
      .sort((a, b) => b.count - a.count)
  }, [schoolItems, years])

  const trapRanking = React.useMemo(() => {
    const counts = new Map<string, number>()
    schoolItems.forEach((it) => {
      if (!it.trap_type || it.trap_type === 'ไม่มีกับดัก') return
      counts.set(it.trap_type, (counts.get(it.trap_type) ?? 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([trap_type, count]) => ({ trap_type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
  }, [schoolItems])

  const avgDifficulty =
    schoolItems.length > 0
      ? schoolItems.reduce((s, it) => s + (it.difficulty ?? 3), 0) / schoolItems.length
      : 0

  const minutes = examMinutes[schoolCode] ?? 0
  const secPerItem = minutes > 0 && schoolItems.length > 0 ? (minutes * 60) / schoolItems.length : null

  if (loading || schoolsLoading) return <LoadingBlock />

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-800">School DNA Card</h1>
          <p className="text-sm text-muted-foreground">วิเคราะห์ลักษณะเฉพาะของข้อสอบแต่ละสนามสอบ</p>
        </div>
        <div className="flex gap-2">
          <NativeSelect className="max-w-xs" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)}>
            <option value="">— เลือกโรงเรียน —</option>
            {schools.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name_th}
              </option>
            ))}
          </NativeSelect>
          <Button variant="outline" onClick={() => window.print()} disabled={!schoolCode}>
            <Printer className="h-4 w-4" /> พิมพ์การ์ดนี้
          </Button>
          <Button variant="orange" onClick={() => window.print()} disabled={schools.length === 0}>
            <Printer className="h-4 w-4" /> พิมพ์ทุกโรงเรียน
          </Button>
        </div>
      </div>

      {!schoolCode && <p className="text-sm text-muted-foreground">กรุณาเลือกโรงเรียนเพื่อดูการ์ดวิเคราะห์</p>}

      {schoolCode && school && (
        <div className="bg-white rounded-xl border border-border p-6 space-y-6">
          <div className="text-center border-b border-border pb-4">
            <h2 className="text-xl font-bold text-navy-900">{school.name_th}</h2>
            <p className="text-sm text-muted-foreground">
              ปีที่มีข้อมูล: {years.join(', ') || '-'} · จำนวนข้อรวม {schoolItems.length} ข้อ
            </p>
          </div>

          {schoolItems.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">ยังไม่มีข้อสอบของโรงเรียนนี้ในคลัง</p>
          ) : (
            <>
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="h-64">
                  <p className="text-sm font-semibold text-navy-800 mb-2">สัดส่วน 5 สาระ</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={strandPie} dataKey="count" nameKey="strand" outerRadius={80} label={(e: any) => e.strand}>
                        {strandPie.map((d) => (
                          <Cell key={d.strand} fill={STRAND_COLORS[d.strand]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-64">
                  <p className="text-sm font-semibold text-navy-800 mb-2">สัดส่วน Bloom (จำ/เข้าใจ/วิเคราะห์)</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bloomBar}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bloom" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-navy-800 mb-2">
                    หัวข้อที่ออกทุกปี (≥ 60% ของปีที่มีข้อมูล)
                  </p>
                  <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-navy-50">
                      <tr>
                        <th className="px-2 py-2 text-left">หัวข้อย่อย</th>
                        <th className="px-2 py-2 text-right">จำนวนครั้ง</th>
                        <th className="px-2 py-2 text-left">ปีที่ออก</th>
                      </tr>
                    </thead>
                    <tbody>
                      {everyYearTopics.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center py-4 text-muted-foreground">
                            ไม่มีหัวข้อที่เข้าเกณฑ์
                          </td>
                        </tr>
                      )}
                      {everyYearTopics.map((t) => (
                        <tr key={t.subtopic} className="border-t border-border">
                          <td className="px-2 py-1.5">{t.subtopic}</td>
                          <td className="px-2 py-1.5 text-right">{t.count}</td>
                          <td className="px-2 py-1.5">{t.years.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <p className="text-sm font-semibold text-navy-800 mb-2">กับดักประจำสนาม (3 อันดับ)</p>
                  <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-navy-50">
                      <tr>
                        <th className="px-2 py-2 text-left">ประเภทกับดัก</th>
                        <th className="px-2 py-2 text-right">จำนวน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trapRanking.length === 0 && (
                        <tr>
                          <td colSpan={2} className="text-center py-4 text-muted-foreground">
                            ไม่มีข้อมูลกับดัก
                          </td>
                        </tr>
                      )}
                      {trapRanking.map((t) => (
                        <tr key={t.trap_type} className="border-t border-border">
                          <td className="px-2 py-1.5">{t.trap_type}</td>
                          <td className="px-2 py-1.5 text-right">{t.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 rounded-lg bg-navy-50 p-3 text-sm">
                    <p>
                      ความยากเฉลี่ยของสนามนี้: <span className="font-bold">{avgDifficulty.toFixed(2)}</span> / 5
                    </p>
                    <div className="flex items-center gap-2 mt-2 no-print">
                      <Label className="mb-0">เวลาสอบ (นาที)</Label>
                      <Input
                        type="number"
                        className="w-24"
                        value={examMinutes[schoolCode] ?? ''}
                        onChange={(e) =>
                          setExamMinutes((m) => ({ ...m, [schoolCode]: Number(e.target.value) }))
                        }
                      />
                    </div>
                    {secPerItem !== null && (
                      <p className="mt-1">
                        {schoolItems.length} ข้อ / {minutes} นาที ={' '}
                        <span className="font-bold">{secPerItem.toFixed(1)} วินาที/ข้อ</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
