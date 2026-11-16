import * as React from 'react'
import { Landmark, Sparkles, Search, ShieldAlert, Download } from 'lucide-react'
import { GradeBadge } from '@/components/GradeBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, NativeSelect } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingBlock } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { ItemDetailModal } from '@/components/items/ItemDetailModal'
import { DifficultyMeter } from '@/components/studio/DifficultyMeter'
import { ItemCard } from '@/components/studio/ItemCard'
import { EpBoard } from '@/components/studio/EpBoard'
import { RemixWorkshop } from '@/components/studio/RemixWorkshop'
import { SalesPanel } from '@/components/studio/SalesPanel'
import { ExportPanel } from '@/components/studio/ExportPanel'
import { useStudioBoard, type EpColumn } from '@/components/studio/useStudioBoard'
import { useAllItems } from '@/hooks/useItems'
import { useSchools } from '@/hooks/useSchools'
import { useGradeLevel } from '@/contexts/GradeLevelContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  ANTI_DUPLICATE_COURSES,
  BANK_BASES,
  BLOOMS,
  LAB_COURSE_CODES,
  STRANDS,
  STRAND_COLORS,
  type BankBase,
  type Bloom,
  type Strand,
} from '@/lib/vocab'
import { hasPlaceholderChoice, itemBase, itemCourseCode, itemSchool, schoolsWithItems } from '@/lib/labItem'
import { PRESET_BLUEPRINTS, autoPickByBlueprint, blueprintFromSchool, buildDuplicateIndex, type Blueprint } from '@/lib/examStudio'
import type { ItemRow, PaperRow } from '@/types/database'
import { cn } from '@/lib/utils'

const PAGE = 60

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-medium transition',
        active ? 'border-transparent text-white' : 'border-border bg-white text-navy-700 hover:bg-navy-50'
      )}
      style={active ? { background: color ?? '#1e3a5f' } : undefined}
    >
      {children}
    </button>
  )
}

const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

// ห้องคลังข้อสอบ SOCIALBANK (All-in-One Exam Studio)
export default function ExamStudioPage() {
  const { items, allItems, loading, reload } = useAllItems()
  const { schools, schoolMap } = useSchools()
  const { gradeLevel } = useGradeLevel()
  const { user } = useAuth()
  const { toast } = useToast()
  const studio = useStudioBoard(gradeLevel)
  const { board, active, placement } = studio

  const [papers, setPapers] = React.useState<PaperRow[]>([])
  const loadPapers = React.useCallback(async () => {
    const { data } = await supabase.from('papers').select('*').order('created_at', { ascending: false })
    setPapers((data ?? []) as PaperRow[])
  }, [])
  React.useEffect(() => {
    loadPapers()
  }, [loadPapers])
  const gradePapers = React.useMemo(
    () => papers.filter((p) => ((p.config as { gradeLevel?: string } | null)?.gradeLevel ?? 'ป.6') === gradeLevel),
    [papers, gradeLevel]
  )

  // ---------------- ตัวกรอง ----------------
  const [bases, setBases] = React.useState<BankBase[]>([])
  const [strands, setStrands] = React.useState<Strand[]>([])
  const [blooms, setBlooms] = React.useState<Bloom[]>([])
  const [starMin, setStarMin] = React.useState(1)
  const [starMax, setStarMax] = React.useState(5)
  const [course, setCourse] = React.useState('')
  const [school, setSchool] = React.useState('')
  const [oftenWrong, setOftenWrong] = React.useState(false)
  const [hideDup, setHideDup] = React.useState(false)
  const [onlyRemixed, setOnlyRemixed] = React.useState(false)
  const [q, setQ] = React.useState('')
  const [page, setPage] = React.useState(1)

  const [guardCourses, setGuardCourses] = React.useState<string[]>([...ANTI_DUPLICATE_COURSES])
  const dupIndex = React.useMemo(() => buildDuplicateIndex(allItems, papers, guardCourses), [allItems, papers, guardCourses])

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter((it) => {
      if (it.status !== 'ใช้งาน') return false
      if (hasPlaceholderChoice(it)) return false // ข้อที่ตัวเลือกยังเป็นแม่แบบ ไม่ให้หลุดเข้าชุด
      if (bases.length && !bases.includes(itemBase(it))) return false
      if (strands.length && !strands.includes(it.strand as Strand)) return false
      if (blooms.length && !blooms.includes(it.bloom as Bloom)) return false
      const d = it.difficulty ?? 3
      if (d < starMin || d > starMax) return false
      if (course && itemCourseCode(it) !== course) return false
      if (school && itemSchool(it) !== school) return false
      if (oftenWrong && !(it.p_value != null && it.p_value < 0.5)) return false
      if (onlyRemixed && !it.is_remixed) return false
      if (hideDup && dupIndex.check(it).length > 0) return false
      if (needle && !`${it.item_id} ${it.stem} ${it.topic ?? ''} ${it.subtopic ?? ''}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [items, bases, strands, blooms, starMin, starMax, course, school, oftenWrong, onlyRemixed, hideDup, q, dupIndex])

  React.useEffect(() => setPage(1), [filtered.length])

  const itemMap = React.useMemo(() => new Map(allItems.map((it) => [it.item_id, it])), [allItems])
  const takenIds = React.useMemo(() => new Set(allItems.map((it) => it.item_id)), [allItems])
  const activeItems = React.useMemo(
    () => active.item_ids.map((id) => itemMap.get(id)).filter((x): x is ItemRow => !!x),
    [active, itemMap]
  )
  // จำนวนข้อ (สถานะใช้งาน) ต่อฐาน ในระดับชั้นนี้ — โชว์บนชิป ฐานไหนว่างจะเห็นทันที
  const baseCounts = React.useMemo(() => {
    const c = Object.fromEntries(BANK_BASES.map((b) => [b, 0])) as Record<BankBase, number>
    items.forEach((it) => {
      if (it.status === 'ใช้งาน') c[itemBase(it)]++
    })
    return c
  }, [items])
  const courseOptions = React.useMemo(() => {
    const s = new Set<string>(LAB_COURSE_CODES)
    items.forEach((it) => {
      const c = itemCourseCode(it)
      if (c) s.add(c)
    })
    return [...s].sort()
  }, [items])

  // ---------------- Blueprint ----------------
  const [bp, setBp] = React.useState<Blueprint | null>(null)
  const [dnaSchool, setDnaSchool] = React.useState('')
  const applyBlueprint = (b: Blueprint, replace = true) => {
    setBp(b)
    const { picked, shortages } = autoPickByBlueprint(filtered, b, {
      exclude: new Set([...placement.keys()].filter((id) => !active.item_ids.includes(id))),
      isDuplicate: (it) => dupIndex.check(it).length > 0,
    })
    studio.addMany(
      picked.map((it) => it.item_id),
      replace
    )
    const short = shortages.reduce((a, s) => a + s.missing, 0)
    toast(
      short > 0
        ? `จัด ${picked.length}/${b.totalCount} ข้อลง ${active.set_code} — คลังตามตัวกรองขาด ${shortages.map((s) => `${s.strand} ${s.missing}`).join(', ')}`
        : `จัด ${picked.length} ข้อลง ${active.set_code} ตาม${b.name}แล้ว`,
      short > 0 ? 'info' : 'success'
    )
  }
  const dnaBlueprint = () => {
    const s = schools.find((x) => x.code === dnaSchool)
    if (!s) return toast('เลือกโรงเรียนก่อน', 'error')
    const b = blueprintFromSchool(s.code, s.name_th, items, bp?.totalCount ?? 40)
    if (!b) return toast(`ยังไม่มีข้อสอบจริงของ ${s.name_th} ในคลังระดับชั้นนี้`, 'error')
    applyBlueprint(b)
  }

  // ---------------- Remix / View ----------------
  const [remixItem, setRemixItem] = React.useState<ItemRow | null>(null)
  const [viewItem, setViewItem] = React.useState<ItemRow | null>(null)

  // ---------------- บันทึก EP เป็น papers ----------------
  const [savingId, setSavingId] = React.useState<string | null>(null)
  const saveColumn = async (col: EpColumn) => {
    const ids = col.item_ids.filter((id) => itemMap.has(id))
    if (ids.length === 0) return
    setSavingId(col.id)
    const paperName = [board.course_code, col.set_code, col.title].filter(Boolean).join(' ')
    const row = {
      paper_name: paperName,
      mode: 'studio',
      config: { gradeLevel, studio: true },
      item_ids: ids,
      total_items: ids.length,
      course_code: board.course_code || null,
      set_code: col.set_code || null,
    }
    const res = col.paper_id
      ? await supabase.from('papers').update(row).eq('id', col.paper_id).select('id').single()
      : await supabase.from('papers').insert({ ...row, user_id: user?.id }).select('id').single()
    setSavingId(null)
    if (res.error) {
      const hint = /course_code|set_code|column/i.test(res.error.message)
        ? 'ฐานข้อมูลยังไม่มีคอลัมน์ของ Lab — รัน supabase/migrations/20261116_exam_studio_time_gate.sql ก่อน'
        : res.error.message
      return toast(hint, 'error')
    }
    studio.patchColumn(col.id, { paper_id: (res.data as { id: string }).id })
    toast(`บันทึก "${paperName}" แล้ว — ตั้งราคา/เปิดสอบได้ที่แท็บขาย & รหัส`, 'success')
    loadPapers()
  }

  // ดึงชุดที่บันทึกไว้ของคอร์สนี้กลับขึ้นบอร์ด
  const loadCourseFromPapers = () => {
    const ps = gradePapers.filter((p) => p.course_code === board.course_code).reverse()
    if (ps.length === 0) return toast(`ยังไม่มีชุดที่บันทึกไว้ของ ${board.course_code}`, 'info')
    studio.loadColumns(
      board.course_code,
      ps.map((p, i) => ({
        id: p.id,
        set_code: p.set_code ?? `EP${i + 1}`,
        title: p.paper_name.replace(board.course_code, '').replace(p.set_code ?? '', '').trim(),
        item_ids: p.item_ids,
        paper_id: p.id,
      }))
    )
    toast(`โหลด ${ps.length} ชุดของ ${board.course_code} ขึ้นบอร์ดแล้ว`, 'success')
  }

  if (loading) return <LoadingBlock label="กำลังโหลดคลังข้อสอบ..." />

  const pageItems = filtered.slice(0, page * PAGE)
  const dupInActive = activeItems.filter((it) => dupIndex.check(it).length > 0)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-navy-800 via-navy-600 to-navy-700 p-5 text-white shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <Landmark className="text-gold-400" /> ห้องคลังข้อสอบ SOCIALBANK
              <GradeBadge />
            </h1>
            <p className="text-sm text-navy-100">คัดข้อ · จัดชุดราย EP · ต่อยอดโจทย์ · ตั้งขาย/ออกรหัส · ส่งเข้า SOCIALNOCK LAB</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-navy-100">คอร์ส</span>
            <Input
              list="course-codes"
              value={board.course_code}
              onChange={(e) => studio.setCourse(e.target.value.toUpperCase())}
              className="h-9 w-28 font-bold text-navy-900"
            />
            <datalist id="course-codes">{courseOptions.map((c) => <option key={c} value={c} />)}</datalist>
            <span className="rounded-full bg-gold-400 px-3 py-1 font-semibold text-navy-900">
              กำลังจัด {active.set_code} · {activeItems.length} ข้อ
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pick">
        <TabsList>
          <TabsTrigger value="pick">1 · คัดข้อ & Blueprint</TabsTrigger>
          <TabsTrigger value="board">2 · บอร์ดจัดชุดราย EP</TabsTrigger>
          <TabsTrigger value="sales">3 · ขาย & รหัสเข้าสอบ</TabsTrigger>
          <TabsTrigger value="export">4 · ส่งออก / Lab</TabsTrigger>
        </TabsList>

        <TabsContent value="pick" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>ตัวกรองอัจฉริยะ</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="ค้นหาโจทย์ / รหัส / หัวข้อ" value={q} onChange={(e) => setQ(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">ฐานข้อมูล</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {BANK_BASES.map((b) => <Chip key={b} active={bases.includes(b)} onClick={() => setBases(toggleIn(bases, b))}>{b} ({baseCounts[b].toLocaleString()})</Chip>)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">สาระ</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {STRANDS.map((s) => <Chip key={s} color={STRAND_COLORS[s]} active={strands.includes(s)} onClick={() => setStrands(toggleIn(strands, s))}>{s}</Chip>)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">ระดับ Bloom</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {BLOOMS.map((b) => <Chip key={b} active={blooms.includes(b)} onClick={() => setBlooms(toggleIn(blooms, b))}>{b}</Chip>)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">ความยาก {starMin}–{starMax} ★</Label>
                    <div className="flex items-center gap-2">
                      <NativeSelect className="h-8" value={starMin} onChange={(e) => setStarMin(Math.min(Number(e.target.value), starMax))}>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}
                      </NativeSelect>
                      ถึง
                      <NativeSelect className="h-8" value={starMax} onChange={(e) => setStarMax(Math.max(Number(e.target.value), starMin))}>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}
                      </NativeSelect>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">คอร์ส</Label>
                      <NativeSelect className="h-8" value={course} onChange={(e) => setCourse(e.target.value)}>
                        <option value="">ทั้งหมด</option>
                        {courseOptions.map((c) => <option key={c}>{c}</option>)}
                      </NativeSelect>
                    </div>
                    <div>
                      <Label className="text-xs" title="ข้อสอบจริง = โรงเรียนที่ออกข้อสอบ · ข้อสอบคอร์ส = โรงเรียนเป้าหมายของคอร์ส">โรงเรียน / เป้าหมาย</Label>
                      <NativeSelect className="h-8" value={school} onChange={(e) => setSchool(e.target.value)}>
                        <option value="">ทั้งหมด</option>
                        {schoolsWithItems(schools, items, 'any').map((s) => <option key={s.code} value={s.code}>{s.name_th}</option>)}
                      </NativeSelect>
                    </div>
                  </div>
                  <label className="flex items-center justify-between">ข้อที่เด็กผิดบ่อย (p &lt; 0.5)<Switch checked={oftenWrong} onCheckedChange={setOftenWrong} /></label>
                  <label className="flex items-center justify-between">เฉพาะข้อที่ต่อยอดแล้ว<Switch checked={onlyRemixed} onCheckedChange={setOnlyRemixed} /></label>
                  <label className="flex items-center justify-between">ซ่อนข้อที่เคยใช้ในคอร์สก่อนหน้า<Switch checked={hideDup} onCheckedChange={setHideDup} /></label>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-1"><ShieldAlert size={15} /> Anti-Duplicate Guard</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <p className="text-muted-foreground">เตือนเมื่อข้อ (หรือโจทย์ที่เหมือนกัน) เคยใช้ในคอร์ส:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {courseOptions.map((c) => <Chip key={c} active={guardCourses.includes(c)} onClick={() => setGuardCourses(toggleIn(guardCourses, c))}>{c}</Chip>)}
                  </div>
                  {dupInActive.length > 0 ? (
                    <p className="rounded bg-red-50 p-2 text-red-700">{active.set_code} มีข้อซ้ำ {dupInActive.length} ข้อ: {dupInActive.slice(0, 5).map((it) => it.item_id).join(', ')}</p>
                  ) : (
                    <p className="rounded bg-green-50 p-2 text-green-700">{active.set_code} ยังไม่มีข้อซ้ำกับคอร์สที่เลือก</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-gold-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-1 text-gold-700"><Sparkles size={15} /> School DNA Blueprints</CardTitle>
                  <span className="text-xs text-muted-foreground">จัดลง {active.set_code} อัตโนมัติจากข้อที่ผ่านตัวกรอง (เลี่ยงข้อซ้ำก่อน)</span>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {PRESET_BLUEPRINTS.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => applyBlueprint(b)}
                        className={cn('rounded-lg border px-3 py-2 text-left text-xs hover:bg-gold-50', bp?.id === b.id ? 'border-gold-400 bg-gold-50' : 'border-border')}
                        title={b.description}
                      >
                        <p className="font-semibold text-navy-800">{b.name}</p>
                        <p className="text-muted-foreground">{b.totalCount} ข้อ · {b.durationMinutes} นาที</p>
                      </button>
                    ))}
                    <div className="flex items-center gap-1 rounded-lg border border-dashed border-border px-2">
                      <NativeSelect className="h-8 w-36 text-xs" value={dnaSchool} onChange={(e) => setDnaSchool(e.target.value)}>
                        <option value="">DNA จากข้อสอบจริง…</option>
                        {schoolsWithItems(schools, items, 'real').map((s) => <option key={s.code} value={s.code}>{s.name_th}</option>)}
                      </NativeSelect>
                      <Button size="sm" variant="outline" onClick={dnaBlueprint}>ใช้</Button>
                    </div>
                  </div>
                  {bp && (
                    <p className="text-xs text-navy-700">
                      {bp.name}: {STRANDS.map((s) => `${s} ${bp.strandPct[s]}%`).join(' · ')} | Bloom {BLOOMS.map((b) => `${b} ${bp.bloomPct[b]}%`).join(' · ')}
                    </p>
                  )}
                  <DifficultyMeter items={activeItems} target={bp?.bandPct ?? null} label={`Difficulty Meter ของ ${active.set_code}`} />
                </CardContent>
              </Card>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">พบ {filtered.length.toLocaleString()} ข้อ · คลิก + เพื่อเพิ่มลง {active.set_code}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => reload()}>รีเฟรชคลัง</Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pageItems.map((it) => (
                  <ItemCard
                    key={it.id}
                    item={it}
                    selectedIn={placement.get(it.item_id) ?? null}
                    dupHits={dupIndex.check(it)}
                    onToggle={() => studio.toggle(it.item_id)}
                    onRemix={() => setRemixItem(it)}
                    onView={() => setViewItem(it)}
                  />
                ))}
              </div>
              {pageItems.length < filtered.length && (
                <div className="text-center">
                  <Button variant="outline" onClick={() => setPage((p) => p + 1)}>แสดงเพิ่ม ({filtered.length - pageItems.length} ข้อ)</Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="board" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">ลากการ์ดข้าม EP ได้ · ข้อที่ขอบแดง = เคยใช้ใน {guardCourses.join(', ') || '—'}</p>
            <Button size="sm" variant="outline" onClick={loadCourseFromPapers}>
              <Download className="h-3 w-3" /> โหลดชุดที่บันทึกไว้ของ {board.course_code}
            </Button>
          </div>
          <EpBoard
            board={board}
            itemMap={itemMap}
            dupIndex={dupIndex}
            savingId={savingId}
            onSetActive={studio.setActive}
            onAdd={studio.addColumn}
            onRemove={studio.removeColumn}
            onPatch={studio.patchColumn}
            onMove={studio.move}
            onToggle={studio.toggle}
            onSave={saveColumn}
          />
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <SalesPanel papers={gradePapers} reloadPapers={loadPapers} />
        </TabsContent>

        <TabsContent value="export" className="mt-4">
          <ExportPanel board={board} itemMap={itemMap} />
        </TabsContent>
      </Tabs>

      <RemixWorkshop
        item={remixItem}
        takenIds={takenIds}
        onClose={() => setRemixItem(null)}
        onSaved={() => {
          setRemixItem(null)
          reload()
        }}
      />
      <ItemDetailModal item={viewItem} schoolMap={schoolMap} onClose={() => setViewItem(null)} />
    </div>
  )
}
