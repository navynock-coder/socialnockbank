import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCopy, FileDown, FileJson, Link2, Loader2, Printer, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, NativeSelect } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'
import { getChoiceText, shuffleChoicesFor, type GeneratedItem, type GenerateResult } from '@/lib/paperGenerator'
import { buildGeneratedExamDocxBlob, downloadBlob } from '@/lib/examDocx'
import { buildLabPayload, getLabWebhookUrl, labRowsToTsv, pushToLab, setLabWebhookUrl } from '@/lib/labBridge'
import { downloadText } from '@/lib/examStudio'
import type { ItemRow } from '@/types/database'
import type { EpColumn, StudioBoard } from './useStudioBoard'

function identity(item: ItemRow): GeneratedItem {
  return {
    item,
    shuffle: { order: ['A', 'B', 'C', 'D', 'E'].filter((k) => !!getChoiceText(item, k)), newAnswer: item.answer },
  }
}

// ระบบส่งออกครบวงจร: Word / PDF (ฉบับนักเรียน-เฉลย-กระดาษคำตอบ) / SOCIALNOCK LAB
export function ExportPanel({ board, itemMap }: { board: StudioBoard; itemMap: Map<string, ItemRow> }) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [colId, setColId] = React.useState(board.activeId)
  const [duration, setDuration] = React.useState(60)
  const [shuffle, setShuffle] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [webhook, setWebhook] = React.useState(getLabWebhookUrl)

  const col: EpColumn | undefined = board.columns.find((c) => c.id === colId) ?? board.columns[0]
  const items = React.useMemo(() => (col?.item_ids ?? []).map((id) => itemMap.get(id)).filter((x): x is ItemRow => !!x), [col, itemMap])
  const title = col ? [board.course_code, col.set_code, col.title].filter(Boolean).join(' ') : ''

  // สลับตัวเลือกครั้งเดียวต่อการเลือก เพื่อให้ Word/PDF/Lab ใช้ลำดับเดียวกัน
  const generated = React.useMemo<GeneratedItem[]>(
    () => items.map((it) => (shuffle ? { item: it, shuffle: shuffleChoicesFor(it) } : identity(it))),
    [items, shuffle]
  )

  const meta = () => ({
    paper_id: col?.paper_id ?? null,
    title,
    course_code: board.course_code || null,
    set_code: col?.set_code ?? null,
    duration_minutes: duration,
  })

  const docx = async () => {
    setBusy('docx')
    try {
      const blob = await buildGeneratedExamDocxBlob(title, generated, { durationMinutes: duration, answerSheet: true })
      downloadBlob(blob, `${title}.docx`)
    } finally {
      setBusy(null)
    }
  }

  const pdf = () => {
    const result: GenerateResult = { items: generated, breakdown: [], avgDifficultyActual: 0, shortages: [], poolSize: 0, difficultyWarning: null }
    navigate('/print', { state: { generatedResult: result, paperName: title } })
  }

  const labJson = () => {
    downloadText(JSON.stringify(buildLabPayload(meta(), generated), null, 2), `${title}.lab.json`, 'application/json')
  }

  const labTsv = async () => {
    try {
      await navigator.clipboard.writeText(labRowsToTsv(buildLabPayload(meta(), generated).rows))
      toast('คัดลอกแล้ว — วางลงชีต "SOCIALNOCK เฉลยจากฟอร์ม" ที่เซลล์ A1 ได้เลย', 'success')
    } catch {
      toast('คัดลอกไม่สำเร็จ', 'error')
    }
  }

  const push = async () => {
    if (!webhook) return toast('ใส่ URL Webhook ของ Lab ก่อน', 'error')
    setLabWebhookUrl(webhook)
    setBusy('push')
    const r = await pushToLab(webhook, buildLabPayload(meta(), generated))
    setBusy(null)
    toast(r.message, r.ok ? 'success' : 'error')
    if (r.ok && col?.paper_id) {
      await supabase.from('papers').update({ lab_synced_at: new Date().toISOString() }).eq('id', col.paper_id)
    }
  }

  const gateUrl = `${window.location.origin}/gate`

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle>เลือกชุดที่จะส่งออก</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <NativeSelect value={col?.id ?? ''} onChange={(e) => setColId(e.target.value)}>
            {board.columns.map((c) => (
              <option key={c.id} value={c.id}>{c.set_code} {c.title} ({c.item_ids.length} ข้อ)</option>
            ))}
          </NativeSelect>
          <div>
            <Label>เวลาสอบ (นาที)</Label>
            <Input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <label className="flex items-center justify-between text-sm">
            สลับลำดับตัวเลือก
            <Switch checked={shuffle} onCheckedChange={setShuffle} />
          </label>
          <p className="text-xs text-muted-foreground">
            ชื่อชุด: <b className="text-navy-800">{title || '—'}</b> · {items.length} ข้อ · เลขข้อรันใหม่อัตโนมัติ (ตัดเลขข้อเดิมในโจทย์ออกแล้ว)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ไฟล์เอกสาร</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full" variant="outline" onClick={docx} disabled={!items.length || busy === 'docx'}>
            {busy === 'docx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Word (.docx) — นักเรียน + เฉลย + กระดาษคำตอบ
          </Button>
          <Button className="w-full" variant="outline" onClick={pdf} disabled={!items.length}>
            <Printer className="h-4 w-4" /> PDF / พิมพ์ (เลือก "บันทึกเป็น PDF")
          </Button>
        </CardContent>
      </Card>

      <Card className="border-gold-300">
        <CardHeader><CardTitle className="text-gold-700">ส่งเข้า SOCIALNOCK LAB</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full" variant="outline" onClick={labJson} disabled={!items.length}>
            <FileJson className="h-4 w-4" /> ดาวน์โหลด JSON (รูปแบบเฉลยจากฟอร์ม)
          </Button>
          <Button className="w-full" variant="outline" onClick={labTsv} disabled={!items.length}>
            <ClipboardCopy className="h-4 w-4" /> คัดลอกเป็นตารางไปวางในชีต
          </Button>
          <Label className="pt-2">Webhook Admin Store ของ Lab</Label>
          <Input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
          <Button className="w-full bg-gold-500 hover:bg-gold-600 text-navy-900" onClick={push} disabled={!items.length || busy === 'push'}>
            {busy === 'push' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} สร้าง/อัปเดตชุดใน Lab
          </Button>
          <p className="flex items-center gap-1 pt-2 text-xs text-muted-foreground">
            <Link2 size={12} /> ลิงก์ประตูจับเวลา: <code className="text-navy-800">{gateUrl}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
