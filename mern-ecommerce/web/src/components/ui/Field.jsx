import clsx from 'clsx'

const fieldBase =
  'w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none disabled:bg-ink-100'

export function Field({ label, hint, error, required, className, children }) {
  return (
    <label className={clsx('block', className)}>
      {label && (
        <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold tracking-wide text-ink-600 uppercase">
          {label}
          {required && <span className="text-brand-600">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-brand-600">{error}</span>}
    </label>
  )
}

export function Input({ className, invalid, ...props }) {
  return <input className={clsx(fieldBase, invalid && 'border-brand-400', className)} {...props} />
}

export function Textarea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={clsx(fieldBase, 'resize-y', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <select className={clsx(fieldBase, 'appearance-none bg-white pr-9', className)} {...props}>
      {children}
    </select>
  )
}

export function Checkbox({ label, className, ...props }) {
  return (
    <label className={clsx('inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700', className)}>
      <input
        type="checkbox"
        className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        {...props}
      />
      {label}
    </label>
  )
}
