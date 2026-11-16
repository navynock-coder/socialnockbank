import * as React from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Printer, FileDown, Loader2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { supabase } from '@/lib/supabase'
import { LAB_COURSE_LINE, LAB_LOGO_URL, TH_CH, choicesAreShort, strandCounts, strandMeta, toLabQuestions } from '@/lib/labDoc'
import '@/styles/labPrint.css'
import { getChoiceText, type GenerateResult, type GeneratedItem } from '@/lib/paperGenerator'
import { buildGeneratedExamDocxBlob, downloadBlob } from '@/lib/examDocx'
import type { PaperRow, ItemRow } from '@/types/database'

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
      difficultyWarning: null,
    })
    setLoadedName(paper.paper_name)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    if (!stateResult && selectedPaperId) loadPaper(selectedPaperId)
  }, [selectedPaperId, stateResult, loadPaper])

  const result = stateResult?.generatedResult ?? loadedResult
  const paperName = stateResult?.paperName ?? loadedName

  const [downloading, setDownloading] = React.useState(false)
  const handleDownloadDocx = async () => {
    if (!result || result.items.length === 0) return
    setDownloading(true)
    try {
      const blob = await buildGeneratedExamDocxBlob(paperName || 'ชุดข้อสอบ', result.items)
      downloadBlob(blob, `${paperName || 'ชุดข้อสอบ'}.docx`)
    } finally {
      setDownloading(false)
    }
  }

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

          <div className="flex justify-end gap-2 no-print my-3">
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> พิมพ์
            </Button>
            <Button variant="outline" onClick={handleDownloadDocx} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              ดาวน์โหลด Word (.docx)
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

function LabHead({ paperName, tag, isKey, count }: { paperName: string; tag: string; isKey?: boolean; count: number }) {
  return (
    <div className="lab-head">
      <img className="lab-logo" src={LAB_LOGO_URL} alt="" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ex">{paperName || 'ชุดข้อสอบ'}</div>
        <div className="sub">{[LAB_COURSE_LINE, `${count} ข้อ`].join(' · ')}</div>
      </div>
      <div className={isKey ? 'tag key' : 'tag'}>{tag}</div>
    </div>
  )
}

function LabFoot({ paperName, label }: { paperName: string; label: string }) {
  return (
    <div className="lab-foot">
      <span>{[paperName, label].filter(Boolean).join(' · ')}</span>
      <span>SOCIALNOCK · คลังข้อสอบ SocialBank</span>
    </div>
  )
}

// แม่แบบเดียวกับไฟล์ข้อสอบ/เฉลยที่ SOCIALNOCK LAB ส่งออก
function PrintSheet({ paperName, mode, items }: { paperName: string; mode: 'student' | 'answer'; items: GeneratedItem[] }) {
  const qs = toLabQuestions(items)
  const isKey = mode === 'answer'
  return (
    <div className="lab-doc">
      <img className="lab-wm" src={LAB_LOGO_URL} alt="" />
      <LabHead paperName={paperName} tag={isKey ? 'เฉลยสำหรับครู' : 'แบบทดสอบ'} isKey={isKey} count={qs.length} />
      {!isKey ? (
        <>
          <div className="lab-id">
            <span>ชื่อ–สกุล ......................................................................</span>
            <span>เลขที่ ..........</span>
            <span>ห้อง ..........</span>
            <div className="lab-score">
              <div className="l">คะแนน</div>
              <div className="box" />
              <div className="l">เต็ม {qs.length}</div>
            </div>
          </div>
          <div className="lab-howto">
            คำชี้แจง: ข้อสอบมี {qs.length} ข้อ ให้เลือกคำตอบที่ถูกที่สุดเพียงข้อเดียว แล้วกากบาท ✕ ทับตัวอักษรหน้าคำตอบ
          </div>
        </>
      ) : (
        <>
          <div className="lab-sec">ตารางวิเคราะห์ข้อสอบ</div>
          <div className="lab-blue">
            {strandCounts(qs).map(([s, n]) => {
              const m = strandMeta(s)
              return (
                <span key={s} style={{ borderColor: m?.color ?? '#9aa5b5' }}>
                  <b style={{ color: m?.color ?? '#4b5568' }}>{m?.code ?? 'อื่น ๆ'}</b> {s} {n} ข้อ
                </span>
              )
            })}
          </div>
        </>
      )}
      {qs.map((q) => (
        <div key={q.no} className="lab-q">
          <div className="lab-qt">
            <b>{q.no}.</b>
            <span>{q.stem}</span>
          </div>
          {q.mediaUrl && <img className="lab-img" src={q.mediaUrl} alt="" />}
          <div className={choicesAreShort(q.choices) ? 'lab-ch two' : 'lab-ch'}>
            {q.choices.map((c, j) => (
              <div key={j} className={isKey && j === q.answer ? 'ok' : ''}>
                <i>{TH_CH[j]}</i>
                <span>{c}</span>
              </div>
            ))}
          </div>
          {isKey && (q.explanation || q.trap) && (
            <div className="lab-why">
              {q.trap && <b>กับดัก: {q.trap} · </b>}
              {q.explanation}
            </div>
          )}
        </div>
      ))}
      {isKey && (
        <>
          <div className="lab-sec">สรุปเฉลย</div>
          <table className="lab-tbl">
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 44 }} />
              <col />
              <col style={{ width: 150 }} />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead>
              <tr><th>ข้อ</th><th>ตอบ</th><th>คำตอบที่ถูก</th><th>สาระ · หัวข้อ</th><th>รหัสข้อสอบ</th></tr>
            </thead>
            <tbody>
              {qs.map((q) => {
                const m = strandMeta(q.strand)
                return (
                  <tr key={q.no}>
                    <td>{q.no}</td>
                    <td className="a">{TH_CH[q.answer] ?? '-'}</td>
                    <td>{q.choices[q.answer] ?? ''}</td>
                    <td className="s">{[m?.code, q.topic].filter(Boolean).join(' · ') || '–'}</td>
                    <td className="w">{q.itemId}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
      <LabFoot paperName={paperName} label={isKey ? 'เฉลยสำหรับครู' : 'แบบทดสอบ'} />
    </div>
  )
}

function AnswerBubbleSheet({ paperName, items }: { paperName: string; items: GeneratedItem[] }) {
  return (
    <div className="lab-doc">
      <img className="lab-wm" src={LAB_LOGO_URL} alt="" />
      <LabHead paperName={paperName} tag="กระดาษคำตอบ" count={items.length} />
      <div className="lab-id">
        <span>ชื่อ–สกุล ......................................................................</span>
        <span>เลขที่ ..........</span>
        <span>ห้อง ..........</span>
        <div className="lab-score">
          <div className="l">คะแนน</div>
          <div className="box" />
          <div className="l">เต็ม {items.length}</div>
        </div>
      </div>
      <div className="lab-howto">ฝนหรือกากบาท ✕ ทับวงกลมของคำตอบที่เลือก ข้อละหนึ่งคำตอบ</div>
      <div className="lab-bubbles">
        {items.map((gi, idx) => (
          <div key={idx}>
            <b>{idx + 1}.</b>
            {TH_CH.slice(0, Math.max(4, gi.shuffle.order.length)).map((c) => (
              <i key={c}>{c}</i>
            ))}
          </div>
        ))}
      </div>
      <LabFoot paperName={paperName} label="กระดาษคำตอบ" />
    </div>
  )
}
