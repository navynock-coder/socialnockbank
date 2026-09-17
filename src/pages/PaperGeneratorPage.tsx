import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Shuffle, Save, Printer, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, NativeSelect } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { LoadingBlock } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { useAllItems } from '@/hooks/useItems'
import { useSchools } from '@/hooks/useSchools'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { STRANDS, STRAND_COLORS, type Strand } from '@/lib/vocab'
import {
  generatePaper,
  computeNaturalStrandPercents,
  type GeneratorConfig,
  type GenerateResult,
} from '@/lib/paperGenerator'
import type { PaperRow } from '@/types/database'

const COUNT_SHORTCUTS = [25, 30, 32, 40, 50]

export default function PaperGeneratorPage() {
  const { items, loading } = useAllItems()
  const { schools } = useSchools()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [mode, setMode] = React.useState<GeneratorConfig['mode']>('single')
  const [schoolCodes, setSchoolCodes] = React.useState<string[]>([])
  const [blueprintMode, setBlueprintMode] = React.useState(true)
  const [manualPercents, setManualPercents] = React.useState<Record<Strand, number>>(
    () => Object.fromEntries(STRANDS.map((s) => [s, 20])) as Record<Strand, number>
  )
  const [totalCount, setTotalCount] = React.useState(30)
  const [yearFrom, setYearFrom] = React.useState(62)
  const [yearTo, setYearTo] = React.useState(68)
  const [difficultyTarget, setDifficultyTarget] = React.useState(3)
  const [avoidPaperId, setAvoidPaperId] = React.useState('')
  const [avoidLastN, setAvoidLastN] = React.useState(3)
  const [shuffleChoices, setShuffleChoices] = React.useState(false)
  const [savedPapers, setSavedPapers] = React.useState<PaperRow[]>([])
  const [result, setResult] = React.useState<GenerateResult | null>(null)
  const [paperName, setPaperName] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    supabase
      .from('papers')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setSavedPapers(data ?? []))
  }, [])

  const manualTotal = STRANDS.reduce((sum, s) => sum + (manualPercents[s] || 0), 0)

  const buildConfig = (): GeneratorConfig => {
    const avoidPaper = savedPapers.find((p) => p.id === avoidPaperId)

    // ลดโอกาส "ออกชุดซ้ำหน้าเดิม" อัตโนมัติ: รวบ item_id จากชุดล่าสุด N ชุดของโรงเรียน/เงื่อนไขเดียวกัน
    // แล้วส่งไปเป็น recentItemIds — ตัวสุ่มจะ "หลีกเลี่ยงถ้าเลือกได้" ไม่ใช่ตัดทิ้งเด็ดขาด กันคลังน้อยแล้วขาดข้อ
    const relevantPapers =
      mode === 'all'
        ? savedPapers
        : savedPapers.filter((p) => {
            const cfg = p.config as { schoolCodes?: string[] } | null
            return cfg?.schoolCodes?.some((c) => schoolCodes.includes(c))
          })
    const recentItemIds = relevantPapers
      .slice(0, avoidLastN)
      .flatMap((p) => p.item_ids ?? [])

    return {
      mode,
      schoolCodes,
      blueprintMode,
      manualPercents,
      totalCount,
      yearFrom,
      yearTo,
      difficultyTarget,
      avoidPaperItemIds: avoidPaper?.item_ids ?? [],
      recentItemIds,
      shuffleChoices,
    }
  }

  const naturalPreview = React.useMemo(() => {
    if (!blueprintMode) return null
    const config = buildConfig()
    const pool = items.filter((it) => {
      if (it.status !== 'ใช้งาน') return false
      if (it.year < yearFrom || it.year > yearTo) return false
      if (mode !== 'all' && !schoolCodes.includes(it.school ?? '')) return false
      return true
    })
    void config
    return computeNaturalStrandPercents(pool)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprintMode, items, mode, schoolCodes, yearFrom, yearTo])

  const canGenerate =
    (mode === 'all' || schoolCodes.length > 0) && (blueprintMode || manualTotal === 100) && totalCount > 0

  const handleGenerate = () => {
    if (!canGenerate) {
      toast('กรุณาตั้งค่าให้ครบก่อนสร้างชุดข้อสอบ (และสัดส่วน % ต้องรวมเป็น 100)', 'error')
      return
    }
    const config = buildConfig()
    const res = generatePaper(items, config)
    setResult(res)
    if (res.shortages.length > 0) {
      toast(
        `ข้อสอบในคลังไม่พอตามเงื่อนไข: ${res.shortages.map((s) => `${s.strand} ขาด ${s.missing} ข้อ`).join(', ')}`,
        'error'
      )
    } else {
      toast('สร้างชุดข้อสอบสำเร็จ', 'success')
    }
  }

  const handleSave = async () => {
    if (!result) return
    if (!paperName.trim()) {
      toast('กรุณาตั้งชื่อชุดข้อสอบก่อนบันทึก', 'error')
      return
    }
    setSaving(true)
    const config = buildConfig()
    const shuffleMap: Record<string, { order: string[]; newAnswer: string }> = {}
    result.items.forEach((gi) => {
      shuffleMap[gi.item.item_id] = gi.shuffle
    })
    const { error } = await supabase.from('papers').insert({
      paper_name: paperName,
      mode: config.mode,
      config: { ...config, shuffleMap } as unknown as Record<string, unknown>,
      item_ids: result.items.map((gi) => gi.item.item_id),
      total_items: result.items.length,
      user_id: user?.id,
    })
    setSaving(false)
    if (error) {
      toast(`บันทึกไม่สำเร็จ: ${error.message}`, 'error')
      return
    }
    toast('บันทึกชุดข้อสอบสำเร็จ', 'success')
    const { data } = await supabase.from('papers').select('*').order('created_at', { ascending: false })
    setSavedPapers(data ?? [])
  }

  const handlePrint = () => {
    if (!result) return
    navigate('/print', { state: { generatedResult: result, paperName: paperName || 'ชุดข้อสอบไม่มีชื่อ' } })
  }

  if (loading) return <LoadingBlock />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-800">ออกชุดข้อสอบ</h1>
        <p className="text-sm text-muted-foreground">ตั้งค่าเงื่อนไขแล้วให้ระบบสุ่มข้อสอบตามสัดส่วนที่กำหนด</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>โหมดการออกข้อสอบ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {[
              { key: 'single', label: '1. เจาะโรงเรียนเดียว' },
              { key: 'multi', label: '2. เลือกหลายโรงเรียน' },
              { key: 'all', label: '3. รวมทุกสนาม' },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setMode(m.key as GeneratorConfig['mode'])
                  setSchoolCodes([])
                }}
                className={`px-4 py-3 rounded-lg border text-sm font-medium text-left transition-colors ${
                  mode === m.key ? 'bg-navy-600 text-white border-navy-600' : 'border-border hover:bg-navy-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode !== 'all' && (
            <div>
              <Label>เลือกโรงเรียน{mode === 'multi' ? ' (เลือกได้หลายแห่ง)' : ''}</Label>
              <div className="flex flex-wrap gap-2">
                {schools.map((s) => {
                  const active = schoolCodes.includes(s.code)
                  return (
                    <button
                      key={s.code}
                      onClick={() => {
                        if (mode === 'single') setSchoolCodes(active ? [] : [s.code])
                        else setSchoolCodes(active ? schoolCodes.filter((c) => c !== s.code) : [...schoolCodes, s.code])
                      }}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                        active ? 'bg-orange-500 text-white border-orange-500' : 'border-border hover:bg-orange-50'
                      }`}
                    >
                      {s.name_th}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blueprint Mode</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {blueprintMode ? 'คำนวณสัดส่วนอัตโนมัติจากคลังจริง' : 'กำหนด % เอง'}
            </span>
            <Switch checked={blueprintMode} onCheckedChange={setBlueprintMode} />
          </div>
        </CardHeader>
        <CardContent>
          {blueprintMode ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {STRANDS.map((s) => (
                <div key={s} className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{s}</p>
                  <p className="text-lg font-bold" style={{ color: STRAND_COLORS[s] }}>
                    {naturalPreview ? naturalPreview[s].toFixed(1) : '-'}%
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {STRANDS.map((s) => (
                  <div key={s}>
                    <Label>{s}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={manualPercents[s]}
                      onChange={(e) =>
                        setManualPercents((p) => ({ ...p, [s]: Number(e.target.value) }))
                      }
                    />
                  </div>
                ))}
              </div>
              <p className={`text-xs ${manualTotal === 100 ? 'text-green-600' : 'text-red-600'}`}>
                รวม {manualTotal}% {manualTotal !== 100 && '(ต้องรวมให้ได้ 100%)'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>เงื่อนไขเพิ่มเติม</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label>จำนวนข้อ</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="number"
                className="w-24"
                value={totalCount}
                onChange={(e) => setTotalCount(Number(e.target.value))}
              />
              {COUNT_SHORTCUTS.map((c) => (
                <Button key={c} size="sm" variant={totalCount === c ? 'default' : 'outline'} onClick={() => setTotalCount(c)}>
                  {c}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>ช่วงปี (พ.ศ. 62-68)</Label>
              <div className="flex items-center gap-2">
                <NativeSelect value={yearFrom} onChange={(e) => setYearFrom(Number(e.target.value))}>
                  {[62, 63, 64, 65, 66, 67, 68].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </NativeSelect>
                <span className="text-sm text-muted-foreground">ถึง</span>
                <NativeSelect value={yearTo} onChange={(e) => setYearTo(Number(e.target.value))}>
                  {[62, 63, 64, 65, 66, 67, 68].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div>
              <Label>ระดับความยากเฉลี่ยเป้าหมาย: {difficultyTarget.toFixed(1)}</Label>
              <Slider
                min={1}
                max={5}
                step={0.1}
                value={[difficultyTarget]}
                onValueChange={(v) => setDifficultyTarget(v[0])}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>ไม่ซ้ำกับชุดเดิม (บังคับตัดทิ้ง — เลือกได้ 1 ชุด)</Label>
              <NativeSelect value={avoidPaperId} onChange={(e) => setAvoidPaperId(e.target.value)}>
                <option value="">— ไม่กันซ้ำ —</option>
                {savedPapers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.paper_name} ({p.total_items} ข้อ)
                  </option>
                ))}
              </NativeSelect>
              <div className="mt-2">
                <Label>หลีกเลี่ยงข้อจาก N ชุดล่าสุดของโรงเรียนนี้ (ลดโอกาสออกซ้ำหน้าเดิม)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  className="w-24"
                  value={avoidLastN}
                  onChange={(e) => setAvoidLastN(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ยังใช้ข้อเหล่านี้ได้ถ้าคลังในสาระนั้นมีไม่พอ — ไม่ใช่การตัดทิ้งเด็ดขาด
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-2">
              <div>
                <p className="text-sm font-medium text-navy-800">สลับตัวเลือก A-D</p>
                <p className="text-xs text-muted-foreground">สุ่มสลับลำดับตัวเลือกและอัปเดตเฉลยให้ถูกต้อง</p>
              </div>
              <Switch checked={shuffleChoices} onCheckedChange={setShuffleChoices} />
            </div>
          </div>

          <Button onClick={handleGenerate} size="lg" disabled={!canGenerate}>
            <Shuffle className="h-4 w-4" /> สร้างชุด
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>ผลลัพธ์ชุดข้อสอบ ({result.items.length} ข้อ)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {result.difficultyWarning && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2 text-sm text-orange-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{result.difficultyWarning}</p>
              </div>
            )}

            {result.shortages.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">ข้อสอบในคลังไม่พอตามเงื่อนไข ระบบจะไม่สร้างข้อมั่ว:</p>
                  <ul className="list-disc list-inside">
                    {result.shortages.map((s) => (
                      <li key={s.strand}>
                        {s.strand} ขาด {s.missing} ข้อ
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={result.breakdown.filter((b) => b.actualCount > 0)}
                      dataKey="actualCount"
                      nameKey="strand"
                      innerRadius={50}
                      outerRadius={90}
                      label={(entry: any) => `${entry.strand} ${entry.actualCount}`}
                    >
                      {result.breakdown.map((b) => (
                        <Cell key={b.strand} fill={STRAND_COLORS[b.strand]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div>
                <table className="w-full text-xs">
                  <thead className="bg-navy-50">
                    <tr>
                      <th className="px-2 py-2 text-left">สาระ</th>
                      <th className="px-2 py-2 text-right">เป้าหมาย</th>
                      <th className="px-2 py-2 text-right">ได้จริง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.breakdown.map((b) => (
                      <tr key={b.strand} className="border-b border-border">
                        <td className="px-2 py-2">{b.strand}</td>
                        <td className="px-2 py-2 text-right">
                          {b.targetCount} ({b.targetPct.toFixed(1)}%)
                        </td>
                        <td className="px-2 py-2 text-right">
                          {b.actualCount} ({b.actualPct.toFixed(1)}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-sm">
                  ความยากเฉลี่ยที่ได้จริง: <Badge>{result.avgDifficultyActual.toFixed(2)}</Badge> (เป้าหมาย{' '}
                  {difficultyTarget.toFixed(1)})
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-border rounded-lg max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-navy-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">ลำดับ</th>
                    <th className="px-2 py-2 text-left">item_id</th>
                    <th className="px-2 py-2 text-left">สาระ</th>
                    <th className="px-2 py-2 text-left">subtopic</th>
                    <th className="px-2 py-2 text-left">bloom</th>
                    <th className="px-2 py-2 text-left">ยาก</th>
                    <th className="px-2 py-2 text-left">ที่มา</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((gi, i) => (
                    <tr key={gi.item.id} className="border-b border-border">
                      <td className="px-2 py-1.5">{i + 1}</td>
                      <td className="px-2 py-1.5 font-mono">{gi.item.item_id}</td>
                      <td className="px-2 py-1.5">{gi.item.strand}</td>
                      <td className="px-2 py-1.5">{gi.item.subtopic ?? '-'}</td>
                      <td className="px-2 py-1.5">{gi.item.bloom}</td>
                      <td className="px-2 py-1.5">{gi.item.difficulty ?? '-'}</td>
                      <td className="px-2 py-1.5">
                        {gi.item.school} / {gi.item.year}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="ตั้งชื่อชุดข้อสอบ เช่น ชุดสอบเข้า ม.1 รอบ 1/2569"
                value={paperName}
                onChange={(e) => setPaperName(e.target.value)}
                className="max-w-xs"
              />
              <Button variant="outline" onClick={handleGenerate}>
                <Shuffle className="h-4 w-4" /> สุ่มใหม่
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" /> บันทึกชุดนี้
              </Button>
              <Button variant="orange" onClick={handlePrint}>
                <Printer className="h-4 w-4" /> พิมพ์
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
