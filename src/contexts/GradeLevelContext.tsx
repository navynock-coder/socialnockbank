import * as React from 'react'
import { DEFAULT_GRADE_LEVEL, GRADE_LEVELS, type GradeLevel } from '@/lib/vocab'

// ระดับชั้นที่กำลังทำงานอยู่ (เลือกจากเมนูซ้าย) — ทุกหน้าที่ใช้ useAllItems() จะเห็นเฉพาะข้อสอบของระดับนี้
// จำค่าไว้ใน localStorage ของเบราว์เซอร์ เปิดเว็บครั้งหน้าจะกลับมาที่ระดับเดิม

interface GradeLevelContextValue {
  gradeLevel: GradeLevel
  setGradeLevel: (g: GradeLevel) => void
}

const STORAGE_KEY = 'socialbank.gradeLevel'

const GradeLevelContext = React.createContext<GradeLevelContextValue>({
  gradeLevel: DEFAULT_GRADE_LEVEL,
  setGradeLevel: () => {},
})

function readStored(): GradeLevel {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && (GRADE_LEVELS as readonly string[]).includes(v)) return v as GradeLevel
  } catch {
    // localStorage ใช้ไม่ได้ (private mode ฯลฯ) — ใช้ค่าเริ่มต้น
  }
  return DEFAULT_GRADE_LEVEL
}

export function GradeLevelProvider({ children }: { children: React.ReactNode }) {
  const [gradeLevel, setState] = React.useState<GradeLevel>(readStored)
  const setGradeLevel = React.useCallback((g: GradeLevel) => {
    setState(g)
    try {
      localStorage.setItem(STORAGE_KEY, g)
    } catch {
      // ignore
    }
  }, [])
  const value = React.useMemo(() => ({ gradeLevel, setGradeLevel }), [gradeLevel, setGradeLevel])
  return <GradeLevelContext.Provider value={value}>{children}</GradeLevelContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGradeLevel() {
  return React.useContext(GradeLevelContext)
}
