import { useGradeLevel } from '@/contexts/GradeLevelContext'
import { GRADE_LEVEL_LABEL } from '@/lib/vocab'

// ป้ายบอกระดับชั้นที่กำลังดูอยู่ แสดงข้างหัวข้อของแต่ละหน้า (เปลี่ยนระดับได้ที่เมนูซ้าย)
export function GradeBadge() {
  const { gradeLevel } = useGradeLevel()
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 text-orange-700 text-xs font-semibold px-2.5 py-0.5 align-middle">
      ระดับ {GRADE_LEVEL_LABEL[gradeLevel]}
    </span>
  )
}
