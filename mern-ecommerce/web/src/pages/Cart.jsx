import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react'
import { EmptyState } from '../components/ui/Display'
import { Button, ButtonLink } from '../components/ui/Button'
import { ProductArt } from '../components/catalog/ProductCard'
import { QuantityStepper } from '../components/store/QuantityStepper'
import { TotalsPanel } from '../components/store/OrderSummary'
import { BagNotices } from '../components/store/BagNotices'
import {
  TAX_RATE,
  cartCleared,
  itemQuantityChanged,
  itemRemoved,
  lineLimit,
  selectCartCount,
  selectCartItems,
  selectCartSubtotal,
  selectCartTax,
  selectCartTotal
} from '../features/cart/cartSlice'
import { useRevalidateCart } from '../features/cart/useRevalidateCart'
import { selectIsAuthenticated } from '../features/auth/authSlice'
import { toastShown } from '../features/ui/uiSlice'
import { currency, plural } from '../lib/format'
import { lineTotal } from '../lib/orders'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function Cart() {
  useDocumentTitle('Your bag')
  const dispatch = useDispatch()
  const { notices, checking, dismiss } = useRevalidateCart()
  const items = useSelector(selectCartItems)
  const count = useSelector(selectCartCount)
  const subtotal = useSelector(selectCartSubtotal)
  const tax = useSelector(selectCartTax)
  const total = useSelector(selectCartTotal)
  const authenticated = useSelector(selectIsAuthenticated)

  if (items.length === 0) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl">
          <BagNotices notices={notices} onDismiss={dismiss} />
        </div>
        <EmptyState
          icon={ShoppingBag}
          title="Your bag is empty"
          description="Browse the shop and add products to your bag."
          action={<ButtonLink to="/shop">Browse products</ButtonLink>}
          className="mx-auto max-w-xl"
        />
      </div>
    )
  }

  const clear = () => {
    dispatch(cartCleared())
    dispatch(toastShown({ type: 'info', message: 'Your bag has been emptied' }))
  }

  return (
    <div className="container-page py-10">
      <BagNotices notices={notices} onDismiss={dismiss} />
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your bag</p>
          <h1 className="mt-1 font-display text-3xl">{plural(count, 'item')}</h1>
          <p className="mt-2 text-sm text-ink-500">
            {checking ? 'Checking prices and availability…' : 'Prices and availability were just checked.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clear}>
            <Trash2 size={14} /> Empty bag
          </Button>
          <ButtonLink to="/shop" variant="outline" size="sm">
            Continue shopping
          </ButtonLink>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.7fr_1fr]">
        <div className="card-surface overflow-hidden">
          <div className="hidden grid-cols-[2.5fr_1fr_1fr_1fr_auto] gap-4 border-b border-ink-100 px-5 py-3 text-xs font-semibold tracking-wide text-ink-500 uppercase sm:grid">
            <span>Product</span>
            <span className="text-right">Unit price</span>
            <span className="text-center">Quantity</span>
            <span className="text-right">Line total</span>
            <span className="w-8" />
          </div>

          <ul className="divide-y divide-ink-100">
            {items.map((item) => (
              <li
                key={item.product}
                className="grid grid-cols-[auto_1fr] gap-4 px-5 py-4 sm:grid-cols-[2.5fr_1fr_1fr_1fr_auto] sm:items-center"
              >
                <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
                  <ProductArt product={item} className="size-14 shrink-0 rounded-xl" />
                  <div className="min-w-0">
                    <Link to={`/product/${item.slug}`} className="text-sm font-medium hover:text-brand-700">
                      {item.name}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {item.brand ? `${item.brand} · ` : ''}
                      {item.taxable ? 'Taxable' : 'Tax free'}
                    </p>
                  </div>
                </div>

                <span className="text-sm text-ink-700 sm:text-right">{currency(item.price)}</span>

                <div className="justify-self-start sm:justify-self-center">
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(quantity) => dispatch(itemQuantityChanged({ product: item.product, quantity }))}
                    size="sm"
                    max={lineLimit(item)}
                  />
                  {item.stock != null && item.quantity >= item.stock && (
                    <p className="mt-1 text-center text-[11px] text-ink-500">Only {item.stock} available</p>
                  )}
                </div>

                <span className="font-display text-sm sm:text-right">{currency(lineTotal(item))}</span>

                <button
                  type="button"
                  onClick={() => dispatch(itemRemoved(item.product))}
                  aria-label={`Remove ${item.name} from your bag`}
                  className="justify-self-end text-ink-400 transition-colors hover:text-brand-600"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <TotalsPanel
            subtotal={subtotal}
            tax={tax}
            total={total}
            itemCount={count}
            footer={
              authenticated ? (
                <ButtonLink to="/checkout" size="lg" className="w-full">
                  Proceed to checkout <ArrowRight size={16} />
                </ButtonLink>
              ) : (
                <ButtonLink to="/login" size="lg" className="w-full">
                  Sign in to check out <ArrowRight size={16} />
                </ButtonLink>
              )
            }
          />
          {!authenticated && (
            <p className="text-xs text-ink-500">
              You need an account to place an order —{' '}
              <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
                sign in
              </Link>{' '}
              or{' '}
              <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800">
                create one
              </Link>
              . Your bag is kept in this browser either way.
            </p>
          )}
          <div className="card-surface p-5 text-xs text-ink-500">
            <p>
              Line totals are before tax. Tax is estimated at {TAX_RATE}% on taxable items and shown in the order summary.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
