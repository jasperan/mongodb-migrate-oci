import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { selectToasts, toastDismissed } from '../../features/ui/uiSlice'

const TONES = {
  success: { icon: CheckCircle2, className: 'border-emerald-200 bg-white text-emerald-700' },
  error: { icon: AlertTriangle, className: 'border-brand-200 bg-white text-brand-700' },
  info: { icon: Info, className: 'border-ink-200 bg-white text-ink-700' }
}

function Toast({ toast }) {
  const dispatch = useDispatch()
  const { icon: Icon, className } = TONES[toast.type] || TONES.info
  // Hovering or focusing a toast holds it on screen so it can be read or copied.
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return undefined
    const timer = setTimeout(() => dispatch(toastDismissed(toast.id)), toast.ttl ?? 4000)
    return () => clearTimeout(timer)
  }, [dispatch, toast.id, toast.ttl, paused])

  return (
    <div
      role={toast.type === 'error' ? 'alert' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn('flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border px-4 py-3 shadow-[var(--shadow-lift)]', className)}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <p className="flex-1 text-sm text-ink-800">{toast.message}</p>
      <button
        onClick={() => dispatch(toastDismissed(toast.id))}
        className="rounded text-ink-500 transition-colors hover:text-ink-800"
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useSelector(selectToasts)
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex flex-col items-center gap-2"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} />
        </div>
      ))}
    </div>
  )
}
