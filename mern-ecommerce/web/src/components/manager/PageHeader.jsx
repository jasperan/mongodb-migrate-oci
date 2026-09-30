import clsx from 'clsx'

export function PageHeader({ eyebrow, title, description, actions, meta, className }) {
  return (
    <header className={clsx('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
