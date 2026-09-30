/**
 * Consistent heading block for every dashboard page: an eyebrow, the page
 * title, an optional description and a right-aligned action slot.
 */
export function PageHeader({ eyebrow, title, description, action, children }) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="mt-1 font-display text-2xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-500">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children}
    </header>
  )
}
