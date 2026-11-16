import { GradeBadge } from '@/components/GradeBadge'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, X, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingBlock, SkeletonRow } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { useAllItems } from '@/hooks/useItems'
import { useSchools } from '@/hooks/useSchools'
import { supabase } from '@/lib/supabase'
import { BLOOMS, DIFFICULTIES, GRADE_LEVELS, GRADE_LEVEL_LABEL, itemGradeLevel, ORIGINS, STATUSES, STRANDS, TRAP_TYPES } from '@/lib/vocab'
import { hasPlaceholderChoice, itemCourseCode, itemOrigin, itemSchool, itemSetCode, schoolsWithItems } from '@/lib/labItem'
import { ItemForm } from '@/components/items/ItemForm'
import { ItemDetailModal } from '@/components/items/ItemDetailModal'
import type { ItemRow } from '@/types/database'

const PAGE_SIZE = 50

// ป้าย "ที่มา" ในตาราง: ข้อสอบจริง → ชื่อโรงเรียน, ข้อสอบคอร์ส → รหัสคอร์ส/ชุด (+ โรงเรียนเป้าหมาย)
function originLabel(it: ItemRow, schoolMap: Map<string, { name_th: string }>) {
  const school = itemSchool(it)
  const schoolName = school ? (schoolMap.get(school)?.name_th ?? school) : ''
  if (itemOrigin(it) === 'ข้อสอบจริง') return schoolName ? `ข้อสอบจริง · ${schoolName}` : 'ข้อสอบจริง'
  const course = itemCourseCode(it) ?? it.source ?? 'คอร์ส'
  const set = itemSetCode(it)
  return `คอร์ส ${course}${set ? `/${set}` : ''}${schoolName ? ` → ${schoolName}` : ''}`
}

// allGrades = "คลังรวม": ข้อสอบทุกระดับชั้นและทุกที่มาในตารางเดียว (หน้า /bank)
export default function ItemBankPage({ allGrades = false }: { allGrades?: boolean }) {
  const { items, loading, reload } = useAllItems({ allGrades })
  const { schools, schoolMap } = useSchools()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [school, setSchool] = React.useState(searchParams.get('school') ?? '')
  const [year, setYear] = React.useState('')
  const [strand, setStrand] = React.useState(searchParams.get('strand') ?? '')
  const [topic, setTopic] = React.useState('')
  const [bloom, setBloom] = React.useState('')
  const [difficulty, setDifficulty] = React.useState('')
  const [trapType, setTrapType] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [source, setSource] = React.useState('')
  const [origin, setOrigin] = React.useState(searchParams.get('origin') ?? '')
  const [grade, setGrade] = React.useState('')
  const [onlyBroken, setOnlyBroken] = React.useState(false)
  const [confirmHideBroken, setConfirmHideBroken] = React.useState(false)
  const [q, setQ] = React.useState('')
  const [page, setPage] = React.useState(1)

  const [detailItem, setDetailItem] = React.useState<ItemRow | null>(null)
  const [editItem, setEditItem] = React.useState<ItemRow | null | 'new'>(null)
  const [deleteItem, setDeleteItem] = React.useState<ItemRow | null>(null)

  React.useEffect(() => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      school ? p.set('school', school) : p.delete('school')
      strand ? p.set('strand', strand) : p.delete('strand')
      return p
    })
  }, [school, strand, setSearchParams])

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase()
    return items.filter((it) => {
      if (school && itemSchool(it) !== school) return false
      if (origin && itemOrigin(it) !== origin) return false
      if (allGrades && grade && itemGradeLevel(it) !== grade) return false
      if (onlyBroken && !hasPlaceholderChoice(it)) return false
      if (year && it.year !== Number(year)) return false
      if (strand && it.strand !== strand) return false
      if (topic && !(it.topic ?? '').includes(topic)) return false
      if (bloom && it.bloom !== bloom) return false
      if (difficulty && it.difficulty !== Number(difficulty)) return false
      if (trapType && it.trap_type !== trapType) return false
      if (status && it.status !== status) return false
      if (source && it.source !== source) return false
      if (query) {
        const hay = `${it.stem} ${it.explanation ?? ''} ${it.item_id}`.toLowerCase()
        if (!hay.includes(query)) return false
      }
      return true
    })
  }, [items, school, year, strand, topic, bloom, difficulty, trapType, status, source, origin, grade, allGrades, onlyBroken, q])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  React.useEffect(() => setPage(1), [school, year, strand, topic, bloom, difficulty, trapType, status, source, origin, grade, allGrades, onlyBroken, q])

  const clearFilters = () => {
    setSchool('')
    setYear('')
    setStrand('')
    setTopic('')
    setBloom('')
    setDifficulty('')
    setTrapType('')
    setStatus('')
    setSource('')
    setOrigin('')
    setGrade('')
    setOnlyBroken(false)
    setQ('')
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    const { error } = await supabase.from('items').delete().eq('id', deleteItem.id)
    if (error) {
      toast(`ลบไม่สำเร็จ: ${error.message}`, 'error')
    } else {
      toast('ลบข้อสอบสำเร็จ', 'success')
      reload()
    }
  }

  // พัก/เปิดใช้ข้อเดียว (ไม่ลบข้อมูล ข้อที่พักไว้จะไม่ถูกดึงไปจัดชุด)
  const handleToggleHidden = async (it: ItemRow) => {
    const next = it.status === 'ใช้งาน' ? 'พักไว้' : 'ใช้งาน'
    const { error } = await supabase.from('items').update({ status: next }).eq('id', it.id)
    if (error) return toast(`บันทึกไม่สำเร็จ: ${error.message}`, 'error')
    toast(next === 'พักไว้' ? `พักข้อ ${it.item_id} ไว้แล้ว (ไม่ถูกดึงไปจัดชุด)` : `เปิดใช้ข้อ ${it.item_id} แล้ว`, 'success')
    setDetailItem(null)
    reload()
  }

  // ข้อที่ตัวเลือกยังเป็นข้อความแม่แบบ (กรอกไม่เสร็จ)
  const brokenItems = React.useMemo(() => items.filter(hasPlaceholderChoice), [items])
  const brokenActive = brokenItems.filter((it) => it.status === 'ใช้งาน')
  const hideAllBroken = async () => {
    const ids = brokenActive.map((it) => it.id)
    const { error } = await supabase.from('items').update({ status: 'พักไว้' }).in('id', ids)
    if (error) return toast(`บันทึกไม่สำเร็จ: ${error.message}`, 'error')
    toast(`พักไว้ ${ids.length} ข้อแล้ว — ดูได้จากตัวกรองสถานะ "พักไว้"`, 'success')
    reload()
  }

  const years = Array.from(new Set(items.map((i) => i.year))).sort((a, b) => b - a)
  const sources = Array.from(new Set(items.map((i) => i.source).filter((s): s is string => !!s))).sort()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-800">
            {allGrades ? (
              <>
                คลังรวม{' '}
                <span className="ml-2 inline-flex items-center rounded-full bg-navy-100 text-navy-700 text-xs font-semibold px-2.5 py-0.5 align-middle">
                  ทุกระดับชั้น · ทุกที่มา
                </span>
              </>
            ) : (
              <>
                คลังข้อสอบ <GradeBadge />
              </>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">พบ {filtered.length.toLocaleString()} ข้อ จากทั้งหมด {items.length.toLocaleString()} ข้อ</p>
        </div>
        <Button onClick={() => setEditItem('new')}>
          <Plus className="h-4 w-4" /> เพิ่มข้อสอบใหม่
        </Button>
      </div>

      {brokenItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            พบ {brokenItems.length.toLocaleString()} ข้อที่ตัวเลือกยังเป็นข้อความแม่แบบ เช่น "(เติมเงื่อนไขที่ผิด)"
            {brokenActive.length > 0 ? ` (ยังเปิดใช้งาน ${brokenActive.length.toLocaleString()} ข้อ)` : ' (พักไว้หมดแล้ว)'}
          </span>
          <Button size="sm" variant="outline" onClick={() => setOnlyBroken(!onlyBroken)}>
            {onlyBroken ? 'ดูทั้งหมด' : 'ดูรายการ'}
          </Button>
          {brokenActive.length > 0 && (
            <Button size="sm" variant="destructive" onClick={() => setConfirmHideBroken(true)}>
              พักไว้ทั้งหมด
            </Button>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาข้อความในโจทย์หรือคำอธิบายเฉลย..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-2">
            {allGrades && (
              <NativeSelect value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">ทุกระดับชั้น</option>
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>
                    {GRADE_LEVEL_LABEL[g]}
                  </option>
                ))}
              </NativeSelect>
            )}
            <NativeSelect value={school} onChange={(e) => setSchool(e.target.value)}>
              <option value="">ทุกโรงเรียน / เป้าหมาย</option>
              {schoolsWithItems(schools, items, 'any').map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name_th}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">ทุกปี</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  ปี {y}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={strand} onChange={(e) => setStrand(e.target.value)}>
              <option value="">ทุกสาระ</option>
              {STRANDS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
            <Input placeholder="หัวข้อ" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <NativeSelect value={bloom} onChange={(e) => setBloom(e.target.value)}>
              <option value="">ทุก Bloom</option>
              {BLOOMS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">ทุกความยาก</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  ระดับ {d}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={trapType} onChange={(e) => setTrapType(e.target.value)}>
              <option value="">ทุกกับดัก</option>
              {TRAP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={origin} onChange={(e) => setOrigin(e.target.value)}>
              <option value="">ข้อสอบจริง + คอร์ส</option>
              {ORIGINS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">ทุกคอร์ส/แหล่ง</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">ทุกสถานะ</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </div>
          {(school || year || strand || topic || bloom || difficulty || trapType || status || source || origin || grade || onlyBroken || q) && (
            <button
              onClick={clearFilters}
              className="text-xs text-navy-600 flex items-center gap-1 hover:underline"
            >
              <X className="h-3 w-3" /> ล้างตัวกรองทั้งหมด
            </button>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy-50 text-navy-800">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">item_id</th>
                  {allGrades && <th className="px-3 py-2 text-left font-semibold">ชั้น</th>}
                  <th className="px-3 py-2 text-left font-semibold">ที่มา</th>
                  <th className="px-3 py-2 text-left font-semibold">ปี</th>
                  <th className="px-3 py-2 text-left font-semibold">สาระ</th>
                  <th className="px-3 py-2 text-left font-semibold min-w-[240px]">โจทย์</th>
                  <th className="px-3 py-2 text-left font-semibold">Bloom</th>
                  <th className="px-3 py-2 text-left font-semibold">ยาก</th>
                  <th className="px-3 py-2 text-left font-semibold">สถานะ</th>
                  <th className="px-3 py-2 text-left font-semibold">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading &&
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)}
                {!loading && pageItems.length === 0 && (
                  <tr>
                    <td colSpan={allGrades ? 10 : 9} className="text-center py-12 text-muted-foreground text-sm">
                      ไม่พบข้อสอบตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                )}
                {!loading &&
                  pageItems.map((it) => (
                    <tr
                      key={it.id}
                      className="hover:bg-navy-50/50 cursor-pointer"
                      onClick={() => setDetailItem(it)}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-navy-600">{it.item_id}</td>
                      {allGrades && <td className="px-3 py-2 text-xs whitespace-nowrap">{itemGradeLevel(it)}</td>}
                      <td className="px-3 py-2 text-xs">{originLabel(it, schoolMap)}</td>
                      <td className="px-3 py-2 text-xs">{it.year}</td>
                      <td className="px-3 py-2 text-xs">
                        <Badge variant="muted">{it.strand}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs truncate max-w-[320px]">{it.stem}</td>
                      <td className="px-3 py-2 text-xs">{it.bloom}</td>
                      <td className="px-3 py-2 text-xs">{it.difficulty ?? '-'}</td>
                      <td className="px-3 py-2 text-xs">
                        <Badge variant={it.status === 'ใช้งาน' ? 'success' : 'muted'}>{it.status}</Badge>
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditItem(it)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteItem(it)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              หน้า {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                ถัดไป <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ItemDetailModal
        item={detailItem}
        schoolMap={schoolMap}
        onClose={() => setDetailItem(null)}
        onEdit={(it) => {
          setDetailItem(null)
          setEditItem(it)
        }}
        onToggleHidden={handleToggleHidden}
        onDelete={(it) => {
          setDetailItem(null)
          setDeleteItem(it)
        }}
      />

      <Dialog open={editItem !== null} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent
          title={
            editItem === 'new'
              ? 'เพิ่มข้อสอบใหม่'
              : `แก้ไขข้อสอบ ${(editItem as ItemRow | null)?.item_id ?? ''}`
          }
        >
          <ItemForm
            schools={schools}
            initial={editItem === 'new' ? null : editItem}
            onSaved={() => {
              setEditItem(null)
              reload()
            }}
            onCancel={() => setEditItem(null)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        title="ยืนยันการลบข้อสอบ"
        description={`ต้องการลบข้อสอบ "${deleteItem?.item_id}" ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้`}
        confirmLabel="ลบข้อสอบ"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={confirmHideBroken}
        onOpenChange={setConfirmHideBroken}
        title="พักข้อที่ยังกรอกไม่เสร็จทั้งหมด"
        description={`จะเปลี่ยน ${brokenActive.length} ข้อเป็นสถานะ "พักไว้" ข้อเหล่านี้จะไม่ถูกดึงไปจัดชุด แต่ยังอยู่ในคลัง แก้หรือเปิดใช้ใหม่ได้ภายหลัง`}
        confirmLabel="พักไว้ทั้งหมด"
        onConfirm={hideAllBroken}
      />

      {loading && items.length === 0 && <LoadingBlock />}
    </div>
  )
}
