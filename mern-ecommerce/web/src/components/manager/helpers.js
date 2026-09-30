import { useCallback, useEffect, useState } from 'react'

// Debounced mirror of a value — lists stay snappy while the query fires once.
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// Case/space-insensitive substring match over several fields of a record.
export function matches(record, term, pick) {
  const query = term.trim().toLowerCase()
  if (!query) return true
  return pick(record).some((value) => String(value ?? '').toLowerCase().includes(query))
}

// Client-side windowing for lists the API returns whole (products, categories, brands).
export function useClientPage(rows, perPage = 12) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * perPage
  const visible = rows.slice(start, start + perPage)
  const reset = useCallback(() => setPage(1), [])
  return { visible, page: current, totalPages, count: rows.length, setPage, reset }
}
