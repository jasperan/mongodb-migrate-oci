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
 * answers failures with `{ error: '...' }` (or plain text for 401s), which
 * `apiErrorMessage` turns into something a human can act on.
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

/**
 * Redux Toolkit Query wraps non-2xx responses as `{ status, data }`. The
 * backend replies with `{ error }`, plain text (`Unauthorized`), or a generic
 * envelope — normalise all of them here so pages never print `[object Object]`.
 */
export function apiErrorMessage(error, fallback = 'Your request could not be processed. Please try again.') {
  if (!error) return fallback
  const { data } = error

  if (typeof data === 'string' && data.trim()) {
    const text = data.trim()
    if (/^unauthenticated$/i.test(text)) return 'Your session has expired. Please sign in again.'
    if (/^unauthorized$/i.test(text)) return 'You are not authorised to make this request.'
    return text
  }

  if (data && typeof data === 'object') {
    if (typeof data.error === 'string' && data.error.trim()) return data.error
    if (typeof data.message === 'string' && data.message.trim()) return data.message
    if (Array.isArray(data.errors) && data.errors[0]?.msg) return data.errors[0].msg
  }

  if (error.status === 'FETCH_ERROR') return 'Cannot reach the server. Check your connection and try again.'
  if (error.status === 'PARSING_ERROR') return 'The server returned an unexpected response.'
  if (error.status === 401) return 'Your session has expired. Please sign in again.'
  if (error.status === 403) return 'You are not allowed to make this request.'
  return fallback
}
