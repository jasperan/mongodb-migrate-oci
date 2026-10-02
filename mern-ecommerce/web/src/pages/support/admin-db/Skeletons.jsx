import { Skeleton } from '../../../components/ui/Display'

/** A table-shaped placeholder: header row plus `rows` body rows of `columns` cells. */
export function TableSkeleton({ rows = 5, columns = 4, className }) {
  return (
    <div className={className} aria-hidden>
      <div className="flex gap-3 border-b border-ink-200 px-3 py-2.5">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-3 border-b border-ink-100 px-3 py-3 last:border-0">
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={index} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** A bordered list card (collections, views) with `rows` name/value lines. */
export function ListCardSkeleton({ rows = 6 }) {
  return (
    <div className="rounded-2xl border border-ink-200" aria-hidden>
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="space-y-1 p-2">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-3 px-2 py-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}
