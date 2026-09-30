import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

const TONES = {
  error: {
    wrap: 'border-brand-200 bg-brand-50 text-brand-700',
    Icon: AlertTriangle
  },
  success: {
    wrap: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    Icon: CheckCircle2
  },
  info: {
    wrap: 'border-duality-100 bg-duality-50 text-duality-700',
    Icon: Info
  }
}

/**
 * Inline feedback used by every form in the account area. The Express API
 * answers failures with `{ error: '...' }` (or plain text for 401s); `lib/apiError`
 * turns that into something a human can act on.
 */
export function FormAlert({ tone = 'error', className, children }) {
  if (!children) return null
  const { wrap, Icon } = TONES[tone] || TONES.error
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={clsx('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm', wrap, className)}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span className="leading-relaxed">{children}</span>
    </div>
  )
}
