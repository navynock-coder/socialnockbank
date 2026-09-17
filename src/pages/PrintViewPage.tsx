import * as React from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { supabase } from '@/lib/supabase'
import { ANSWER_TH_LABEL } from '@/lib/vocab'
import { getChoiceText, type GenerateResult, type GeneratedItem } from '@/lib/paperGenerator'
import type { PaperRow, ItemRow } from '@/types/database'

const COURSE_NAME = 'คอร์สสอบเข้า ม.1 วิชาสังคมศึกษา — ครูน็อค'

export default function PrintViewPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const stateResult = (location.state as { generatedResult?: GenerateResult; paperName?: string } | null) ?? null

  const [papers, setPapers] = React.useState<PaperRow[]>([])
  const [selectedPaperId, setSelectedPaperId] = React.useState(searchParams.get('paperId') ?? '')
  const [loadedResult, setLoadedResult] = React.useState<GenerateResult | null>(null)
  const [loadedName, setLoadedName] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    supabase
      .from('papers')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPapers(data ?? []))
  }, [])

  const loadPaper = React.useCallback(async (paperId: string) => {
    if (!paperId) return
    setLoading(true)
    const { data: paper } = await supabase.from('papers').select('*').eq('id', paperId).single()
    if (!paper) {
      setLoading(false)
      return
    }
    const { data: itemRows } = await supabase.from('items').select('*').in('item_id', paper.item_ids)
    const byId = new Map((itemRows ?? []).map((it) => [it.item_id, it]))
    const config = (paper.config ?? {}) as { shuffleMap?: Record<string, { order: string[]; newAnswer: string }> }
    const items: GeneratedItem[] = paper.item_ids
      .map((id: string) => byId.get(id))
      .filter((it: ItemRow | undefined): it is ItemRow => !!it)
      .map((item: ItemRow) => ({
        item,
        shuffle: config.shuffleMap?.[item.item_id] ?? {
          order: ['A', 'B', 'C', 'D', 'E'].filter((k) => !!getChoiceText(item, k)),
          newAnswer: item.answer,
        },
      }))
    setLoadedResult({
      items,
      breakdown: [],
      avgDifficultyActual: 0,
      shortages: [],
      poolSize: 0,
    })
    setLoadedName(paper.paper_name)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    if (!stateResult && selectedPaperId) loadPaper(selectedPaperId)
  }, [selectedPaperId, stateResult, loadPaper])

  const result = stateResult?.generatedResult ?? loadedResult
  const paperName = stateResult?.paperName ?? loadedName

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-800">พิมพ์ชุดข้อสอบ</h1>
          <p className="text-sm text-muted-foreground">เลือกชุดข้อสอบที่บันทึกไว้ หรือมาจากหน้าออกชุดข้อสอบโดยตรง</p>
        </div>
        {!stateResult && (
          <NativeSelect
            className="max-w-xs"
            value={selectedPaperId}
            onChange={(e) => setSelectedPaperId(e.target.value)}
          >
            <option value="">— เลือกชุดข้อสอบที่บันทึกไว้ —</option>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.paper_name} ({p.total_items} ข้อ)
              </option>
            ))}
          </NativeSelect>
        )}
      </div>

      {loading && <LoadingBlock />}

      {!loading && !result && (
        <p className="text-sm text-muted-foreground no-print">ยังไม่ได้เลือกชุดข้อสอบ</p>
      )}

      {result && (
        <Tabs defaultValue="student">
          <TabsList className="no-print">
            <TabsTrigger value="student">ฉบับนักเรียน</TabsTrigger>
            <TabsTrigger value="answer">ฉบับเฉลยละเอียด</TabsTrigger>
            <TabsTrigger value="sheet">กระดาษคำตอบ</TabsTrigger>
          </TabsList>

          <div className="flex justify-end no-print my-3">
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> พิมพ์
            </Button>
          </div>

          <TabsContent value="student">
            <PrintSheet paperName={paperName} mode="student" items={result.items} />
          </TabsContent>
          <TabsContent value="answer">
            <PrintSheet paperName={paperName} mode="answer" items={result.items} />
          </TabsContent>
          <TabsContent value="sheet">
            <AnswerBubbleSheet paperName={paperName} items={result.items} />
          </TabsContent>
        </Tabs>
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

function PrintSheet({
  paperName,
  mode,
  items,
}: {
  paperName: string
  mode: 'student' | 'answer'
  items: GeneratedItem[]
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
          {mode === 'answer' && <p className="text-sm text-green-700 font-medium mt-1">ฉบับเฉลยละเอียด (สำหรับผู้สอนเท่านั้น)</p>}
        </div>

        <div className="space-y-6">
          {items.map((gi, idx) => (
            <div key={gi.item.id}>
              <p className="font-medium text-navy-900">
                ข้อ {idx + 1}. {gi.item.stem}
              </p>
              {gi.item.media_url && (
                <img
                  src={gi.item.media_url}
                  alt=""
                  className="mt-2 rounded border border-border"
                  style={{ maxWidth: '70%' }}
                />
              )}
              <div className="mt-2 space-y-1 pl-2">
                {gi.shuffle.order.map((originalKey, i) => {
                  const displayKey = ['A', 'B', 'C', 'D', 'E'][i]
                  const text = getChoiceText(gi.item, originalKey)
                  const isCorrect = mode === 'answer' && gi.shuffle.newAnswer === displayKey
                  return (
                    <p
                      key={displayKey}
                      className={isCorrect ? 'bg-green-100 rounded px-2 py-0.5 font-medium text-green-800' : ''}
                    >
                      {ANSWER_TH_LABEL[displayKey]}. {text}
                    </p>
                  )
                })}
              </div>
              {mode === 'answer' && (gi.item.explanation || gi.item.trap_type) && (
                <div className="mt-2 bg-gray-100 rounded p-3 text-sm text-navy-700">
                  {gi.item.trap_type && <p className="font-medium">กับดัก: {gi.item.trap_type}</p>}
                  {gi.item.explanation && <p className="mt-1 whitespace-pre-wrap">{gi.item.explanation}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AnswerBubbleSheet({ paperName, items }: { paperName: string; items: GeneratedItem[] }) {
  const cols = ['ก', 'ข', 'ค', 'ง', 'จ']
  return (
    <div className="bg-white rounded-lg border border-border p-8 relative overflow-hidden print:border-0">
      <Watermark />
      <div className="relative z-10">
        <div className="text-center mb-6 border-b-2 border-navy-800 pb-4">
          <h2 className="font-bold text-lg text-navy-900">{COURSE_NAME}</h2>
          <p className="font-semibold text-navy-800 mt-1">{paperName} — กระดาษคำตอบ</p>
          <div className="flex justify-center gap-8 mt-3 text-sm">
            <span>ชื่อ-สกุล ....................................................</span>
            <span>เลขที่ .............</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm">
          {items.map((_, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-6 text-right font-medium">{idx + 1}.</span>
              {cols.map((c) => (
                <span
                  key={c}
                  className="h-6 w-6 rounded-full border border-navy-700 flex items-center justify-center text-xs"
                >
                  {c}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
