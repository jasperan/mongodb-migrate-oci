import clsx from 'clsx'
import { Link } from 'react-router-dom'

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-ink-900 text-white hover:bg-ink-800',
  outline: 'border border-ink-300 bg-white text-ink-800 hover:border-ink-400 hover:bg-ink-50',
  outlineLight: 'border border-white/25 bg-transparent text-white hover:bg-white/10',
  ghost: 'text-ink-700 hover:bg-ink-100',
  danger: 'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100',
  duality: 'bg-duality-600 text-white hover:bg-duality-700'
}

const SIZES = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base'
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap'

export function Button({ variant = 'primary', size = 'md', className, loading, children, ...props }) {
  return (
    <button className={clsx(base, VARIANTS[variant], SIZES[size], className)} disabled={loading || props.disabled} {...props}>
      {loading && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  )
}

export function ButtonLink({ to, variant = 'primary', size = 'md', className, children, ...props }) {
  return (
    <Link to={to} className={clsx(base, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </Link>
  )
}

export function IconButton({ label, className, children, ...props }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex size-10 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
