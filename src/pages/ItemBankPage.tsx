import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react'
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
import { BLOOMS, DIFFICULTIES, STATUSES, STRANDS, TRAP_TYPES } from '@/lib/vocab'
import { ItemForm } from '@/components/items/ItemForm'
import { ItemDetailModal } from '@/components/items/ItemDetailModal'
import type { ItemRow } from '@/types/database'

const PAGE_SIZE = 50

export default function ItemBankPage() {
  const { items, loading, reload } = useAllItems()
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
      if (school && it.school !== school) return false
      if (year && it.year !== Number(year)) return false
      if (strand && it.strand !== strand) return false
      if (topic && !(it.topic ?? '').includes(topic)) return false
      if (bloom && it.bloom !== bloom) return false
      if (difficulty && it.difficulty !== Number(difficulty)) return false
      if (trapType && it.trap_type !== trapType) return false
      if (status && it.status !== status) return false
      if (query) {
        const hay = `${it.stem} ${it.explanation ?? ''} ${it.item_id}`.toLowerCase()
        if (!hay.includes(query)) return false
      }
      return true
    })
  }, [items, school, year, strand, topic, bloom, difficulty, trapType, status, q])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  React.useEffect(() => setPage(1), [school, year, strand, topic, bloom, difficulty, trapType, status, q])

  const clearFilters = () => {
    setSchool('')
    setYear('')
    setStrand('')
    setTopic('')
    setBloom('')
    setDifficulty('')
    setTrapType('')
    setStatus('')
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

  const years = Array.from(new Set(items.map((i) => i.year))).sort((a, b) => b - a)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-800">คลังข้อสอบ</h1>
          <p className="text-sm text-muted-foreground">พบ {filtered.length.toLocaleString()} ข้อ จากทั้งหมด {items.length.toLocaleString()} ข้อ</p>
        </div>
        <Button onClick={() => setEditItem('new')}>
          <Plus className="h-4 w-4" /> เพิ่มข้อสอบใหม่
        </Button>
      </div>

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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            <NativeSelect value={school} onChange={(e) => setSchool(e.target.value)}>
              <option value="">ทุกโรงเรียน</option>
              {schools.map((s) => (
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
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">ทุกสถานะ</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </div>
          {(school || year || strand || topic || bloom || difficulty || trapType || status || q) && (
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
                  <th className="px-3 py-2 text-left font-semibold">โรงเรียน</th>
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
                    <td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
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
                      <td className="px-3 py-2 text-xs">{schoolMap.get(it.school ?? '')?.name_th ?? '-'}</td>
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

      <ItemDetailModal item={detailItem} schoolMap={schoolMap} onClose={() => setDetailItem(null)} />

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

      {loading && items.length === 0 && <LoadingBlock />}
    </div>
  )
}
