import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, EyeOff, Eye, Pencil, Trash2 } from 'lucide-react'
import { hasPlaceholderChoice } from '@/lib/labItem'
import { ANSWER_TH_LABEL } from '@/lib/vocab'
import type { ItemRow, SchoolRow } from '@/types/database'

export function ItemDetailModal({
  item,
  schoolMap,
  onClose,
  onEdit,
  onToggleHidden,
  onDelete,
}: {
  item: ItemRow | null
  schoolMap: Map<string, SchoolRow>
  onClose: () => void
  // ปุ่มจัดการข้อ (ไม่ส่งมา = ไม่แสดงปุ่มนั้น)
  onEdit?: (item: ItemRow) => void
  onToggleHidden?: (item: ItemRow) => void // ใช้งาน ⇄ พักไว้ (ซ่อนจากการจัดชุด ไม่ลบข้อมูล)
  onDelete?: (item: ItemRow) => void
}) {
  if (!item) return null
  const choices: [string, string | null][] = [
    ['A', item.choice_a],
    ['B', item.choice_b],
    ['C', item.choice_c],
    ['D', item.choice_d],
    ['E', item.choice_e],
  ]

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`ข้อสอบ ${item.item_id}`}>
        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          <Badge>{item.strand}</Badge>
          <Badge variant="muted">{item.topic ?? '-'}</Badge>
          <Badge variant="muted">{item.subtopic ?? '-'}</Badge>
          <Badge variant="default">{item.bloom}</Badge>
          <Badge variant="warning">ความยาก {item.difficulty ?? '-'}</Badge>
          {item.trap_type && <Badge variant="danger">{item.trap_type}</Badge>}
          <Badge variant={item.status === 'ใช้งาน' ? 'success' : 'muted'}>{item.status}</Badge>
        </div>

        {hasPlaceholderChoice(item) && (
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>ข้อนี้ยังกรอกไม่เสร็จ: ตัวเลือกบางข้อยังเป็นข้อความแม่แบบ ควรแก้ไข พักไว้ หรือลบ</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-2">
          {schoolMap.get(item.school ?? '')?.name_th ?? item.school ?? 'ไม่ระบุโรงเรียน'} · ปี {item.year}
          {item.pack ? ` · ${item.pack}` : ''}
        </p>

        <p className="font-medium text-navy-900 mb-3 whitespace-pre-wrap">{item.stem}</p>

        {item.media_url && (
          <img src={item.media_url} alt="" className="max-w-full rounded-lg border border-border mb-3" />
        )}

        <div className="space-y-1.5 mb-4">
          {choices
            .filter(([, text]) => text)
            .map(([key, text]) => (
              <div
                key={key}
                className={`text-sm px-3 py-1.5 rounded-lg border ${
                  item.answer === key
                    ? 'bg-green-50 border-green-300 text-green-800 font-medium'
                    : 'border-border text-navy-700'
                }`}
              >
                {ANSWER_TH_LABEL[key]}. {text}
              </div>
            ))}
        </div>

        {item.explanation && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-navy-700">
            <p className="font-medium mb-1">คำอธิบายเฉลย</p>
            <p className="whitespace-pre-wrap">{item.explanation}</p>
          </div>
        )}

        {(onEdit || onToggleHidden || onDelete) && (
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
                <Pencil className="h-4 w-4" /> แก้ไข
              </Button>
            )}
            {onToggleHidden && (
              <Button variant="outline" size="sm" onClick={() => onToggleHidden(item)}>
                {item.status === 'ใช้งาน' ? (
                  <>
                    <EyeOff className="h-4 w-4" /> พักไว้ (ซ่อน)
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" /> กลับมาใช้งาน
                  </>
                )}
              </Button>
            )}
            {onDelete && (
              <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => onDelete(item)}>
                <Trash2 className="h-4 w-4" /> ลบถาวร
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
