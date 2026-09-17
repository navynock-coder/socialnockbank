import * as React from 'react'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import { Input, Label, NativeSelect, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { EXAM_MEDIA_BUCKET } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { ANSWERS, BLOOMS, PACKS, STATUSES, STRANDS, TRAP_TYPES, YEARS } from '@/lib/vocab'
import type { ItemRow, SchoolRow } from '@/types/database'

interface ItemFormProps {
  schools: SchoolRow[]
  initial?: ItemRow | null
  onSaved: () => void
  onCancel: () => void
}

const emptyForm = {
  item_id: '',
  school: '',
  year: 68,
  pack: '',
  exam_date: '',
  strand: '' as string,
  topic: '',
  subtopic: '',
  bloom: '' as string,
  difficulty: 3,
  stem: '',
  choice_a: '',
  choice_b: '',
  choice_c: '',
  choice_d: '',
  choice_e: '',
  answer: '' as string,
  explanation: '',
  trap_type: '',
  media_url: '',
  stimulus_id: '',
  status: 'ใช้งาน',
}

export function ItemForm({ schools, initial, onSaved, onCancel }: ItemFormProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = React.useState(() =>
    initial
      ? {
          item_id: initial.item_id,
          school: initial.school ?? '',
          year: initial.year,
          pack: initial.pack ?? '',
          exam_date: initial.exam_date ?? '',
          strand: initial.strand,
          topic: initial.topic ?? '',
          subtopic: initial.subtopic ?? '',
          bloom: initial.bloom,
          difficulty: initial.difficulty ?? 3,
          stem: initial.stem,
          choice_a: initial.choice_a ?? '',
          choice_b: initial.choice_b ?? '',
          choice_c: initial.choice_c ?? '',
          choice_d: initial.choice_d ?? '',
          choice_e: initial.choice_e ?? '',
          answer: initial.answer,
          explanation: initial.explanation ?? '',
          trap_type: initial.trap_type ?? '',
          media_url: initial.media_url ?? '',
          stimulus_id: initial.stimulus_id ?? '',
          status: initial.status,
        }
      : emptyForm
  )
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const uploadFile = async (file: File) => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${user?.id ?? 'anon'}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from(EXAM_MEDIA_BUCKET).upload(path, file, {
        upsert: false,
      })
      if (error) {
        toast(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`, 'error')
        return
      }
      const { data } = supabase.storage.from(EXAM_MEDIA_BUCKET).getPublicUrl(path)
      set('media_url', data.publicUrl)
      toast('อัปโหลดรูปสำเร็จ', 'success')
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    if (item) {
      const file = item.getAsFile()
      if (file) {
        e.preventDefault()
        uploadFile(file)
      }
    }
  }

  const validate = (): string | null => {
    if (!form.item_id.trim()) return 'กรุณากรอกรหัสข้อสอบ (item_id)'
    if (!form.strand) return 'กรุณาเลือกสาระ'
    if (!form.bloom) return 'กรุณาเลือก Bloom'
    if (!form.answer) return 'กรุณาเลือกเฉลย'
    if (!form.stem.trim()) return 'กรุณากรอกโจทย์'
    return null
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setSaving(true)
    const payload = {
      ...form,
      school: form.school || null,
      pack: form.pack || null,
      exam_date: form.exam_date || null,
      topic: form.topic || null,
      subtopic: form.subtopic || null,
      choice_a: form.choice_a || null,
      choice_b: form.choice_b || null,
      choice_c: form.choice_c || null,
      choice_d: form.choice_d || null,
      choice_e: form.choice_e || null,
      explanation: form.explanation || null,
      trap_type: form.trap_type || null,
      media_url: form.media_url || null,
      stimulus_id: form.stimulus_id || null,
      user_id: user?.id,
    }

    if (initial) {
      const { error } = await supabase.from('items').update(payload).eq('id', initial.id)
      setSaving(false)
      if (error) {
        setError(error.message)
        toast(`บันทึกไม่สำเร็จ: ${error.message}`, 'error')
        return
      }
      toast('บันทึกการแก้ไขสำเร็จ', 'success')
    } else {
      const { error } = await supabase.from('items').insert(payload)
      setSaving(false)
      if (error) {
        setError(error.message)
        toast(`เพิ่มข้อสอบไม่สำเร็จ: ${error.message}`, 'error')
        return
      }
      toast('เพิ่มข้อสอบใหม่สำเร็จ', 'success')
    }
    onSaved()
  }

  return (
    <form onSubmit={onSubmit} onPaste={onPaste} className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label>รหัสข้อสอบ (item_id) *</Label>
          <Input value={form.item_id} onChange={(e) => set('item_id', e.target.value)} required />
        </div>
        <div>
          <Label>โรงเรียน</Label>
          <NativeSelect value={form.school} onChange={(e) => set('school', e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {schools.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name_th}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label>ปี พ.ศ. (2 หลัก)</Label>
          <NativeSelect value={form.year} onChange={(e) => set('year', Number(e.target.value))}>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label>Pack</Label>
          <NativeSelect value={form.pack} onChange={(e) => set('pack', e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {PACKS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label>สาระ *</Label>
          <NativeSelect value={form.strand} onChange={(e) => set('strand', e.target.value)} required>
            <option value="">เลือกสาระ</option>
            {STRANDS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label>หัวข้อ (topic)</Label>
          <Input value={form.topic} onChange={(e) => set('topic', e.target.value)} />
        </div>
        <div>
          <Label>หัวข้อย่อย (subtopic)</Label>
          <Input value={form.subtopic} onChange={(e) => set('subtopic', e.target.value)} />
        </div>
        <div>
          <Label>Bloom *</Label>
          <NativeSelect value={form.bloom} onChange={(e) => set('bloom', e.target.value)} required>
            <option value="">เลือก Bloom</option>
            {BLOOMS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div>
        <Label>โจทย์ *</Label>
        <Textarea rows={3} value={form.stem} onChange={(e) => set('stem', e.target.value)} required />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>ก. (choice_a)</Label>
          <Input value={form.choice_a} onChange={(e) => set('choice_a', e.target.value)} />
        </div>
        <div>
          <Label>ข. (choice_b)</Label>
          <Input value={form.choice_b} onChange={(e) => set('choice_b', e.target.value)} />
        </div>
        <div>
          <Label>ค. (choice_c)</Label>
          <Input value={form.choice_c} onChange={(e) => set('choice_c', e.target.value)} />
        </div>
        <div>
          <Label>ง. (choice_d)</Label>
          <Input value={form.choice_d} onChange={(e) => set('choice_d', e.target.value)} />
        </div>
        <div>
          <Label>จ. (choice_e, ถ้ามี)</Label>
          <Input value={form.choice_e} onChange={(e) => set('choice_e', e.target.value)} />
        </div>
        <div>
          <Label>เฉลย *</Label>
          <NativeSelect value={form.answer} onChange={(e) => set('answer', e.target.value)} required>
            <option value="">เลือกเฉลย</option>
            {ANSWERS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div>
        <Label>คำอธิบายเฉลย (explanation)</Label>
        <Textarea rows={2} value={form.explanation} onChange={(e) => set('explanation', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label>ความยาก (1-5)</Label>
          <NativeSelect value={form.difficulty} onChange={(e) => set('difficulty', Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label>ประเภทกับดัก</Label>
          <NativeSelect value={form.trap_type} onChange={(e) => set('trap_type', e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {TRAP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label>สถานะ</Label>
          <NativeSelect value={form.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label>วันที่สอบ</Label>
          <Input type="date" value={form.exam_date} onChange={(e) => set('exam_date', e.target.value)} />
        </div>
      </div>

      <div>
        <Label>รูปภาพประกอบ (อัปโหลดไฟล์ หรือ Ctrl+V วางจาก clipboard ที่ใดก็ได้ในฟอร์มนี้)</Label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-navy-300 rounded-lg text-sm text-navy-600 cursor-pointer hover:bg-navy-50">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            เลือกรูป
            <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </label>
          {form.media_url && (
            <div className="relative">
              <img src={form.media_url} alt="preview" className="h-16 rounded-lg border border-border object-cover" />
              <button
                type="button"
                onClick={() => set('media_url', '')}
                className="absolute -top-2 -right-2 bg-white rounded-full border border-border shadow p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          บันทึก
        </Button>
      </DialogFooter>
    </form>
  )
}
