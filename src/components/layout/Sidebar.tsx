import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Database,
  UploadCloud,
  FileText,
  Printer,
  Dna,
  LogOut,
  GraduationCap,
  Menu,
  FileStack,
  Timer,
  Landmark,
  Library,
} from 'lucide-react'
import * as React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useGradeLevel } from '@/contexts/GradeLevelContext'
import { GRADE_LEVELS, GRADE_LEVEL_LABEL, type GradeLevel } from '@/lib/vocab'
import { cn } from '@/lib/utils'

// เมนูจัดเป็น 5 หมวดตามลำดับงาน: ดูภาพรวม → เก็บข้อสอบ → จัดชุด → พิมพ์/ส่งออก → ขายและผลสอบ
const menuGroups: { title: string | null; items: { to: string; label: string; icon: typeof Database; end?: boolean }[] }[] = [
  { title: null, items: [{ to: '/', label: 'แดชบอร์ด', icon: LayoutDashboard, end: true }] },
  {
    title: 'คลังข้อสอบ',
    items: [
      { to: '/items', label: 'คลังระดับชั้นนี้', icon: Database },
      { to: '/bank', label: 'คลังรวม (ทุกชั้น)', icon: Library },
      { to: '/import', label: 'นำเข้าข้อสอบ', icon: UploadCloud },
    ],
  },
  {
    title: 'จัดชุดข้อสอบ',
    items: [
      { to: '/studio', label: 'ห้องจัดชุด (Studio)', icon: Landmark },
      { to: '/generator', label: 'จัดชุดด่วนตามโรงเรียน', icon: FileText },
      { to: '/dna', label: 'DNA ข้อสอบโรงเรียน', icon: Dna },
    ],
  },
  {
    title: 'พิมพ์และส่งออก',
    items: [
      { to: '/print', label: 'พิมพ์ชุดที่จัดไว้', icon: Printer },
      { to: '/export', label: 'พิมพ์ข้อสอบจริงทั้งฉบับ', icon: FileStack },
    ],
  },
  {
    title: 'ขายและผลสอบ',
    items: [{ to: '/gate-results', label: 'ผลสอบประตูจับเวลา', icon: Timer }],
  },
]

export function Sidebar() {
  const { user, signOut } = useAuth()
  const { gradeLevel, setGradeLevel } = useGradeLevel()
  const [open, setOpen] = React.useState(false)

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-navy-700/50">
        <div className="h-10 w-10 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate">SocialBank</p>
          <p className="text-orange-300 text-xs truncate">สังคมศึกษา ครูน็อค</p>
        </div>
      </div>

      <div className="px-4 pt-4">
        <label htmlFor="grade-level" className="block text-xs text-orange-300 mb-1">
          ระดับชั้นของคลังข้อสอบ
        </label>
        <select
          id="grade-level"
          value={gradeLevel}
          onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
          className="w-full rounded-lg bg-navy-700 text-white text-sm px-3 py-2 border border-navy-500 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {GRADE_LEVELS.map((g) => (
            <option key={g} value={g}>
              {GRADE_LEVEL_LABEL[g]}
            </option>
          ))}
        </select>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuGroups.map((group, gi) => (
          <div key={group.title ?? gi} className={gi > 0 ? 'pt-3' : undefined}>
            {group.title && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-orange-300/80">{group.title}</p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-orange-500 text-white shadow' : 'text-navy-100 hover:bg-navy-700/60'
                  )
                }
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" size={18} />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-navy-700/50">
        <p className="px-3 text-xs text-navy-300 truncate mb-2">{user?.email}</p>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-navy-100 hover:bg-red-500/20 hover:text-red-200 transition-colors"
        >
          <LogOut size={18} />
          ออกจากระบบ
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* mobile top bar */}
      <div className="md:hidden no-print flex items-center justify-between bg-navy-600 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="text-white font-semibold text-sm">SocialBank</span>
        </div>
        <button onClick={() => setOpen(true)} className="text-white p-1">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex no-print">
          <div className="w-72 bg-navy-600 h-full">{content}</div>
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}

      <aside className="hidden md:flex md:w-64 lg:w-72 bg-navy-600 h-screen sticky top-0 shrink-0 no-print">
        {content}
      </aside>
    </>
  )
}
