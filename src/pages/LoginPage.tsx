import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { GraduationCap, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Input, Label } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const { signIn, signUp, session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = React.useState<'login' | 'signup'>('login')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (session) {
      const from = (location.state as { from?: string })?.from ?? '/'
      navigate(from, { replace: true })
    }
  }, [session, navigate, location])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    const fn = mode === 'login' ? signIn : signUp
    const { error } = await fn(email, password)
    setBusy(false)
    if (error) {
      setError(error)
    } else if (mode === 'signup') {
      setInfo('สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน (หรือเข้าสู่ระบบได้เลยหากปิดการยืนยันอีเมลไว้)')
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-navy-900 via-navy-700 to-navy-600 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg mb-4">
            <GraduationCap className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">SocialBank</h1>
          <p className="text-orange-300 text-sm mt-1">คลังข้อสอบสังคมศึกษา ครูน็อค</p>
        </div>

        <div className="card bg-white p-8 shadow-2xl">
          <div className="flex gap-1 mb-6 bg-navy-50 rounded-lg p-1">
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'login' ? 'bg-navy-600 text-white' : 'text-navy-600'
              }`}
              onClick={() => setMode('login')}
              type="button"
            >
              เข้าสู่ระบบ
            </button>
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'signup' ? 'bg-navy-600 text-white' : 'text-navy-600'
              }`}
              onClick={() => setMode('signup')}
              type="button"
            >
              สมัครสมาชิก
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="teacher@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {info && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{info}</p>}

            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </Button>
          </form>
        </div>
        <p className="text-center text-navy-200 text-xs mt-6">
          ระบบจัดการคลังข้อสอบสำหรับติวเตอร์ · ข้อมูลของคุณถูกปกป้องด้วย Row Level Security
        </p>
      </div>
    </div>
  )
}
