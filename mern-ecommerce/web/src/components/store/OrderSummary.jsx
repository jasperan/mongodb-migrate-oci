import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Badge } from '../ui/Display'
import { ProductArt } from '../catalog/ProductCard'
import { currency, shortDate } from '../../lib/format'
import { TAX_RATE } from '../../features/cart/cartSlice'

const STATUS_TONES = {
  Processing: 'warning',
  Shipped: 'duality',
  Delivered: 'success',
  Cancelled: 'brand',
  'Not processed': 'neutral'
}

export const statusTone = (status) => STATUS_TONES[status] || 'neutral'

function Row({ label, value, hint, strong = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className={clsx('text-ink-500', strong && 'font-display text-base text-ink-900')}>{label}</dt>
      <dd className={clsx(strong ? 'font-display text-lg text-ink-900' : 'text-ink-800')}>
        {value}
        {hint && <span className="ml-2 text-xs text-ink-400">{hint}</span>}
      </dd>
    </div>
  )
}

// Two totals surfaces: the client-side cart (subtotal + 5% tax on taxable lines)
// and a server-shaped order (the API recomputes total/totalTax/totalWithTax on read).
export function TotalsPanel({ subtotal, tax, total, itemCount, shipping = 'Free', className, footer }) {
  return (
    <div className={clsx('card-surface p-5', className)}>
      <h2 className="font-display text-lg">Order summary</h2>
      <dl className="mt-4 space-y-2.5">
        <Row label={`Subtotal${itemCount ? ` (${itemCount} item${itemCount === 1 ? '' : 's'})` : ''}`} value={currency(subtotal)} />
        <Row label="Estimated tax" value={currency(tax)} hint={`${TAX_RATE}% on taxable items`} />
        <Row label="Shipping" value={shipping} />
        <div className="border-t border-dashed border-ink-200 pt-3">
          <Row label="Total" value={currency(total)} strong />
        </div>
      </dl>
      {footer && <div className="mt-5">{footer}</div>}
    </div>
  )
}

export function OrderTotals({ order, className }) {
  const total = Number(order?.total ?? 0)
  const tax = Number(order?.totalTax ?? 0)
  const withTax = Number(order?.totalWithTax ?? total + tax)

  return (
    <div className={clsx('card-surface p-5', className)}>
      <h2 className="font-display text-lg">Order totals</h2>
      <dl className="mt-4 space-y-2.5">
        <Row label="Subtotal" value={currency(total)} />
        <Row label="Tax" value={currency(tax)} />
        <div className="border-t border-dashed border-ink-200 pt-3">
          <Row label="Total paid" value={currency(withTax)} strong />
        </div>
      </dl>
      {order?.created && <p className="mt-4 text-xs text-ink-500">Placed {shortDate(order.created)}</p>}
    </div>
  )
}

export function OrderItemsTable({ items = [], className }) {
  if (!items.length) {
    return <p className={clsx('text-sm text-ink-500', className)}>This order has no line items.</p>
  }

  return (
    <ul className={clsx('divide-y divide-ink-100', className)}>
      {items.map((item, index) => {
        // Order rows carry a populated `product`; client cart rows keep the id in
        // `product` and the display fields on the line itself.
        const populated = item.product && typeof item.product === 'object' ? item.product : null
        const name = populated?.name || item.name || 'Removed product'
        const slug = populated?.slug || item.slug
        const brandName =
          (typeof populated?.brand === 'object' ? populated.brand?.name : populated?.brand) ||
          (typeof item.brand === 'string' ? item.brand : '')
        const unitPrice = item.purchasePrice || populated?.price || item.price || 0
        const lineTotal = item.priceWithTax ?? item.totalPrice ?? unitPrice * (item.quantity || 1)

        return (
          <li key={item._id || populated?._id || index} className="flex items-center gap-4 py-3">
            <ProductArt product={populated || item} className="size-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              {slug ? (
                <Link to={`/product/${slug}`} className="text-sm font-medium hover:text-brand-700">
                  {name}
                </Link>
              ) : (
                <span className="text-sm font-medium">{name}</span>
              )}
              <p className="text-xs text-ink-500">
                {currency(unitPrice)} × {item.quantity}
                {brandName ? ` · ${brandName}` : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-display text-sm">{currency(lineTotal)}</span>
              {item.status && <Badge tone={statusTone(item.status)}>{item.status}</Badge>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function OrderStatusTimeline({ order, items = [] }) {
  const statuses = items.map((item) => item.status || 'Not processed')
  const allCancelled = statuses.length > 0 && statuses.every((status) => status === 'Cancelled')
  const anyCancelled = statuses.some((status) => status === 'Cancelled')

  const steps = [
    { label: 'Order placed', description: 'We received your order.' },
    { label: 'Processing', description: 'Items are being picked and packed.' },
    { label: 'Shipped', description: 'On the way to your address.' },
    { label: 'Delivered', description: 'Order completed.' }
  ]

  let reached = 0
  if (allCancelled) reached = -1
  else if (statuses.length && statuses.every((status) => status === 'Delivered')) reached = 3
  else if (statuses.some((status) => status === 'Shipped' || status === 'Delivered')) reached = 2
  else if (statuses.some((status) => status === 'Processing')) reached = 1

  return (
    <div className="card-surface p-5">
      <h2 className="font-display text-lg">Status</h2>
      {allCancelled ? (
        <p className="mt-3 text-sm text-brand-700">
          This order was cancelled on {shortDate(order?.updated || order?.created)}. Stock has been returned to the
          catalogue and the order record is being removed.
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {steps.map((step, index) => {
            const done = index <= reached
            const current = index === reached
            return (
              <li key={step.label} className="flex gap-3">
                <span className="flex flex-col items-center">
                  <span
                    className={clsx(
                      'grid size-6 place-items-center rounded-full border text-[11px] font-semibold',
                      done ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-400'
                    )}
                  >
                    {index + 1}
                  </span>
                  {index < steps.length - 1 && (
                    <span className={clsx('mt-1 w-px flex-1', index < reached ? 'bg-brand-300' : 'bg-ink-200')} />
                  )}
                </span>
                <div className="pb-1">
                  <p className={clsx('text-sm font-medium', done ? 'text-ink-900' : 'text-ink-500')}>
                    {step.label}
                    {current && <span className="ml-2 text-xs font-normal text-brand-600">current</span>}
                  </p>
                  <p className="text-xs text-ink-500">{step.description}</p>
                </div>
              </li>
            )
          })}
          {anyCancelled && !allCancelled && (
            <li className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">
              Some line items were cancelled; those quantities are back in stock.
            </li>
          )}
        </ol>
      )}
    </div>
  )
}
