import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { toastShown } from '../../features/ui/uiSlice'
import { apiErrorMessage } from '../../lib/apiError'

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

// Filter box + windowing for a list the API returns whole. Changing the term
// goes back to the first page, so a narrow filter never lands on an empty one.
export function useFilteredPage(rows, pick, perPage = 12) {
  const [term, setTerm] = useState('')
  const filtered = useMemo(() => rows.filter((row) => matches(row, term, pick)), [rows, term, pick])
  const { reset, ...window } = useClientPage(filtered, perPage)
  const changeTerm = useCallback(
    (value) => {
      setTerm(value)
      reset()
    },
    [reset]
  )
  return { term, setTerm: changeTerm, ...window }
}

// Server-paged tables keep the requested page in state; deleting the last row
// of the last page would otherwise leave it pointing past the end. `totalPages`
// is undefined until the first response arrives and 0 for an empty collection.
export function useClampPage(page, totalPages, setPage) {
  useEffect(() => {
    if (totalPages === undefined) return
    const last = Math.max(1, totalPages)
    if (page > last) setPage(last)
  }, [page, totalPages, setPage])
}

// One in-flight row action at a time: tracks which row is busy and reports the
// outcome as a toast. Resolves true on success so callers can close their dialog.
// `success` may be a function of what the action returned.
export function useRowAction() {
  const dispatch = useDispatch()
  const [pendingId, setPendingId] = useState(null)

  const run = useCallback(
    async (id, action, { success, failure }) => {
      setPendingId(id)
      try {
        const result = await action()
        dispatch(toastShown({ type: 'success', message: typeof success === 'function' ? success(result) : success }))
        return true
      } catch (requestError) {
        dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, failure) }))
        return false
      } finally {
        setPendingId(null)
      }
    },
    [dispatch]
  )

  return { pendingId, run }
}
