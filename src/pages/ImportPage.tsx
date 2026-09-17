import * as React from 'react'
import { UploadCloud, Download, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { IMPORT_TEMPLATE_COLUMNS } from '@/lib/vocab'
import {
  buildTemplateTSV,
  parseTSV,
  validateRows,
  toItemInsertPayload,
  type ImportRow,
  type RowSeverity,
} from '@/lib/importValidate'

const severityStyle: Record<RowSeverity, string> = {
  green: 'bg-green-50',
  yellow: 'bg-yellow-50',
  orange: 'bg-orange-50',
  red: 'bg-red-50',
}

const severityLabel: Record<RowSeverity, string> = {
  green: 'ผ่าน',
  yellow: 'มีข้อสังเกต',
  orange: 'นอก Controlled Vocabulary',
  red: 'ซ้ำ/ข้อมูลไม่ครบ',
}

export default function ImportPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [raw, setRaw] = React.useState('')
  const [rows, setRows] = React.useState<ImportRow[] | null>(null)
  const [checking, setChecking] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const onFile = async (file: File) => {
    const text = await file.text()
    setRaw(text)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  const downloadTemplate = () => {
    const blob = new Blob([buildTemplateTSV()], { type: 'text/tab-separated-values;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'socialbank_import_template.tsv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const check = async () => {
    if (!raw.trim()) {
      toast('กรุณาวางข้อมูลหรืออัปโหลดไฟล์ก่อน', 'error')
      return
    }
    setChecking(true)
    const { rows: parsed } = parseTSV(raw)
    const ids = parsed.map((r) => r.item_id).filter(Boolean)
    let existing = new Set<string>()
    if (ids.length > 0) {
      const { data } = await supabase.from('items').select('item_id').in('item_id', ids)
      existing = new Set((data ?? []).map((d) => d.item_id))
    }
    const validated = validateRows(parsed, existing)
    setRows(validated)
    setChecking(false)
  }

  const updateCell = (rowIndex: number, key: string, value: string) => {
    setRows((prev) => {
      if (!prev) return prev
      const next = prev.map((r) => (r.rowIndex === rowIndex ? { ...r, data: { ...r.data, [key]: value } } : r))
      // re-validate after edit
      const ids = next.map((r) => r.data.item_id).filter(Boolean)
      const dupSet = new Set(ids.filter((id, i) => ids.indexOf(id) !== i))
      return next.map((r) => {
        if (dupSet.has(r.data.item_id) && r.severity !== 'red') {
          return { ...r, severity: 'red' as RowSeverity, issues: [...r.issues, 'item_id ซ้ำกันเอง'] }
        }
        return r
      })
    })
  }

  const doImport = async (onlyPassed: boolean) => {
    if (!rows) return
    const toImport = onlyPassed ? rows.filter((r) => r.severity === 'green') : rows
    if (toImport.length === 0) {
      toast('ไม่มีแถวที่จะนำเข้า', 'error')
      return
    }
    setImporting(true)
    const payload = toImport.map((r) => toItemInsertPayload(r.data, user?.id))
    const { error } = await supabase.from('items').insert(payload)
    setImporting(false)
    if (error) {
      toast(`นำเข้าไม่สำเร็จ: ${error.message}`, 'error')
      return
    }
    toast(`นำเข้าสำเร็จ ${toImport.length} ข้อ`, 'success')
    setRows(null)
    setRaw('')
  }

  const summary = React.useMemo(() => {
    if (!rows) return null
    const counts: Record<RowSeverity, number> = { green: 0, yellow: 0, orange: 0, red: 0 }
    rows.forEach((r) => counts[r.severity]++)
    return counts
  }, [rows])

  const problemCount = summary ? summary.yellow + summary.orange + summary.red : 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-navy-800">นำเข้าข้อมูล</h1>
        <p className="text-sm text-muted-foreground">วางข้อมูล TSV หรืออัปโหลดไฟล์ .tsv / .csv ตามเทมเพลต 21 คอลัมน์</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ขั้นตอนที่ 1: นำเข้าข้อมูลดิบ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={8}
            placeholder="วางข้อมูล TSV ที่นี่ (คั่นด้วย Tab) แถวแรกเป็นหัวตาราง..."
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex">
              <Button variant="outline" type="button" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud className="h-4 w-4" /> อัปโหลดไฟล์ .tsv / .csv
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".tsv,.csv,text/tab-separated-values,text/csv"
                className="hidden"
                onChange={onFileChange}
              />
            </label>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4" /> ดาวน์โหลดเทมเพลต TSV (21 คอลัมน์)
            </Button>
            <Button onClick={check} disabled={checking}>
              {checking && <Loader2 className="h-4 w-4 animate-spin" />}
              ตรวจสอบก่อนนำเข้า
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            คอลัมน์ที่ต้องมี: {IMPORT_TEMPLATE_COLUMNS.join(', ')}
          </p>
        </CardContent>
      </Card>

      {rows && summary && (
        <Card>
          <CardHeader>
            <CardTitle>ขั้นตอนที่ 2: ตรวจสอบและแก้ไขก่อนนำเข้า</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="success">ผ่าน {summary.green} แถว</Badge>
              <Badge variant="warning">มีข้อสังเกต {summary.yellow} แถว</Badge>
              <Badge variant="warning">นอกรายการ {summary.orange} แถว</Badge>
              <Badge variant="danger">ซ้ำ/ไม่ครบ {summary.red} แถว</Badge>
              <span className="text-sm text-muted-foreground ml-auto">
                ผ่าน {summary.green} แถว / มีปัญหา {problemCount} แถว จากทั้งหมด {rows.length} แถว
              </span>
            </div>

            <div className="overflow-x-auto border border-border rounded-lg max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-navy-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">สถานะ</th>
                    <th className="px-2 py-2 text-left">item_id</th>
                    <th className="px-2 py-2 text-left">strand</th>
                    <th className="px-2 py-2 text-left">bloom</th>
                    <th className="px-2 py-2 text-left min-w-[200px]">stem</th>
                    <th className="px-2 py-2 text-left">answer</th>
                    <th className="px-2 py-2 text-left min-w-[220px]">ปัญหาที่พบ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowIndex} className={severityStyle[r.severity]}>
                      <td className="px-2 py-1.5">
                        <Badge
                          variant={
                            r.severity === 'green'
                              ? 'success'
                              : r.severity === 'red'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {severityLabel[r.severity]}
                        </Badge>
                      </td>
                      <EditableCell value={r.data.item_id} onChange={(v) => updateCell(r.rowIndex, 'item_id', v)} />
                      <EditableCell value={r.data.strand} onChange={(v) => updateCell(r.rowIndex, 'strand', v)} />
                      <EditableCell value={r.data.bloom} onChange={(v) => updateCell(r.rowIndex, 'bloom', v)} />
                      <EditableCell value={r.data.stem} onChange={(v) => updateCell(r.rowIndex, 'stem', v)} wide />
                      <EditableCell value={r.data.answer} onChange={(v) => updateCell(r.rowIndex, 'answer', v)} />
                      <td className="px-2 py-1.5 text-red-700">{r.issues.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => doImport(true)} disabled={importing || summary.green === 0}>
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle2 className="h-4 w-4" /> นำเข้าเฉพาะแถวที่ผ่าน ({summary.green})
              </Button>
              <Button variant="destructive" onClick={() => doImport(false)} disabled={importing}>
                นำเข้าทั้งหมด ({rows.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function EditableCell({
  value,
  onChange,
  wide,
}: {
  value: string
  onChange: (v: string) => void
  wide?: boolean
}) {
  return (
    <td className="px-1 py-1">
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-white border border-border rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-navy-500 ${
          wide ? 'w-64' : 'w-24'
        }`}
      />
    </td>
  )
}
