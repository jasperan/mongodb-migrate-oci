import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, ChevronsRight } from 'lucide-react'
import { StatusBadge } from '../account/StatusBadge'
import { FormAlert } from '../account/FormAlert'
import { Button } from '../ui/Button'
import { LoadingBlock } from '../ui/Display'
import { ConfirmDialog } from './ConfirmDialog'
import { useRowAction } from './helpers'
import { useOrderByIdQuery, useUpdateOrderItemStatusMutation } from '../../features/orders/orderApi'
import { apiErrorMessage } from '../../lib/apiError'

// Fulfilment lifecycle of one order line. A line can be cancelled until it is
// delivered; Delivered and Cancelled are final.
const NEXT_STEP = { 'Not processed': 'Processing', Processing: 'Shipped', Shipped: 'Delivered' }
const CANCELLABLE = new Set(['Not processed', 'Processing', 'Shipped'])

/**
 * Per-line status control for the admin order view. The order is fetched on
 * expand so the lines reflect the server's current statuses.
 */
export function OrderLines({ orderId, onOrderRemoved }) {
  const { data, isLoading, isError, error } = useOrderByIdQuery(orderId)
  const [updateStatus] = useUpdateOrderItemStatusMutation()
  const { pendingId, run } = useRowAction()
  const [cancelling, setCancelling] = useState(null)

  const order = data?.order
  if (isLoading) return <LoadingBlock label="Loading order lines…" />
  if (isError || !order) return <FormAlert>{apiErrorMessage(error, 'The order lines could not be loaded.')}</FormAlert>

  const setStatus = async (line, status) => {
    let removed = false
    const ok = await run(
      line._id,
      async () => {
        const result = await updateStatus({ itemId: line._id, status }).unwrap()
        removed = Boolean(result?.orderCancelled)
      },
      {
        success: () =>
          removed
            ? 'Last line cancelled — the order was removed and its stock returned'
            : status === 'Cancelled'
              ? 'Line cancelled — its stock was returned'
              : `Line marked ${status}`,
        failure: 'The status could not be changed.'
      }
    )
    // The order no longer exists, so close the row before its detail refetch 404s.
    if (ok && removed) onOrderRemoved?.()
    return ok
  }

  const confirmCancel = async () => {
    const line = cancelling
    if (!line) return
    await setStatus(line, 'Cancelled')
    setCancelling(null)
  }

  return (
    <div className="space-y-3">
      <h3 className="eyebrow">Fulfilment</h3>
      <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
        {(order.products || []).map((line) => {
          const next = NEXT_STEP[line.status]
          const busy = pendingId === line._id
          return (
            <li key={line._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                {line.product?.slug ? (
                  <Link
                    to={`/product/${line.product.slug}`}
                    className="block truncate text-sm font-medium text-ink-900 hover:text-brand-700"
                  >
                    {line.product.name}
                  </Link>
                ) : (
                  <span className="text-sm text-ink-500">Product removed</span>
                )}
                <p className="text-xs text-ink-500">Quantity {line.quantity}</p>
              </div>
              <StatusBadge status={line.status} />
              <div className="flex items-center gap-2">
                {next && (
                  <Button size="sm" variant="outline" loading={busy} onClick={() => setStatus(line, next)}>
                    <ChevronsRight size={14} /> Mark {next.toLowerCase()}
                  </Button>
                )}
                {CANCELLABLE.has(line.status) && (
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => setCancelling(line)}>
                    <Ban size={14} /> Cancel line
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
        loading={Boolean(cancelling) && pendingId === cancelling._id}
        title="Cancel order line"
        confirmLabel="Cancel line"
        description={
          <>
            <p>
              <span className="font-medium text-ink-900">{cancelling?.product?.name || 'This line'}</span> will be
              cancelled and its quantity returned to stock.
            </p>
            <p className="text-xs text-ink-500">If every line of the order ends up cancelled, the order is removed.</p>
          </>
        }
      />
    </div>
  )
}
