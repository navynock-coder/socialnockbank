import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Clock, KeyRound, Landmark, Loader2, LogOut, Send, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { ScoreReport } from '@/components/gate/ScoreReport'
import { ANSWER_TH_LABEL } from '@/lib/vocab'
import { cleanStem } from '@/lib/labItem'
import { formatDateTH, cn } from '@/lib/utils'
import {
  gateLogin,
  gateReport,
  gateSaveProgress,
  gateStart,
  gateSubmit,
  type GateKind,
  type GateLogin,
  type GatePaper,
  type GateReport,
  type GateStart,
} from '@/lib/gateApi'

const SESSION_KEY = 'socialbank.gate.session'
interface GateSession {
  kind: GateKind
  code: string
  contact: string
  name: string
}

function readSession(): GateSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as GateSession) : null
  } catch {
    return null
  }
}
function writeSession(s: GateSession | null) {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

function useCountdown(deadline: string | null) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!deadline) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [deadline])
  return deadline ? Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000)) : 0
}

// ประตูจับเวลา: เข้าสอบด้วยรหัสนักเรียนในคอร์ส หรือรหัสบัตรเข้าสอบของผู้ซื้อ
export default function GatePage() {
  const [params] = useSearchParams()
  const [session, setSession] = React.useState<GateSession | null>(readSession)
  const [kind, setKind] = React.useState<GateKind>(params.get('code') ? 'access_code' : session?.kind ?? 'access_code')
  const [code, setCode] = React.useState(params.get('code') ?? session?.code ?? '')
  const [contact, setContact] = React.useState(session?.contact ?? '')
  const [name, setName] = React.useState(session?.name ?? '')
  const [login, setLogin] = React.useState<GateLogin | null>(null)
  const [exam, setExam] = React.useState<GateStart | null>(null)
  const [report, setReport] = React.useState<GateReport | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const doLogin = React.useCallback(async (s: GateSession) => {
    setBusy(true)
    setError(null)
    const r = await gateLogin(s.kind, s.code, s.contact)
    setBusy(false)
    if (r.error !== undefined) {
      setError(r.error)
      setLogin(null)
      return false
    }
    setLogin(r)
    setSession(s)
    writeSession(s)
    return true
  }, [])

  // กลับมาหน้าเดิม (รีเฟรช) → ล็อกอินใหม่อัตโนมัติ
  React.useEffect(() => {
    if (session && !login) doLogin(session)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = () => {
    writeSession(null)
    setSession(null)
    setLogin(null)
    setExam(null)
    setReport(null)
  }

  const start = async (p: GatePaper) => {
    if (!session) return
    setBusy(true)
    setError(null)
    const r = await gateStart(session.kind, session.code, session.contact, p.id, session.name)
    setBusy(false)
    if (r.error !== undefined) return setError(r.error)
    setExam(r)
  }

  const viewReport = async (attemptId: string, token: string) => {
    setBusy(true)
    const r = await gateReport(attemptId, token)
    setBusy(false)
    if (r.error !== undefined) return setError(r.error)
    setReport(r)
  }

  const backToList = async () => {
    setExam(null)
    setReport(null)
    if (session) await doLogin(session)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-800 via-navy-700 to-navy-900 print:bg-white">
      <header className="no-print flex items-center justify-between px-4 py-3 text-white md:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-400">
            <Landmark className="h-5 w-5 text-navy-900" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">SOCIALNOCK · ประตูสอบ</p>
            <p className="text-xs text-gold-300">สังคมศึกษา ครูน็อค</p>
          </div>
        </div>
        {login && (
          <button onClick={logout} className="flex items-center gap-1 text-sm text-navy-100 hover:text-white">
            <LogOut size={15} /> ออก
          </button>
        )}
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 md:px-6">
        {error && <div className="no-print mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {report ? (
          <div className="rounded-2xl bg-white p-4 md:p-6 print:p-0"><ScoreReport report={report} onBack={backToList} /></div>
        ) : exam ? (
          <ExamRunner
            exam={exam}
            onDone={(r) => {
              setExam(null)
              setReport(r)
            }}
            onError={setError}
          />
        ) : login ? (
          <PaperList login={login} busy={busy} onStart={start} onReport={viewReport} />
        ) : (
          <div className="mx-auto mt-8 max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h1 className="text-center text-lg font-bold text-navy-800">เข้าสู่ห้องสอบ</h1>
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-navy-50 p-1 text-sm">
              {(['access_code', 'student'] as GateKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={cn('flex items-center justify-center gap-1 rounded-md py-2 font-medium', kind === k ? 'bg-navy-600 text-white' : 'text-navy-700')}
                >
                  {k === 'access_code' ? <KeyRound size={14} /> : <UserRound size={14} />}
                  {k === 'access_code' ? 'รหัสบัตรเข้าสอบ' : 'รหัสนักเรียนในคอร์ส'}
                </button>
              ))}
            </div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                doLogin({ kind, code: code.trim(), contact: contact.trim(), name: name.trim() })
              }}
            >
              <div>
                <Label>{kind === 'access_code' ? 'รหัสบัตร (เช่น SN-XXXX-XXXX)' : 'รหัสนักเรียน'}</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono tracking-wider" autoFocus required />
              </div>
              {kind === 'access_code' && (
                <div>
                  <Label>เบอร์โทรหรืออีเมล</Label>
                  <Input value={contact} onChange={(e) => setContact(e.target.value)} required placeholder="ใช้ผูกกับบัตรตั้งแต่ครั้งแรกที่เข้า" />
                  <p className="mt-1 text-xs text-muted-foreground">ครั้งต่อไปต้องกรอกเบอร์/อีเมลเดิมจึงจะเข้าได้</p>
                </div>
              )}
              <div>
                <Label>ชื่อที่จะแสดงในใบสรุปผล (ไม่บังคับ)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <Button type="submit" className="w-full bg-gold-500 text-navy-900 hover:bg-gold-400" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} เข้าสู่ห้องสอบ
              </Button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

function PaperList({
  login,
  busy,
  onStart,
  onReport,
}: {
  login: GateLogin
  busy: boolean
  onStart: (p: GatePaper) => void
  onReport: (id: string, token: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/10 p-4 text-white">
        <p className="text-lg font-semibold">
          สวัสดี{login.display_name ? ` ${login.display_name}` : ''} 👋
        </p>
        <p className="text-sm text-navy-100">
          {login.participant_type === 'student' ? `นักเรียนในคอร์ส · ${login.student_code}` : `บัตรเข้าสอบ ${login.access_code}`}
          {login.expires_at ? ` · ใช้ได้ถึง ${formatDateTH(login.expires_at)}` : ''}
        </p>
      </div>
      {login.papers.length === 0 && <p className="rounded-xl bg-white p-6 text-center text-sm text-muted-foreground">ยังไม่มีชุดข้อสอบที่เปิดให้ทำ</p>}
      {login.papers.map((p) => {
        const used = p.attempts.length
        const open = p.attempts.find((a) => !a.submitted_at && new Date(a.deadline_at).getTime() > Date.now())
        const left = p.max_attempts - used
        return (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-navy-900">{p.paper_name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock size={12} /> {p.duration_minutes} นาที · {p.total_items} ข้อ · ใช้สิทธิ์ไป {used}/{p.max_attempts} ครั้ง
                </p>
              </div>
              <Button onClick={() => onStart(p)} disabled={busy || (!open && left <= 0)} className="bg-navy-600">
                {open ? 'ทำต่อ' : left > 0 ? 'เริ่มทำข้อสอบ' : 'ใช้สิทธิ์ครบแล้ว'}
              </Button>
            </div>
            {p.attempts.some((a) => a.submitted_at) && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                {p.attempts
                  .filter((a) => a.submitted_at)
                  .map((a, i) => (
                    <button key={a.id} onClick={() => onReport(a.id, a.token)} className="rounded-full bg-gold-50 px-3 py-1 text-xs text-gold-700 hover:bg-gold-100">
                      ครั้งที่ {i + 1}: {a.score}/{a.total} · ดูใบสรุปผล
                    </button>
                  ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ExamRunner({ exam, onDone, onError }: { exam: GateStart; onDone: (r: GateReport) => void; onError: (e: string) => void }) {
  const [answers, setAnswers] = React.useState<Record<string, string>>(exam.answers ?? {})
  const [submitting, setSubmitting] = React.useState(false)
  const left = useCountdown(exam.deadline_at)
  const submittedRef = React.useRef(false)

  const submit = React.useCallback(
    async (auto = false) => {
      if (submittedRef.current) return
      if (!auto) {
        const blank = exam.items.length - Object.keys(answers).length
        if (blank > 0 && !window.confirm(`ยังไม่ได้ตอบ ${blank} ข้อ ต้องการส่งเลยหรือไม่?`)) return
      }
      submittedRef.current = true
      setSubmitting(true)
      const r = await gateSubmit(exam.attempt_id, exam.token, answers)
      setSubmitting(false)
      if (r.error !== undefined) {
        submittedRef.current = false
        return onError(r.error)
      }
      onDone(r)
    },
    [answers, exam, onDone, onError]
  )

  // บันทึกคำตอบระหว่างทำ (กันเน็ตหลุด/รีเฟรช)
  React.useEffect(() => {
    const t = setTimeout(() => {
      gateSaveProgress(exam.attempt_id, exam.token, answers)
    }, 1200)
    return () => clearTimeout(t)
  }, [answers, exam])

  // หมดเวลา → ส่งอัตโนมัติ
  React.useEffect(() => {
    if (left === 0) submit(true)
  }, [left, submit])

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  const answered = Object.keys(answers).length

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 bg-navy-800/95 px-4 py-3 text-white backdrop-blur md:mx-0 md:rounded-xl">
        <div className="min-w-0">
          <p className="truncate font-semibold">{exam.paper_name}</p>
          <p className="text-xs text-navy-100">ตอบแล้ว {answered}/{exam.items.length} ข้อ</p>
        </div>
        <div className={cn('flex items-center gap-1 rounded-lg px-3 py-1.5 font-mono text-lg font-bold', left < 300 ? 'bg-red-600' : 'bg-gold-400 text-navy-900')}>
          <Clock size={16} /> {mm}:{ss}
        </div>
        <Button onClick={() => submit(false)} disabled={submitting} className="bg-gold-500 text-navy-900 hover:bg-gold-400">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ส่งข้อสอบ
        </Button>
      </div>

      {exam.items.map((q) => (
        <div key={q.item_id} className="rounded-xl bg-white p-4 shadow-sm">
          <p className="font-medium text-navy-900">ข้อ {q.no}. {cleanStem(q.stem)}</p>
          {q.media_url && <img src={q.media_url} alt="" className="mt-2 max-w-full rounded border md:max-w-[70%]" />}
          <div className="mt-3 grid gap-2">
            {q.choices.map((c) => {
              const chosen = answers[q.item_id] === c.key
              return (
                <button
                  key={c.key}
                  onClick={() => setAnswers((a) => ({ ...a, [q.item_id]: c.key }))}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-sm transition',
                    chosen ? 'border-gold-400 bg-gold-50 font-medium text-navy-900 ring-1 ring-gold-400' : 'border-border hover:bg-navy-50'
                  )}
                >
                  {ANSWER_TH_LABEL[c.key]}. {c.text}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div className="text-center">
        <Button size="lg" onClick={() => submit(false)} disabled={submitting} className="bg-gold-500 text-navy-900 hover:bg-gold-400">
          ส่งข้อสอบ
        </Button>
      </div>
    </div>
  )
}
