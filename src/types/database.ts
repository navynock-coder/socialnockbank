export interface SchoolRow {
  code: string
  name_th: string
  is_active: boolean
  sort_order: number
}

export interface ItemRow {
  id: string
  item_id: string
  school: string | null
  year: number
  pack: string | null
  exam_date: string | null
  strand: string
  topic: string | null
  subtopic: string | null
  bloom: string
  difficulty: number | null
  stem: string
  choice_a: string | null
  choice_b: string | null
  choice_c: string | null
  choice_d: string | null
  choice_e: string | null
  answer: string
  explanation: string | null
  trap_type: string | null
  media_url: string | null
  stimulus_id: string | null
  // ระดับชั้น (ป.6, ม.1–ม.6) — optional เพราะแถวเก่าอาจยังไม่มีค่า ให้อ่านผ่าน itemGradeLevel()
  grade_level?: string | null
  // แหล่งที่มา/คอร์ส เช่น 'คอร์สคาถาพัน' (ว่าง = ข้อสอบจริงจากโรงเรียน)
  source?: string | null
  // รหัสคอร์ส/ชุดของ SOCIALNOCK LAB เช่น P3C8 / EP05 (ข้อเก่าอาจว่าง ให้อ่านผ่าน itemCourseCode())
  course_code?: string | null
  set_code?: string | null
  // ข้อที่ต่อยอด/ดัดแปลงจากข้อเดิม (Exam Remix Workshop)
  is_remixed?: boolean | null
  parent_item_id?: string | null
  status: string
  p_value: number | null
  times_used: number
  created_at: string
  user_id: string | null
}

export type ItemInsert = Omit<ItemRow, 'id' | 'created_at' | 'times_used'> & {
  times_used?: number
}

export interface StimulusRow {
  stimulus_id: string
  school: string | null
  year: number | null
  content: string | null
  media_url: string | null
  user_id: string | null
}

export type PaperVisibility = 'course' | 'single_sale' | 'bundle_pack'

export interface PaperRow {
  id: string
  paper_name: string
  mode: string | null
  config: Record<string, unknown> | null
  item_ids: string[]
  total_items: number
  created_at: string
  user_id: string | null
  // ---- SOCIALNOCK LAB / การขาย (optional: มีหลังรัน migration 20261116_exam_studio_time_gate.sql) ----
  course_code?: string | null
  set_code?: string | null
  visibility?: PaperVisibility
  price?: number
  duration_minutes?: number
  max_attempts?: number
  valid_days?: number
  is_published?: boolean
  lab_synced_at?: string | null
}

export interface ExamBundleRow {
  bundle_id: string
  title: string
  paper_ids: string[]
  price: number
  valid_days: number
  is_active: boolean
  created_at: string
  user_id: string | null
}

export type AccessCodeStatus = 'unused' | 'active' | 'expired'

export interface ExamAccessCodeRow {
  id: string
  access_code: string
  target_type: 'paper' | 'bundle'
  target_id: string
  buyer_contact: string | null
  attempts_used: number
  activated_at: string | null
  expires_at: string | null
  status: AccessCodeStatus
  batch_label: string | null
  created_at: string
  user_id: string | null
}

export interface CourseStudentRow {
  id: string
  student_code: string
  full_name: string | null
  course_code: string | null
  is_active: boolean
  created_at: string
  user_id: string | null
}

export type ParticipantType = 'student' | 'buyer'

export interface ExamAttemptRow {
  id: string
  paper_id: string
  participant_type: ParticipantType
  student_code: string | null
  access_code_id: string | null
  participant_name: string | null
  participant_contact: string | null
  started_at: string
  deadline_at: string
  submitted_at: string | null
  is_late: boolean
  answers: Record<string, string>
  results: Record<string, boolean>
  score: number | null
  total: number | null
  user_id: string | null
}

// Minimal Supabase Database type map (hand-written, not generated)
export interface Database {
  public: {
    Tables: {
      schools: {
        Row: SchoolRow
        Insert: SchoolRow
        Update: Partial<SchoolRow>
      }
      items: {
        Row: ItemRow
        Insert: ItemInsert
        Update: Partial<ItemRow>
      }
      stimulus: {
        Row: StimulusRow
        Insert: StimulusRow
        Update: Partial<StimulusRow>
      }
      papers: {
        Row: PaperRow
        Insert: Omit<PaperRow, 'id' | 'created_at'>
        Update: Partial<PaperRow>
      }
      exam_bundles: {
        Row: ExamBundleRow
        Insert: Omit<ExamBundleRow, 'bundle_id' | 'created_at'>
        Update: Partial<ExamBundleRow>
      }
      exam_access_codes: {
        Row: ExamAccessCodeRow
        Insert: Pick<ExamAccessCodeRow, 'access_code' | 'target_type' | 'target_id'> & Partial<ExamAccessCodeRow>
        Update: Partial<ExamAccessCodeRow>
      }
      course_students: {
        Row: CourseStudentRow
        Insert: Pick<CourseStudentRow, 'student_code'> & Partial<CourseStudentRow>
        Update: Partial<CourseStudentRow>
      }
      exam_attempts: {
        Row: ExamAttemptRow
        Insert: never
        Update: never
      }
    }
  }
}
