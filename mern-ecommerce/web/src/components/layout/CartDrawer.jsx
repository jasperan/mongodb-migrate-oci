import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import {
  itemQuantityChanged,
  lineLimit,
  itemRemoved,
  selectCartCount,
  selectCartItems,
  selectCartSubtotal,
  selectCartTax,
  selectCartTotal
} from '../../features/cart/cartSlice'
import { cartToggled } from '../../features/ui/uiSlice'
import { currency, plural } from '../../lib/format'
import { lineTotal } from '../../lib/orders'
import { ProductArt } from '../catalog/ProductCard'
import { Button, ButtonLink, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/Display'
import { dialogPortal, useDialog } from '../ui/useDialog'

export function CartDrawer() {
  const dispatch = useDispatch()
  const open = useSelector((state) => state.ui.cartOpen)
  const items = useSelector(selectCartItems)
  const units = useSelector(selectCartCount)
  const subtotal = useSelector(selectCartSubtotal)
  const tax = useSelector(selectCartTax)
  const total = useSelector(selectCartTotal)

  const close = () => dispatch(cartToggled(false))
  const { titleId, panelProps } = useDialog({ open, onClose: close })

  if (!open) return null

  return dialogPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-950/40" onClick={close} aria-hidden />
      <aside {...panelProps} className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl outline-none">
        <header className="flex shrink-0 items-center justify-between border-b border-ink-200 px-5 py-4">
          <h2 id={titleId} className="flex items-center gap-2 font-display text-lg">
            <ShoppingBag size={18} aria-hidden /> Your bag
            <span className="text-sm font-normal text-ink-500">({plural(units, 'item')})</span>
          </h2>
          <IconButton label="Close cart" data-dialog-close onClick={close}>
            <X size={18} />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Your bag is empty"
              description="Browse the catalogue and add products to get started."
              action={
                <Button size="sm" onClick={close}>
                  Continue shopping
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li key={item.product} className="flex gap-3">
                  <ProductArt product={item} className="size-16 shrink-0 rounded-xl" />
                  <div className="flex flex-1 flex-col">
                    <Link to={`/product/${item.slug}`} onClick={close} className="text-sm font-medium hover:text-brand-700">
                      {item.name}
                    </Link>
                    <span className="text-xs text-ink-500">{currency(item.price)} each</span>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="inline-flex items-center rounded-full border border-ink-200">
                        <button
                          className="grid size-7 place-items-center text-ink-600 disabled:opacity-40"
                          onClick={() =>
                            dispatch(itemQuantityChanged({ product: item.product, quantity: item.quantity - 1 }))
                          }
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          className="grid size-7 place-items-center text-ink-600 disabled:opacity-40"
                          onClick={() => dispatch(itemQuantityChanged({ product: item.product, quantity: item.quantity + 1 }))}
                          disabled={item.quantity >= lineLimit(item)}
                          aria-label="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <button
                        className="text-ink-400 transition-colors hover:text-brand-600"
                        onClick={() => dispatch(itemRemoved(item.product))}
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <span className="font-display text-sm">{currency(lineTotal(item))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer className="shrink-0 border-t border-ink-200 px-5 py-4">
            <dl className="mb-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Subtotal</dt>
                <dd>{currency(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Estimated tax</dt>
                <dd>{currency(tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-dashed border-ink-200 pt-2 font-display text-base">
                <dt>Total</dt>
                <dd>{currency(total)}</dd>
              </div>
            </dl>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={close}>
                Keep shopping
              </Button>
              <ButtonLink to="/checkout" onClick={close} className="flex-1">
                Checkout
              </ButtonLink>
            </div>
          </footer>
        )}
      </aside>
    </div>
  )
}
