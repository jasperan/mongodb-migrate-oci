import clsx from 'clsx'
import { Inbox } from 'lucide-react'

const HEAD_CELL =
  'border-b border-ink-200 bg-ink-50/70 px-4 py-3 text-left text-[0.6875rem] font-semibold tracking-wider text-ink-500 uppercase whitespace-nowrap'

const BODY_CELL = 'border-b border-ink-100 px-4 py-3 align-middle text-ink-700'

export function TableShell({ children, tableClassName, className }) {
  return (
    <div className={clsx('card-surface overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className={clsx('w-full border-collapse text-sm', tableClassName)}>{children}</table>
      </div>
    </div>
  )
}

export function Th({ children, className, ...props }) {
  return (
    <th scope="col" className={clsx(HEAD_CELL, className)} {...props}>
      {children}
    </th>
  )
}

export function Td({ children, className, ...props }) {
  return (
    <td className={clsx(BODY_CELL, className)} {...props}>
      {children}
    </td>
  )
}

// Last row of a table in any non-happy state (empty result, error, no permission).
export function TableMessage({ colSpan, icon: Icon = Inbox, title, description, action }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-ink-100 text-ink-500">
            <Icon size={20} />
          </span>
          <h3 className="font-display text-base">{title}</h3>
          {description && <p className="max-w-md text-sm text-ink-500">{description}</p>}
          {action}
        </div>
      </td>
    </tr>
  )
}

export function TableLoading({ colSpan, rows = 6 }) {
  return Array.from({ length: rows }).map((_, rowIndex) => (
    <tr key={rowIndex}>
      <td colSpan={colSpan} className="border-b border-ink-100 px-4 py-4">
        <span className="block h-4 animate-pulse rounded-full bg-ink-100" style={{ width: `${88 - rowIndex * 7}%` }} />
      </td>
    </tr>
  ))
}

// Compact identity cell shared by every table: avatar square + stack of lines.
export function IdentityCell({ art, title, subtitle, badge, children }) {
  return (
    <div className="flex items-center gap-3">
      {art}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink-900">{title}</span>
          {badge}
        </div>
        {subtitle && <p className="truncate text-xs text-ink-500">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
