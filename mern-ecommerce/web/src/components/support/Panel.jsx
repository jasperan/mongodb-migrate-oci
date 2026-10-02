import clsx from 'clsx'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Badge } from '../ui/Display'
import { Button } from '../ui/Button'
import { describeApiError } from '../../lib/apiError'

/** Inline error card; renders a retry affordance when `onRetry` is given. */
export function ErrorNotice({ error, title = 'Request failed', onRetry, action, className }) {
  const { status, message } = describeApiError(error)
  // A 503 from the showcase endpoints means "provider not configured", which is
  // an informational hint rather than a failure of the dashboard itself.
  const isConfig = status === 503
  const notAvailable = status === 404 || status === 501

  return (
    <div
      className={clsx(
        'rounded-xl border px-4 py-3.5',
        isConfig ? 'border-amber-100 bg-amber-50' : 'border-brand-200 bg-brand-50',
        className
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={17} className={clsx('mt-0.5 shrink-0', isConfig ? 'text-amber-700' : 'text-brand-600')} />
        <div className="min-w-0 flex-1">
          <p className={clsx('text-sm font-semibold', isConfig ? 'text-amber-700' : 'text-brand-700')}>
            {title}
            {typeof status === 'number' ? (
              <span className={clsx('ml-2 font-mono text-xs font-normal', isConfig ? 'text-amber-700/80' : 'text-brand-600')}>
                HTTP {status}
              </span>
            ) : null}
          </p>
          <p className={clsx('mt-0.5 text-sm break-words', isConfig ? 'text-amber-700/90' : 'text-brand-700/90')}>
            {message}
          </p>
          {notAvailable && (
            <p className="mt-1 text-xs text-brand-600/80">This endpoint is not available on the running API yet.</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw size={14} /> Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Titled surface used as the top-level container for each dashboard section. */
export function SectionCard({ icon: Icon, title, subtitle, action, tone = 'default', className, bodyClassName, children }) {
  return (
    <section className={clsx('card-surface overflow-hidden', className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span
              className={clsx(
                'grid size-9 shrink-0 place-items-center rounded-xl',
                tone === 'duality' ? 'bg-duality-50 text-duality-700' : 'bg-brand-50 text-brand-700'
              )}
            >
              <Icon size={17} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-base leading-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className={clsx('px-4 py-4 sm:px-5', bodyClassName)}>{children}</div>
    </section>
  )
}

/** MATCH / MISMATCH status chip shared by the migration tables. */
export function MatchBadge({ status }) {
  const value = String(status ?? '').toUpperCase()
  if (!value || value === 'UNKNOWN') return <Badge tone="neutral">unknown</Badge>
  if (value === 'MATCH') return <Badge tone="success">match</Badge>
  if (value === 'MISMATCH') return <Badge tone="brand">mismatch</Badge>
  return <Badge tone="warning">{value.toLowerCase()}</Badge>
}

export default SectionCard
