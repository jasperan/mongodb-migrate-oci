import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({ page = 1, totalPages = 1, onChange, className }) {
  if (totalPages <= 1) return null
  const pages = []
  const push = (value) => pages.push(value)
  const window = 1

  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= window) push(p)
    else if (pages[pages.length - 1] !== '…') push('…')
  }

  const buttonClass =
    'grid size-10 place-items-center rounded-full border text-sm font-medium transition-colors disabled:opacity-40'

  return (
    <nav className={clsx('flex items-center justify-center gap-2', className)} aria-label="Pagination">
      <button
        className={clsx(buttonClass, 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50')}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p, index) =>
        p === '…' ? (
          <span key={`gap-${index}`} className="px-1 text-ink-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={clsx(
              buttonClass,
              p === page ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
            )}
          >
            {p}
          </button>
        )
      )}
      <button
        className={clsx(buttonClass, 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50')}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}
