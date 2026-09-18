import * as React from 'react'
import { Printer, FileStack, FileDown, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { useAllItems } from '@/hooks/useItems'
import { useSchools } from '@/hooks/useSchools'
import { ANSWER_TH_LABEL, STRANDS } from '@/lib/vocab'
import { getChoiceText } from '@/lib/paperGenerator'
import { buildExamDocxBlob, downloadBlob } from '@/lib/examDocx'
import type { ItemRow } from '@/types/database'

const COURSE_NAME = 'คอร์สสอบเข้า ม.1 วิชาสังคมศึกษา — ครูน็อค'
const ANSWER_KEYS = ['A', 'B', 'C', 'D', 'E'] as const

// เรียงข้อตามลำดับ "สาระ" ตามที่กำหนดในระบบ แล้วค่อยเรียงตาม item_id ภายในสาระเดียวกัน
// เพื่อจำลองรูปแบบข้อสอบต้นฉบับที่มักแบ่งเป็นหมวดสาระต่อเนื่องกัน
function sortForExam(items: ItemRow[]): ItemRow[] {
  const strandOrder = new Map<string, number>(STRANDS.map((s, i) => [s as string, i]))
  return [...items].sort((a, b) => {
    const sa = strandOrder.get(a.strand) ?? 999
    const sb = strandOrder.get(b.strand) ?? 999
    if (sa !== sb) return sa - sb
    return a.item_id.localeCompare(b.item_id)
  })
}

export default function ExportExamPage() {
  const { items, loading } = useAllItems()
  const { schools, loading: schoolsLoading } = useSchools()

  const [school, setSchool] = React.useState('')
  const [year, setYear] = React.useState('')
  const [downloading, setDownloading] = React.useState(false)

  const years = React.useMemo(
    () => Array.from(new Set(items.map((i) => i.year))).sort((a, b) => b - a),
    [items]
  )

  const examItems = React.useMemo(() => {
    if (!school || !year) return []
    return sortForExam(items.filter((it) => it.school === school && it.year === Number(year)))
  }, [items, school, year])

  const schoolName = schools.find((s) => s.code === school)?.name_th ?? school
  const paperName = school && year ? `ข้อสอบต้นฉบับ ${schoolName} ปี ${year} (${examItems.length} ข้อ)` : ''

  const handlePrint = () => window.print()

  const handleDownloadDocx = async () => {
    if (examItems.length === 0) return
    setDownloading(true)
    try {
      const blob = await buildExamDocxBlob(paperName, examItems)
      downloadBlob(blob, `${schoolName}_ปี${year}_ข้อสอบต้นฉบับ.docx`)
    } finally {
      setDownloading(false)
    }
  }

  if (loading || schoolsLoading) return <LoadingBlock />

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-800 flex items-center gap-2">
            <FileStack className="h-5 w-5" /> ข้อสอบต้นฉบับ ตามโรงเรียน/ปี
          </h1>
          <p className="text-sm text-muted-foreground">
            รวบรวมข้อสอบทุกข้อในคลังของโรงเรียนและปีที่เลือก มาจัดเป็นชุดข้อสอบพร้อมพิมพ์ (เหมือนชุดข้อสอบจริงของปีนั้น)
          </p>
        </div>
      </div>

      <Card className="no-print">
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">โรงเรียน</label>
            <NativeSelect value={school} onChange={(e) => setSchool(e.target.value)} className="min-w-[220px]">
              <option value="">— เลือกโรงเรียน —</option>
              {schools.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name_th}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">ปี พ.ศ.</label>
            <NativeSelect value={year} onChange={(e) => setYear(e.target.value)} className="min-w-[140px]">
              <option value="">— เลือกปี —</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  ปี {y}
                </option>
              ))}
            </NativeSelect>
          </div>
          {school && year && (
            <>
              <Button onClick={handlePrint} disabled={examItems.length === 0}>
                <Printer className="h-4 w-4" /> พิมพ์ / บันทึกเป็น PDF
              </Button>
              <Button variant="outline" onClick={handleDownloadDocx} disabled={examItems.length === 0 || downloading}>
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                ดาวน์โหลด Word (.docx)
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {school && year && examItems.length === 0 && (
        <p className="text-sm text-muted-foreground no-print">
          ไม่พบข้อสอบของ {schoolName} ปี {year} ในคลัง
        </p>
      )}

      {school && year && examItems.length > 0 && (
        <>
          <ExamSheet paperName={paperName} mode="student" items={examItems} />
          <div className="page-break" />
          <ExamSheet paperName={paperName} mode="answer" items={examItems} />
        </>
      )}
    </div>
  )
}

function Watermark() {
  return (
    <div
      className="pointer-events-none select-none absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <span className="text-6xl font-bold text-navy-900/5 rotate-[-20deg] whitespace-nowrap">
        สังคมศึกษา ครูน็อค
      </span>
    </div>
  )
}

function ExamSheet({
  paperName,
  mode,
  items,
}: {
  paperName: string
  mode: 'student' | 'answer'
  items: ItemRow[]
}) {
  return (
    <div className="bg-white rounded-lg border border-border p-8 md:p-10 relative overflow-hidden print:border-0 print:rounded-none text-[16px] leading-relaxed">
      <Watermark />
      <div className="relative z-10">
        <div className="text-center mb-6 border-b-2 border-navy-800 pb-4">
          <h2 className="font-bold text-lg text-navy-900">{COURSE_NAME}</h2>
          <p className="font-semibold text-navy-800 mt-1">{paperName}</p>
          {mode === 'student' && (
            <div className="flex justify-center gap-8 mt-3 text-sm">
              <span>ชื่อ-สกุล ....................................................</span>
              <span>เลขที่ .............</span>
              <span>เวลาสอบ .............. นาที</span>
            </div>
          )}
          {mode === 'answer' && (
            <p className="text-sm text-green-700 font-medium mt-1">ฉบับเฉลยละเอียด (สำหรับผู้สอนเท่านั้น)</p>
          )}
        </div>

        <div className="space-y-6">
          {items.map((item, idx) => (
            <div key={item.id}>
              <p className="font-medium text-navy-900">
                ข้อ {idx + 1}. {item.stem}
              </p>
              {item.media_url && (
                <img src={item.media_url} alt="" className="mt-2 rounded border border-border" style={{ maxWidth: '70%' }} />
              )}
              <div className="mt-2 space-y-1 pl-2">
                {ANSWER_KEYS.map((key) => {
                  const text = getChoiceText(item, key)
                  if (!text) return null
                  const isCorrect = mode === 'answer' && item.answer === key
                  return (
                    <p key={key} className={isCorrect ? 'bg-green-100 rounded px-2 py-0.5 font-medium text-green-800' : ''}>
                      {ANSWER_TH_LABEL[key]}. {text}
                    </p>
                  )
                })}
              </div>
              {mode === 'answer' && (item.explanation || item.trap_type) && (
                <div className="mt-2 bg-gray-100 rounded p-3 text-sm text-navy-700">
                  {item.trap_type && <p className="font-medium">กับดัก: {item.trap_type}</p>}
                  {item.explanation && <p className="mt-1 whitespace-pre-wrap">{item.explanation}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
