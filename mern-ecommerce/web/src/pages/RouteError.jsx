import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const CHUNK_FAILURE = /dynamically imported module|importing a module script|Loading chunk/i

// Root error boundary: rendered instead of the whole layout, so it cannot rely
// on Header/Footer and uses plain links (a full load also clears the router's
// sticky error state).
export default function RouteError() {
  const error = useRouteError()
  useDocumentTitle('Something went wrong')

  const stale = error instanceof Error && CHUNK_FAILURE.test(error.message)
  const message = stale
    ? 'A newer version of the store was published while this page was open. Reload to get it.'
    : isRouteErrorResponse(error)
      ? `The store answered ${error.status}${error.statusText ? ` (${error.statusText})` : ''}.`
      : 'An unexpected error interrupted this page. Your bag is safe; try again or head back to the store.'

  return (
    <main className="grid min-h-screen place-items-center bg-ink-50 px-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <TriangleAlert size={24} aria-hidden />
        </span>
        <h1 className="font-display text-3xl">Something went wrong</h1>
        <p role="alert" className="text-sm text-ink-500">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-11 items-center rounded-full bg-brand-600 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center rounded-full border border-ink-300 bg-white px-5 text-sm font-medium transition-colors hover:bg-ink-50"
          >
            Back to the store
          </a>
        </div>
      </div>
    </main>
  )
}
