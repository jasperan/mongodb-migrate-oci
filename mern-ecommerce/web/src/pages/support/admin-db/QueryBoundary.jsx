import { ErrorNotice } from '../../../components/support/Panel'

/**
 * Renders `children(data)` once the panel has data; the skeleton while it first
 * loads and an error card with Retry when it fails. The skeleton is the caller's,
 * so it can match the final layout.
 */
export function QueryBoundary({ panel, skeleton, errorTitle, children }) {
  if (panel.isLoading) return skeleton
  if (panel.isError && !panel.data) {
    return <ErrorNotice error={panel.error} title={errorTitle} onRetry={panel.refresh} />
  }
  return children(panel.data)
}
