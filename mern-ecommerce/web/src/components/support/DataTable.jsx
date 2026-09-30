import clsx from 'clsx'

/**
 * Small dependency-free table.
 *
 * columns: [{ key, header, render?(row), align?: 'left'|'right'|'center',
 *             className?, headerClassName? }]
 */
export function DataTable({ columns, rows, rowKey, emptyLabel = 'No rows to show.', dense = false, className }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <p className={clsx('rounded-xl border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500', className)}>
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className={clsx('-mx-1 overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-200">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={clsx(
                  'px-3 py-2 text-left text-[11px] font-semibold tracking-wider whitespace-nowrap text-ink-500 uppercase',
                  column.align === 'right' && 'text-right',
                  column.align === 'center' && 'text-center',
                  column.headerClassName
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey ? rowKey(row, index) : index} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/70">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={clsx(
                    'align-top text-ink-700',
                    dense ? 'px-3 py-1.5' : 'px-3 py-2.5',
                    column.align === 'right' && 'text-right tabular-nums',
                    column.align === 'center' && 'text-center',
                    column.className
                  )}
                >
                  {column.render ? column.render(row) : (row?.[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
