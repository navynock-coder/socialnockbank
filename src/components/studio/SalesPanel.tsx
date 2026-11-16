import * as React from 'react'
import { Download, KeyRound, Loader2, Package, Save, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, NativeSelect, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ACCESS_CODE_STATUS_LABEL, PAPER_VISIBILITIES, PAPER_VISIBILITY_LABEL } from '@/lib/vocab'
import { downloadText, generateAccessCodes, toCsv } from '@/lib/examStudio'
import { formatDateTH } from '@/lib/utils'
import type { CourseStudentRow, ExamAccessCodeRow, ExamBundleRow, PaperRow, PaperVisibility } from '@/types/database'

const MIGRATION_HINT = 'ฐานข้อมูลยังไม่รองรับการขาย — รัน supabase/migrations/20261116_exam_studio_time_gate.sql ใน Supabase SQL Editor ก่อน'

function friendly(msg: string) {
  return /column|relation|does not exist|schema cache/i.test(msg) ? MIGRATION_HINT : msg
}

type SaleFields = Pick<PaperRow, 'visibility' | 'price' | 'duration_minutes' | 'max_attempts' | 'valid_days' | 'is_published'>

// โหมดตั้งค่าการขาย & ออกรหัสเข้าสอบ (Monetization & Voucher Generator)
export function SalesPanel({ papers, reloadPapers }: { papers: PaperRow[]; reloadPapers: () => void }) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [edits, setEdits] = React.useState<Record<string, SaleFields>>({})
  const [savingPaper, setSavingPaper] = React.useState<string | null>(null)
  const [bundles, setBundles] = React.useState<ExamBundleRow[]>([])
  const [codes, setCodes] = React.useState<ExamAccessCodeRow[]>([])
  const [students, setStudents] = React.useState<CourseStudentRow[]>([])

  const loadAll = React.useCallback(async () => {
    const [b, c, s] = await Promise.all([
      supabase.from('exam_bundles').select('*').order('created_at', { ascending: false }),
      supabase.from('exam_access_codes').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('course_students').select('*').order('student_code'),
    ])
    setBundles((b.data ?? []) as ExamBundleRow[])
    setCodes((c.data ?? []) as ExamAccessCodeRow[])
    setStudents((s.data ?? []) as CourseStudentRow[])
  }, [])
  React.useEffect(() => {
    loadAll()
  }, [loadAll])

  const fieldsOf = (p: PaperRow): SaleFields =>
    edits[p.id] ?? {
      visibility: p.visibility ?? 'course',
      price: p.price ?? 0,
      duration_minutes: p.duration_minutes ?? 60,
      max_attempts: p.max_attempts ?? 1,
      valid_days: p.valid_days ?? 30,
      is_published: p.is_published ?? false,
    }
  const editPaper = (p: PaperRow, patch: Partial<SaleFields>) => setEdits((e) => ({ ...e, [p.id]: { ...fieldsOf(p), ...patch } }))

  const savePaper = async (p: PaperRow) => {
    setSavingPaper(p.id)
    const { error } = await supabase.from('papers').update(fieldsOf(p)).eq('id', p.id)
    setSavingPaper(null)
    if (error) return toast(friendly(error.message), 'error')
    setEdits((e) => {
      const n = { ...e }
      delete n[p.id]
      return n
    })
    toast('บันทึกการตั้งค่าชุดแล้ว', 'success')
    reloadPapers()
  }

  // ---------------- แพ็ก ----------------
  const [bTitle, setBTitle] = React.useState('')
  const [bPrice, setBPrice] = React.useState(0)
  const [bDays, setBDays] = React.useState(30)
  const [bPapers, setBPapers] = React.useState<string[]>([])
  const createBundle = async () => {
    if (!bTitle.trim() || bPapers.length === 0) return toast('ใส่ชื่อแพ็กและเลือกชุดอย่างน้อย 1 ชุด', 'error')
    const { error } = await supabase
      .from('exam_bundles')
      .insert({ title: bTitle.trim(), paper_ids: bPapers, price: bPrice, valid_days: bDays, is_active: true, user_id: user?.id })
    if (error) return toast(friendly(error.message), 'error')
    toast('สร้างแพ็กแล้ว', 'success')
    setBTitle('')
    setBPapers([])
    loadAll()
  }
  const toggleBundle = async (b: ExamBundleRow) => {
    const { error } = await supabase.from('exam_bundles').update({ is_active: !b.is_active }).eq('bundle_id', b.bundle_id)
    if (error) return toast(friendly(error.message), 'error')
    loadAll()
  }

  // ---------------- รหัสเข้าสอบ ----------------
  const [target, setTarget] = React.useState('') // "paper:<id>" | "bundle:<id>"
  const [count, setCount] = React.useState(20)
  const [batch, setBatch] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const [codeFilter, setCodeFilter] = React.useState<'all' | 'unused' | 'active' | 'expired'>('all')

  const targetName = React.useCallback(
    (type: string, id: string) =>
      type === 'paper' ? papers.find((p) => p.id === id)?.paper_name ?? id : bundles.find((b) => b.bundle_id === id)?.title ?? id,
    [papers, bundles]
  )

  const codesCsv = (rows: ExamAccessCodeRow[], name: string) => {
    const csv = toCsv([
      ['access_code', 'ชุด/แพ็ก', 'ประเภท', 'สถานะ', 'ผูกกับ', 'ใช้ไป (ครั้ง)', 'เปิดใช้เมื่อ', 'หมดอายุ', 'ล็อต', 'ลิงก์เข้าสอบ'],
      ...rows.map((c) => [
        c.access_code,
        targetName(c.target_type, c.target_id),
        c.target_type === 'paper' ? 'รายชุด' : 'แพ็ก',
        ACCESS_CODE_STATUS_LABEL[c.status],
        c.buyer_contact ?? '',
        c.attempts_used,
        c.activated_at ?? '',
        c.expires_at ?? '',
        c.batch_label ?? '',
        `${window.location.origin}/gate?code=${encodeURIComponent(c.access_code)}`,
      ]),
    ])
    downloadText(csv, name, 'text/csv;charset=utf-8')
  }

  const generate = async () => {
    const [type, id] = target.split(':')
    if (!type || !id) return toast('เลือกชุดหรือแพ็กที่จะออกรหัส', 'error')
    const n = Math.max(1, Math.min(200, count))
    setGenerating(true)
    const label = batch.trim() || `ล็อต ${new Date().toLocaleDateString('th-TH')}`
    let rows: ExamAccessCodeRow[] = []
    // สุ่มซ้ำได้ยากมาก แต่ถ้าชน unique ให้ลองใหม่สูงสุด 3 รอบ
    for (let attempt = 0; attempt < 3 && rows.length === 0; attempt++) {
      const { data, error } = await supabase
        .from('exam_access_codes')
        .insert(generateAccessCodes(n).map((access_code) => ({ access_code, target_type: type, target_id: id, batch_label: label, user_id: user?.id })))
        .select('*')
      if (error && !/duplicate/i.test(error.message)) {
        setGenerating(false)
        return toast(friendly(error.message), 'error')
      }
      rows = (data ?? []) as ExamAccessCodeRow[]
    }
    setGenerating(false)
    toast(`สร้างรหัส ${rows.length} รหัสแล้ว — ดาวน์โหลด CSV ให้อัตโนมัติ`, 'success')
    codesCsv(rows, `access-codes-${label.replace(/[\\/:*?"<>|\s]+/g, '_')}.csv`)
    loadAll()
  }

  const sellable = papers.filter((p) => (p.visibility ?? 'course') !== 'course')
  const shownCodes = codes.filter((c) => codeFilter === 'all' || c.status === codeFilter)

  // ---------------- รหัสนักเรียน ----------------
  const [studentText, setStudentText] = React.useState('')
  const [studentCourse, setStudentCourse] = React.useState('')
  const importStudents = async () => {
    const rows = studentText
      .split(/\r?\n/)
      .map((l) => l.split(/\t|,/).map((x) => x.trim()))
      .filter((r) => r[0])
      .map(([student_code, full_name]) => ({
        student_code: student_code.toUpperCase(),
        full_name: full_name || null,
        course_code: studentCourse.trim() || null,
        is_active: true,
        user_id: user?.id,
      }))
    if (rows.length === 0) return toast('วางรายชื่อ: รหัส<Tab>ชื่อ บรรทัดละคน', 'error')
    const { error } = await supabase.from('course_students').upsert(rows, { onConflict: 'user_id,student_code' })
    if (error) return toast(friendly(error.message), 'error')
    toast(`บันทึกรหัสนักเรียน ${rows.length} คนแล้ว`, 'success')
    setStudentText('')
    loadAll()
  }
  const toggleStudent = async (s: CourseStudentRow) => {
    await supabase.from('course_students').update({ is_active: !s.is_active }).eq('id', s.id)
    loadAll()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>ตั้งค่าการใช้งาน / การขายรายชุด</CardTitle>
          <span className="text-xs text-muted-foreground">ต้องติ๊ก "เปิดสอบ" ชุดถึงจะเข้าผ่านประตูจับเวลาได้</span>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2">ชุดข้อสอบ</th>
                <th className="pr-2">การใช้งาน</th>
                <th className="pr-2">ราคา (บาท)</th>
                <th className="pr-2">เวลาสอบ (นาที)</th>
                <th className="pr-2">ทำได้ (ครั้ง)</th>
                <th className="pr-2">อายุ (วัน)</th>
                <th className="pr-2">เปิดสอบ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {papers.map((p) => {
                const f = fieldsOf(p)
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-navy-900">{p.paper_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.total_items} ข้อ{p.course_code ? ` · ${p.course_code}` : ''}
                        {p.set_code ? `/${p.set_code}` : ''}
                      </p>
                    </td>
                    <td className="pr-2">
                      <NativeSelect className="h-8 w-36" value={f.visibility} onChange={(e) => editPaper(p, { visibility: e.target.value as PaperVisibility })}>
                        {PAPER_VISIBILITIES.map((v) => (
                          <option key={v} value={v}>{PAPER_VISIBILITY_LABEL[v]}</option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className="pr-2"><Input className="h-8 w-24" type="number" min={0} value={f.price} onChange={(e) => editPaper(p, { price: Number(e.target.value) })} /></td>
                    <td className="pr-2"><Input className="h-8 w-20" type="number" min={1} value={f.duration_minutes} onChange={(e) => editPaper(p, { duration_minutes: Number(e.target.value) })} /></td>
                    <td className="pr-2"><Input className="h-8 w-20" type="number" min={1} value={f.max_attempts} onChange={(e) => editPaper(p, { max_attempts: Number(e.target.value) })} /></td>
                    <td className="pr-2"><Input className="h-8 w-20" type="number" min={0} value={f.valid_days} onChange={(e) => editPaper(p, { valid_days: Number(e.target.value) })} /></td>
                    <td className="pr-2 text-center"><input type="checkbox" checked={!!f.is_published} onChange={(e) => editPaper(p, { is_published: e.target.checked })} /></td>
                    <td>
                      <Button size="sm" variant={edits[p.id] ? 'default' : 'outline'} onClick={() => savePaper(p)} disabled={savingPaper === p.id}>
                        {savingPaper === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                    </td>
                  </tr>
                )
              })}
              {papers.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">ยังไม่มีชุดข้อสอบที่บันทึกไว้ในระดับชั้นนี้</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Package size={16} /> มัดรวมเป็นแพ็ก</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3"><Label>ชื่อแพ็ก</Label><Input value={bTitle} onChange={(e) => setBTitle(e.target.value)} placeholder="เช่น แพ็กจำลองสนามสาธิต 5 ชุด" /></div>
              <div><Label>ราคา</Label><Input type="number" min={0} value={bPrice} onChange={(e) => setBPrice(Number(e.target.value))} /></div>
              <div><Label>อายุ (วัน)</Label><Input type="number" min={0} value={bDays} onChange={(e) => setBDays(Number(e.target.value))} /></div>
            </div>
            <div className="max-h-40 overflow-y-auto rounded border border-border p-2 text-sm space-y-1">
              {papers.map((p) => (
                <label key={p.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={bPapers.includes(p.id)} onChange={(e) => setBPapers((xs) => (e.target.checked ? [...xs, p.id] : xs.filter((x) => x !== p.id)))} />
                  {p.paper_name} <span className="text-xs text-muted-foreground">({PAPER_VISIBILITY_LABEL[p.visibility ?? 'course']})</span>
                </label>
              ))}
            </div>
            <Button onClick={createBundle}><Package className="h-4 w-4" /> สร้างแพ็ก</Button>
            <ul className="space-y-1 text-sm">
              {bundles.map((b) => (
                <li key={b.bundle_id} className="flex items-center justify-between rounded border border-border px-2 py-1">
                  <span>{b.title} · {b.paper_ids.length} ชุด · ฿{b.price} · {b.valid_days} วัน</span>
                  <button onClick={() => toggleBundle(b)}>
                    <Badge variant={b.is_active ? 'success' : 'muted'}>{b.is_active ? 'เปิดขาย' : 'ปิด'}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound size={16} /> สร้างรหัสเข้าสอบ (Generate Access Codes)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>สำหรับ</Label>
              <NativeSelect value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">— เลือกชุดขายรายชุด หรือแพ็ก —</option>
                <optgroup label="ชุดขายรายชุด / ในแพ็ก">
                  {sellable.map((p) => (
                    <option key={p.id} value={`paper:${p.id}`}>{p.paper_name}{p.is_published ? '' : ' (ยังไม่เปิดสอบ)'}</option>
                  ))}
                </optgroup>
                <optgroup label="แพ็ก">
                  {bundles.filter((b) => b.is_active).map((b) => (
                    <option key={b.bundle_id} value={`bundle:${b.bundle_id}`}>{b.title}</option>
                  ))}
                </optgroup>
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>จำนวนรหัส</Label>
                <div className="flex gap-1">
                  <Input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} />
                  {[10, 20, 50].map((n) => (
                    <Button key={n} size="sm" variant="outline" className="h-10" onClick={() => setCount(n)}>{n}</Button>
                  ))}
                </div>
              </div>
              <div><Label>ชื่อล็อต</Label><Input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="เช่น LINE OA 16 พ.ย." /></div>
            </div>
            <Button onClick={generate} disabled={generating} className="bg-gold-500 hover:bg-gold-600 text-navy-900">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} สร้างรหัส + ดาวน์โหลด CSV
            </Button>
            <div className="flex items-center justify-between pt-2">
              <NativeSelect className="h-8 w-40" value={codeFilter} onChange={(e) => setCodeFilter(e.target.value as typeof codeFilter)}>
                <option value="all">ทุกสถานะ ({codes.length})</option>
                <option value="unused">ยังไม่ใช้</option>
                <option value="active">เปิดใช้แล้ว</option>
                <option value="expired">หมดอายุ</option>
              </NativeSelect>
              <Button size="sm" variant="outline" onClick={() => codesCsv(shownCodes, 'access-codes.csv')} disabled={shownCodes.length === 0}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto text-xs">
              <table className="w-full">
                <tbody>
                  {shownCodes.slice(0, 300).map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-1 font-mono">{c.access_code}</td>
                      <td className="truncate max-w-[10rem]">{targetName(c.target_type, c.target_id)}</td>
                      <td><Badge variant={c.status === 'unused' ? 'muted' : c.status === 'active' ? 'success' : 'danger'}>{ACCESS_CODE_STATUS_LABEL[c.status]}</Badge></td>
                      <td>{c.buyer_contact ?? ''}</td>
                      <td>{c.expires_at ? `ถึง ${formatDateTH(c.expires_at)}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users size={16} /> รหัสนักเรียนในคอร์ส (เข้าสอบชุดแบบ "ใช้ในคอร์สหลัก")</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Textarea rows={6} value={studentText} onChange={(e) => setStudentText(e.target.value)} placeholder={'วางจาก Excel: รหัส<Tab>ชื่อ บรรทัดละคน\nP3C10-001\tด.ช.เอ\nP3C10-002\tด.ญ.บี'} />
            <div className="flex gap-2">
              <Input value={studentCourse} onChange={(e) => setStudentCourse(e.target.value.toUpperCase())} placeholder="รหัสคอร์ส (ว่าง = เข้าได้ทุกชุดคอร์ส)" />
              <Button onClick={importStudents}>บันทึก</Button>
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto text-sm">
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-t border-border py-1">
                <span><span className="font-mono">{s.student_code}</span> {s.full_name ?? ''} <span className="text-xs text-muted-foreground">{s.course_code ?? 'ทุกคอร์ส'}</span></span>
                <button onClick={() => toggleStudent(s)}><Badge variant={s.is_active ? 'success' : 'muted'}>{s.is_active ? 'ใช้งาน' : 'ปิด'}</Badge></button>
              </div>
            ))}
            {students.length === 0 && <p className="text-muted-foreground text-xs">ยังไม่มีรหัสนักเรียน</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
