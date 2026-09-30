import clsx from 'clsx'

const TONES = {
  default: 'border-ink-200 bg-white',
  duality: 'border-duality-100 bg-duality-50',
  brand: 'border-brand-100 bg-brand-50',
  success: 'border-emerald-100 bg-emerald-50',
  warning: 'border-amber-100 bg-amber-50'
}

const VALUE_TONES = {
  default: 'text-ink-900',
  duality: 'text-duality-700',
  brand: 'text-brand-700',
  success: 'text-emerald-700',
  warning: 'text-amber-700'
}

/** Dense metric tile used across the migration/AI dashboards. */
export function StatTile({ icon: Icon, label, value, hint, tone = 'default', loading = false, className }) {
  return (
    <div className={clsx('rounded-2xl border px-4 py-3.5', TONES[tone], className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {Icon && <Icon size={15} className="shrink-0 text-ink-400" />}
      </div>
      <div className={clsx('mt-1.5 font-display text-2xl font-semibold tabular-nums', VALUE_TONES[tone])}>
        {loading ? (
          <span className="mt-1 inline-block h-6 w-14 animate-pulse rounded-md bg-ink-200" aria-label="Loading" />
        ) : (
          (value ?? '—')
        )}
      </div>
      {hint && <div className="mt-0.5 text-xs text-ink-500">{hint}</div>}
    </div>
  )
}

export default StatTile
