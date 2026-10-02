import { Package, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProductArt } from '../catalog/ProductCard'
import { StatusBadge } from './StatusBadge'
import { FormAlert } from './FormAlert'
import { apiErrorMessage } from '../../lib/apiError'
import { Button } from '../ui/Button'
import { LoadingBlock } from '../ui/Display'
import { currency, shortDate } from '../../lib/format'
import { useOrderByIdQuery } from '../../features/orders/orderApi'
import { canCancelOrder, lineTotal } from '../../lib/orders'

/**
 * Expanded order view. The list endpoint already carries line items and tax
 * fields, but the detail endpoint is the authoritative payload (it also returns
 * `cartId`), so it is fetched on expand.
 */
export function OrderDetailPanel({ orderId, fallback, onCancel, cancelling }) {
  const { data, isLoading, isError, error } = useOrderByIdQuery(orderId, { skip: !orderId })
  const order = data?.order

  if (isLoading && !order) return <LoadingBlock label="Loading order…" />
  if (isError || !order) {
    return <FormAlert>{apiErrorMessage(error, 'The order details could not be loaded.')}</FormAlert>
  }

  const items = order.products || fallback?.products || []
  const subtotal = Number(order.total ?? fallback?.total ?? 0)
  const tax = Number(order.totalTax ?? fallback?.totalTax ?? 0)
  const total = Number(order.totalWithTax ?? fallback?.totalWithTax ?? subtotal + tax)
  const canCancel = canCancelOrder(items)

  return (
    <div className="mt-4 space-y-5 border-t border-ink-200 pt-5">
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <h3 className="eyebrow mb-3">Items</h3>
          <ul className="space-y-3">
            {items.map((item) => {
              const product = item.product || {}
              const amount = lineTotal(item, item.purchasePrice ?? product.price ?? item.price ?? 0)
              return (
                <li
                  key={item._id || product._id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-ink-200 p-3"
                >
                  {product.slug ? (
                    <Link to={`/product/${product.slug}`} className="shrink-0">
                      <ProductArt product={product} className="size-14 rounded-xl" />
                    </Link>
                  ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-500">
                      <Package size={18} />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    {product.slug ? (
                      <Link to={`/product/${product.slug}`} className="font-display text-sm hover:text-brand-700">
                        {product.name || 'Product unavailable'}
                      </Link>
                    ) : (
                      <p className="font-display text-sm">{product.name || 'Product unavailable'}</p>
                    )}
                    <p className="mt-0.5 text-xs text-ink-500">
                      {currency(item.purchasePrice ?? product.price ?? item.price ?? 0)} × {item.quantity}
                      {item.taxable === false || product.taxable === false ? ' · tax free' : ''}
                    </p>
                  </div>

                  <StatusBadge status={item.status} />

                  <span className="ml-auto font-display text-sm">{currency(amount)}</span>
                </li>
              )
            })}
            {items.length === 0 && <li className="text-sm text-ink-500">This order has no line items.</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
          <h3 className="eyebrow mb-3">Summary</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-600">Subtotal</dt>
              <dd className="text-ink-900">{currency(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-600">Estimated sales tax</dt>
              <dd className="text-ink-900">{currency(tax)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-600">Shipping &amp; handling</dt>
              <dd className="text-ink-900">{currency(0)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-ink-200 pt-2.5">
              <dt className="font-medium text-ink-900">Total</dt>
              <dd className="font-display text-base text-ink-900">{currency(total)}</dd>
            </div>
          </dl>

          <dl className="mt-4 space-y-1.5 border-t border-ink-200 pt-4 text-xs text-ink-500">
            <div className="flex items-center justify-between gap-3">
              <dt>Order ID</dt>
              <dd className="truncate font-mono text-ink-700">{order._id}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Placed</dt>
              <dd className="text-ink-700">{shortDate(order.created)}</dd>
            </div>
          </dl>

          {canCancel && onCancel && (
            <Button variant="danger" className="mt-4 w-full" loading={cancelling} onClick={() => onCancel(order)}>
              <RotateCcw size={15} /> Cancel order
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
