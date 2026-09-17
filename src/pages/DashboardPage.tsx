import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingBlock } from '@/components/ui/spinner'
import { useAllItems } from '@/hooks/useItems'
import { useSchools } from '@/hooks/useSchools'
import { STRANDS, STRAND_COLORS, YEARS } from '@/lib/vocab'
import { supabase } from '@/lib/supabase'
import { Database, GraduationCap as SchoolIcon, CalendarDays, FileText } from 'lucide-react'

function heatColor(pct: number) {
  if (pct >= 40) return { bg: '#b91c1c', text: '#fff' } // แดงเข้ม
  if (pct >= 25) return { bg: '#fca5a5', text: '#7f1d1d' } // แดงอ่อน
  if (pct >= 15) return { bg: '#fde68a', text: '#78350f' } // เหลือง
  return { bg: '#ffffff', text: '#94a3b8' } // ขาว
}

export default function DashboardPage() {
  const { items, loading } = useAllItems()
  const { schools, loading: schoolsLoading } = useSchools()
  const navigate = useNavigate()
  const [paperCount, setPaperCount] = React.useState<number | null>(null)
  const printRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    supabase
      .from('papers')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setPaperCount(count ?? 0))
  }, [])

  const activeSchools = schools.filter((s) => s.is_active)

  // ----- Heatmap: strand (row) x school (col) -> % ของข้อในสาระนั้น เทียบกับข้อทั้งหมดของโรงเรียนนั้น
  const heatmap = React.useMemo(() => {
    const bySchoolTotal = new Map<string, number>()
    const bySchoolStrand = new Map<string, number>()
    for (const it of items) {
      if (!it.school) continue
      bySchoolTotal.set(it.school, (bySchoolTotal.get(it.school) ?? 0) + 1)
      const key = `${it.school}::${it.strand}`
      bySchoolStrand.set(key, (bySchoolStrand.get(key) ?? 0) + 1)
    }
    return { bySchoolTotal, bySchoolStrand }
  }, [items])

  const top15Subtopics = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const it of items) {
      if (!it.subtopic) continue
      counts.set(it.subtopic, (counts.get(it.subtopic) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([subtopic, count]) => ({ subtopic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
  }, [items])

  const yearlyTrend = React.useMemo(() => {
    return YEARS.map((y) => {
      const row: Record<string, number | string> = { year: `ปี ${y}` }
      for (const s of STRANDS) {
        row[s] = items.filter((it) => it.year === y && it.strand === s).length
      }
      return row
    })
  }, [items])

  const totalYears = new Set(items.map((it) => it.year)).size

  const handleGoToBank = (schoolCode: string, strand: string) => {
    navigate(`/items?school=${encodeURIComponent(schoolCode)}&strand=${encodeURIComponent(strand)}`)
  }

  const handlePrintHeatmap = () => {
    const style = document.createElement('style')
    style.id = 'a3-print-style'
    style.innerHTML = `@page { size: A3 landscape; margin: 10mm; }`
    document.head.appendChild(style)
    window.print()
    setTimeout(() => style.remove(), 500)
  }

  if (loading || schoolsLoading) return <LoadingBlock />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-xl font-bold text-navy-800">แดชบอร์ด</h1>
          <p className="text-sm text-muted-foreground">ภาพรวมคลังข้อสอบสังคมศึกษา</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <SummaryCard icon={Database} label="จำนวนข้อทั้งหมด" value={items.length.toLocaleString()} color="navy" />
        <SummaryCard icon={SchoolIcon} label="จำนวนโรงเรียน" value={activeSchools.length.toString()} color="orange" />
        <SummaryCard icon={CalendarDays} label="จำนวนปี" value={totalYears.toString()} color="navy" />
        <SummaryCard icon={FileText} label="ชุดที่ออกแล้ว" value={(paperCount ?? 0).toString()} color="orange" />
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Master Heatmap: สาระ × โรงเรียน (% ของข้อในสาระนั้นต่อข้อทั้งหมดของโรงเรียน)</CardTitle>
          <Button variant="outline" size="sm" onClick={handlePrintHeatmap} className="no-print">
            <Printer className="h-4 w-4" /> พิมพ์ Heatmap (A3 แนวนอน)
          </Button>
        </CardHeader>
        <CardContent>
          <div ref={printRef} className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white text-left px-3 py-2 border border-border font-semibold text-navy-800">
                    สาระ \ โรงเรียน
                  </th>
                  {activeSchools.map((s) => (
                    <th key={s.code} className="px-2 py-2 border border-border text-navy-800 font-medium min-w-[90px]">
                      {s.name_th}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STRANDS.map((strand) => (
                  <tr key={strand}>
                    <td className="sticky left-0 bg-white px-3 py-2 border border-border font-medium text-navy-800 whitespace-nowrap">
                      {strand}
                    </td>
                    {activeSchools.map((s) => {
                      const total = heatmap.bySchoolTotal.get(s.code) ?? 0
                      const count = heatmap.bySchoolStrand.get(`${s.code}::${strand}`) ?? 0
                      const pct = total > 0 ? (count / total) * 100 : 0
                      const { bg, text } = heatColor(pct)
                      return (
                        <td
                          key={s.code}
                          className="border border-border text-center cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ background: bg, color: text }}
                          onClick={() => handleGoToBank(s.code, strand)}
                          title={`${count} ข้อ จาก ${total} ข้อ`}
                        >
                          {total > 0 ? `${pct.toFixed(0)}%` : '-'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground no-print">
            <LegendDot color="#b91c1c" label=">= 40%" />
            <LegendDot color="#fca5a5" label="25-39%" />
            <LegendDot color="#fde68a" label="15-24%" />
            <LegendDot color="#ffffff" border label="< 15%" />
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6 no-print">
        <Card>
          <CardHeader>
            <CardTitle>Top 15 หัวข้อย่อยที่ออกบ่อยที่สุด</CardTitle>
          </CardHeader>
          <CardContent className="h-[420px]">
            {top15Subtopics.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top15Subtopics} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="subtopic"
                    width={140}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>เทรนด์รายปีแยกตามสาระ (ปี 62-68)</CardTitle>
          </CardHeader>
          <CardContent className="h-[420px]">
            {items.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  {STRANDS.map((s) => (
                    <Line key={s} type="monotone" dataKey={s} stroke={STRAND_COLORS[s]} strokeWidth={2} dot={{ r: 2 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: 'navy' | 'orange'
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-4">
        <div
          className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
            color === 'navy' ? 'bg-navy-50 text-navy-600' : 'bg-orange-50 text-orange-600'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-navy-800 leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function LegendDot({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-3 w-3 rounded-sm inline-block"
        style={{ background: color, border: border ? '1px solid #cbd5e1' : undefined }}
      />
      {label}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      ยังไม่มีข้อมูลข้อสอบ — ไปที่หน้า "นำเข้าข้อมูล" เพื่อเริ่มนำเข้าคลังข้อสอบจริง
    </div>
  )
}
