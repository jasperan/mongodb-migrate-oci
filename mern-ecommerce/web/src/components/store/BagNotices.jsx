import { X } from 'lucide-react'

/** What changed in the bag since the shopper last looked (price, stock, availability). */
export function BagNotices({ notices, onDismiss }) {
  if (notices.length === 0) return null
  return (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <ul className="flex-1 space-y-1">
        {notices.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-amber-700 hover:text-amber-900">
        <X size={16} />
      </button>
    </div>
  )
}
