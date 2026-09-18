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
} from 'lucide-react'
import * as React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const menuItems = [
  { to: '/', label: 'แดชบอร์ด', icon: LayoutDashboard, end: true },
  { to: '/items', label: 'คลังข้อสอบ', icon: Database },
  { to: '/import', label: 'นำเข้าข้อมูล', icon: UploadCloud },
  { to: '/generator', label: 'ออกชุดข้อสอบ', icon: FileText },
  { to: '/print', label: 'พิมพ์ชุดข้อสอบ', icon: Printer },
  { to: '/export', label: 'ข้อสอบต้นฉบับ', icon: FileStack },
  { to: '/dna', label: 'School DNA Card', icon: Dna },
]

export function Sidebar() {
  const { user, signOut } = useAuth()
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

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-orange-500 text-white shadow'
                  : 'text-navy-100 hover:bg-navy-700/60'
              )
            }
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" size={18} />
            <span className="truncate">{item.label}</span>
          </NavLink>
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
