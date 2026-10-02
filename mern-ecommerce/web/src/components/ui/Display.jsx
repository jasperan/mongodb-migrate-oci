import { Star } from 'lucide-react'
import { cn } from '../../lib/cn'

const TONES = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-50 text-brand-700 border border-brand-100',
  duality: 'bg-duality-50 text-duality-700 border border-duality-100',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border border-amber-100',
  dark: 'bg-ink-900 text-white'
}

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function Spinner({ className }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('inline-block size-5 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600', className)}
    />
  )
}

export function LoadingBlock({ label = 'Loading…', className }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-16 text-sm text-ink-500', className)}>
      <Spinner /> {label}
    </div>
  )
}

/** Placeholder block shaped like the content it stands in for (no layout shift). */
export function Skeleton({ className }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-ink-100', className)} />
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('card-surface flex flex-col items-center gap-3 px-6 py-14 text-center', className)}>
      {Icon && (
        <span className="grid size-12 place-items-center rounded-full bg-ink-100 text-ink-500">
          <Icon size={22} />
        </span>
      )}
      <h3 className="font-display text-lg">{title}</h3>
      {description && <p className="max-w-md text-sm text-ink-500">{description}</p>}
      {action}
    </div>
  )
}

export function Rating({ value = 0, count, size = 16, className }) {
  const rounded = Math.round(Number(value) || 0)
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={size}
            className={n <= rounded ? 'fill-amber-400 text-amber-400' : 'text-ink-300'}
            strokeWidth={1.5}
          />
        ))}
      </span>
      {count !== undefined && <span className="text-xs text-ink-500">({count})</span>}
    </span>
  )
}

export function StatusDot({ ok = true, label }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={cn('size-2 rounded-full', ok ? 'bg-emerald-500' : 'bg-brand-500')} />
      {label}
    </span>
  )
}
