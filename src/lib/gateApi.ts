// ประตูจับเวลา (Time-Gate) — เรียกฟังก์ชัน gate_* ใน Supabase (ใช้ได้โดยไม่ต้องล็อกอิน)
import { supabase } from '@/lib/supabase'

export type GateKind = 'student' | 'access_code'

export interface GateAttemptInfo {
  id: string
  token: string
  started_at: string
  deadline_at: string
  submitted_at: string | null
  score: number | null
  total: number | null
}

export interface GatePaper {
  id: string
  paper_name: string
  total_items: number
  duration_minutes: number
  max_attempts: number
  course_code: string | null
  set_code: string | null
  attempts: GateAttemptInfo[]
}

export interface GateLogin {
  participant_type: 'student' | 'buyer'
  display_name: string | null
  student_code: string | null
  access_code: string | null
  expires_at: string | null
  papers: GatePaper[]
}

export interface GateQuestion {
  no: number
  item_id: string
  stem: string
  media_url: string | null
  strand: string
  choices: { key: string; text: string }[]
}

export interface GateStart {
  attempt_id: string
  token: string
  paper_name: string
  duration_minutes: number
  started_at: string
  deadline_at: string
  answers: Record<string, string>
  items: GateQuestion[]
}

export interface GateReportItem {
  no: number
  item_id: string
  stem: string
  strand: string
  topic: string | null
  answer: string
  chosen: string | null
  correct: boolean
  explanation: string | null
  trap_type: string | null
  media_url: string | null
  choices: Record<string, string>
}

export interface GateReport {
  attempt_id: string
  paper_name: string
  participant_type: 'student' | 'buyer'
  participant_name: string | null
  started_at: string
  submitted_at: string
  is_late: boolean
  score: number
  total: number
  group_avg_percent: number | null
  strands: { strand: string; correct: number; total: number }[]
  items: GateReportItem[]
}

type Maybe<T> = T & { error?: undefined }

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<Maybe<T> | { error: string }> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const missing = /function .* does not exist|Could not find the function/i.test(error.message)
    return { error: missing ? 'ระบบประตูสอบยังไม่ได้เปิดใช้ (ต้องรัน SQL migration ของ Time-Gate)' : error.message }
  }
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    return { error: (data as { error: string }).error }
  }
  return data as Maybe<T>
}

export const gateLogin = (kind: GateKind, code: string, contact: string) =>
  rpc<GateLogin>('gate_login', { p_kind: kind, p_code: code, p_contact: contact || null })

export const gateStart = (kind: GateKind, code: string, contact: string, paperId: string, name: string) =>
  rpc<GateStart>('gate_start', { p_kind: kind, p_code: code, p_contact: contact || null, p_paper_id: paperId, p_name: name || null })

export const gateSaveProgress = (attemptId: string, token: string, answers: Record<string, string>) =>
  supabase.rpc('gate_save_progress', { p_attempt_id: attemptId, p_token: token, p_answers: answers })

export const gateSubmit = (attemptId: string, token: string, answers: Record<string, string>) =>
  rpc<GateReport>('gate_submit', { p_attempt_id: attemptId, p_token: token, p_answers: answers })

export const gateReport = (attemptId: string, token: string) =>
  rpc<GateReport>('gate_report', { p_attempt_id: attemptId, p_token: token })
