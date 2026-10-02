import { useState } from 'react'

/**
 * Wraps a database-panel query hook (see databasePanel in supportApi.js) with a
 * `refresh()` that re-reads the endpoint past the server's cache.
 */
export function usePanel(useQuery) {
  const [refreshes, setRefreshes] = useState(0)
  const query = useQuery(refreshes)
  return { ...query, refresh: () => setRefreshes((count) => count + 1) }
}
