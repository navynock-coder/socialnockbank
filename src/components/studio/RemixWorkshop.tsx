import * as React from 'react'
import { Copy, Save, Loader2, Wand2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, NativeSelect, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ANSWERS, ANSWER_TH_LABEL, BLOOMS, DIFFICULTIES, TRAP_TYPES } from '@/lib/vocab'
import { cleanStem } from '@/lib/labItem'
import { REMIX_ACTIONS, buildRemixPrompt, type RemixDraft } from '@/lib/remixTemplates'
import type { ItemRow } from '@/types/database'

function toDraft(it: ItemRow): RemixDraft {
  return {
    stem: cleanStem(it.stem),
    choice_a: it.choice_a ?? '',
    choice_b: it.choice_b ?? '',
    choice_c: it.choice_c ?? '',
    choice_d: it.choice_d ?? '',
    choice_e: it.choice_e ?? '',
    answer: it.answer,
    explanation: it.explanation ?? '',
    bloom: it.bloom,
    difficulty: it.difficulty ?? 3,
    trap_type: it.trap_type ?? '',
    topic: it.topic ?? '',
  }
}

function nextRemixId(parent: string, taken: Set<string>): string {
  const base = parent.replace(/-R\d+$/, '')
  for (let n = 1; n < 1000; n++) {
    const id = `${base}-R${n}`
    if (!taken.has(id)) return id
  }
  return `${base}-R${Date.now()}`
}

// โต๊ะต่อยอดข้อสอบ: ต้นฉบับ (ซ้าย) vs โจทย์ใหม่ (ขวา) → บันทึกเป็นข้อใหม่ในคลัง (is_remixed + parent_item_id)
export function RemixWorkshop({
  item,
  takenIds,
  onClose,
  onSaved,
}: {
  item: ItemRow | null
  takenIds: Set<string>
  onClose: () => void
  onSaved: (newItem: ItemRow) => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [draft, setDraft] = React.useState<RemixDraft | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setDraft(item ? toDraft(item) : null)
  }, [item])

  if (!item || !draft) return null
  const original = toDraft(item)
  const set = <K extends keyof RemixDraft>(k: K, v: RemixDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  const copyPrompt = async () => {
    const text = buildRemixPrompt(original, 'ปรับให้ทันสมัย อิงข่าวปัจจุบัน และยกระดับเป็นข้อวิเคราะห์ พร้อมตัวเลือกหลอกที่สมเหตุสมผล')
    try {
      await navigator.clipboard.writeText(text)
      toast('คัดลอกพรอมต์แล้ว — วางในแชท Claude แล้วนำผลมาวางในช่องโจทย์ใหม่', 'success')
    } catch {
      toast('คัดลอกไม่สำเร็จ', 'error')
    }
  }

  const save = async () => {
    if (!draft.stem.trim()) return toast('กรุณาใส่โจทย์ใหม่', 'error')
    const choiceOf = (k: string) => draft[`choice_${k.toLowerCase()}` as keyof RemixDraft] as string
    if (!choiceOf(draft.answer)?.trim()) return toast('ตัวเลือกที่เป็นเฉลยต้องไม่ว่าง', 'error')
    setSaving(true)
    const newId = nextRemixId(item.item_id, takenIds)
    const payload = {
      item_id: newId,
      school: item.school,
      year: item.year,
      pack: item.pack,
      exam_date: null,
      strand: item.strand,
      topic: draft.topic || null,
      subtopic: item.subtopic,
      bloom: draft.bloom,
      difficulty: draft.difficulty,
      stem: draft.stem.trim(),
      choice_a: draft.choice_a || null,
      choice_b: draft.choice_b || null,
      choice_c: draft.choice_c || null,
      choice_d: draft.choice_d || null,
      choice_e: draft.choice_e || null,
      answer: draft.answer,
      explanation: draft.explanation || null,
      trap_type: draft.trap_type || null,
      media_url: item.media_url,
      stimulus_id: item.stimulus_id,
      grade_level: item.grade_level ?? 'ป.6',
      source: item.source ?? null,
      status: 'ใช้งาน',
      is_remixed: true,
      parent_item_id: item.item_id,
      user_id: user?.id,
    }
    const { data, error } = await supabase.from('items').insert(payload).select('*').single()
    setSaving(false)
    if (error) {
      toast(
        error.message.includes('is_remixed') || error.message.includes('parent_item_id')
          ? 'ฐานข้อมูลยังไม่มีคอลัมน์ต่อยอด — รัน supabase/migrations/20261116_exam_studio_time_gate.sql ก่อน'
          : `บันทึกไม่สำเร็จ: ${error.message}`,
        'error'
      )
      return
    }
    toast(`บันทึกข้อใหม่ ${newId} เข้าคลังแล้ว`, 'success')
    onSaved(data as ItemRow)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`โต๊ะต่อยอดข้อสอบ · ${item.item_id}`} className="max-w-6xl">
        <div className="mb-3 flex flex-wrap gap-2">
          {REMIX_ACTIONS.map((a) => (
            <Button key={a.id} size="sm" variant="outline" className="border-gold-300 text-gold-700" onClick={() => setDraft((d) => (d ? a.apply(d) : d))}>
              <Wand2 size={13} /> {a.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={copyPrompt}>
            <Copy size={13} /> คัดลอกพรอมต์ไปให้ Claude ช่วยร่าง
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          ปุ่มลัดจะเติมโครงที่แก้ไขได้ (ระบบไม่ได้เรียก AI เอง) — ตรวจและเติมข้อความในวงเล็บ [ … ] ให้ครบก่อนบันทึก
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-gray-50 p-4 text-sm">
            <p className="mb-2 font-semibold text-navy-800">ต้นฉบับ</p>
            <p className="whitespace-pre-wrap text-navy-900">{original.stem}</p>
            <div className="mt-2 space-y-1">
              {ANSWERS.map((k) => {
                const t = original[`choice_${k.toLowerCase()}` as keyof RemixDraft] as string
                if (!t) return null
                return (
                  <p key={k} className={k === original.answer ? 'rounded bg-green-100 px-2 font-medium text-green-800' : 'px-2'}>
                    {ANSWER_TH_LABEL[k]}. {t}
                  </p>
                )
              })}
            </div>
            {original.explanation && <p className="mt-3 whitespace-pre-wrap text-xs text-navy-700">{original.explanation}</p>}
            <p className="mt-3 text-xs text-muted-foreground">
              {item.bloom} · {item.difficulty ?? '-'} ★ · {item.trap_type ?? 'ไม่ระบุกับดัก'}
            </p>
          </div>

          <div className="space-y-2 rounded-lg border-2 border-gold-300 p-4">
            <p className="font-semibold text-gold-700">โจทย์ใหม่</p>
            <Textarea rows={5} value={draft.stem} onChange={(e) => set('stem', e.target.value)} />
            {ANSWERS.map((k) => {
              const f = `choice_${k.toLowerCase()}` as 'choice_a'
              return (
                <div key={k} className="flex items-center gap-2">
                  <input type="radio" name="remix-answer" checked={draft.answer === k} onChange={() => set('answer', k)} title="เฉลย" />
                  <span className="w-5 text-sm">{ANSWER_TH_LABEL[k]}.</span>
                  <Input value={draft[f]} onChange={(e) => set(f, e.target.value)} className="h-9" />
                </div>
              )
            })}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Bloom</Label>
                <NativeSelect className="h-9" value={draft.bloom} onChange={(e) => set('bloom', e.target.value)}>
                  {BLOOMS.map((b) => <option key={b}>{b}</option>)}
                </NativeSelect>
              </div>
              <div>
                <Label className="text-xs">ความยาก</Label>
                <NativeSelect className="h-9" value={draft.difficulty} onChange={(e) => set('difficulty', Number(e.target.value))}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d} ★</option>)}
                </NativeSelect>
              </div>
              <div>
                <Label className="text-xs">กับดัก</Label>
                <NativeSelect className="h-9" value={draft.trap_type} onChange={(e) => set('trap_type', e.target.value)}>
                  <option value="">—</option>
                  {TRAP_TYPES.map((t) => <option key={t}>{t}</option>)}
                </NativeSelect>
              </div>
            </div>
            <Label className="text-xs">คำอธิบายเฉลย</Label>
            <Textarea rows={6} value={draft.explanation} onChange={(e) => set('explanation', e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDraft(original)}>รีเซ็ต</Button>
          <Button variant="orange" className="bg-gold-500 hover:bg-gold-600 text-navy-900" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} บันทึกเป็นข้อใหม่
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
