import { cn } from '../../lib/cn'
import { Badge } from '../ui/Display'
import { initials, roleLabel } from '../../lib/format'

// Inline active/inactive switch used on products, categories, brands and merchants.
// The visible text states the current server state; `label` names what the switch
// controls for assistive technology, which reads the state from aria-checked.
export function ActiveToggle({
  active,
  onChange,
  label = 'Status',
  loading = false,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
  className
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      disabled={loading}
      onClick={() => onChange(!active)}
      title={active ? `Disable — currently ${activeLabel.toLowerCase()}` : `Enable — currently ${inactiveLabel.toLowerCase()}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50',
        active
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-amber-500')} />
      {active ? activeLabel : inactiveLabel}
    </button>
  )
}

const STATUS_TONES = {
  Approved: 'success',
  'Waiting Approval': 'warning',
  Rejected: 'brand',
  'Not processed': 'neutral',
  Processing: 'duality',
  Shipped: 'duality',
  Delivered: 'success',
  Cancelled: 'brand'
}

export function StatusBadge({ status, className }) {
  if (!status) return <span className="text-ink-400">—</span>
  return (
    <Badge tone={STATUS_TONES[status] || 'neutral'} className={className}>
      {status}
    </Badge>
  )
}

export function RoleBadge({ role }) {
  const tone = role === 'ROLE ADMIN' ? 'brand' : role === 'ROLE MERCHANT' ? 'dark' : 'neutral'
  return <Badge tone={tone}>{roleLabel(role)}</Badge>
}

// Initials avatar used wherever the API returns a person without a picture.
export function Avatar({ name, className }) {
  const text = initials(name || '?')
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full bg-ink-100 font-display text-xs font-semibold text-ink-600',
        className
      )}
    >
      {text || '?'}
    </span>
  )
}
