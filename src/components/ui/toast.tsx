import * as React from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />,
  error: <XCircle className="h-5 w-5 text-red-600 shrink-0" />,
  info: <Info className="h-5 w-5 text-navy-600 shrink-0" />,
}

const borderColors: Record<ToastVariant, string> = {
  success: 'border-l-green-600',
  error: 'border-l-red-600',
  info: 'border-l-navy-600',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])

  const toast = React.useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 no-print">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-2 bg-white shadow-lg rounded-lg border border-l-4 px-4 py-3 min-w-[280px] max-w-sm text-sm text-navy-800',
              borderColors[t.variant]
            )}
          >
            {icons[t.variant]}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}>
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
