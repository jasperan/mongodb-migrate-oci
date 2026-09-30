import clsx from 'clsx'
import { Pagination } from '../ui/Pagination'

// "Showing 21–40 of 112 products" + the shared pager, in one row.
export function TableFooter({ page = 1, totalPages = 1, count = 0, limit = 10, onPage, unit = 'items', className }) {
  if (!count) return null
  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, count)

  return (
    <div className={clsx('flex flex-col items-center justify-between gap-4 sm:flex-row', className)}>
      <p className="text-xs text-ink-500">
        Showing <span className="font-semibold text-ink-700">{from.toLocaleString()}</span>–
        <span className="font-semibold text-ink-700">{to.toLocaleString()}</span> of{' '}
        <span className="font-semibold text-ink-700">{count.toLocaleString()}</span> {unit}
      </p>
      <Pagination page={page} totalPages={totalPages} onChange={onPage} />
    </div>
  )
}
