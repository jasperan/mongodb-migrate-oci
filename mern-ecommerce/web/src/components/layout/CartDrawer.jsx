import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import {
  itemQuantityChanged,
  itemRemoved,
  selectCartItems,
  selectCartSubtotal,
  selectCartTax,
  selectCartTotal
} from '../../features/cart/cartSlice'
import { cartToggled } from '../../features/ui/uiSlice'
import { currency } from '../../lib/format'
import { ProductArt } from '../catalog/ProductCard'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/Display'

export function CartDrawer() {
  const dispatch = useDispatch()
  const open = useSelector((state) => state.ui.cartOpen)
  const items = useSelector(selectCartItems)
  const subtotal = useSelector(selectCartSubtotal)
  const tax = useSelector(selectCartTax)
  const total = useSelector(selectCartTotal)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-950/40" onClick={() => dispatch(cartToggled(false))} aria-hidden />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-lg">
            <ShoppingBag size={18} /> Your bag
            <span className="text-sm font-normal text-ink-500">({items.length})</span>
          </h2>
          <IconButton label="Close cart" onClick={() => dispatch(cartToggled(false))}>
            <X size={18} />
          </IconButton>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Your bag is empty"
              description="Browse the catalogue and add products to get started."
              action={
                <Button size="sm" onClick={() => dispatch(cartToggled(false))}>
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
                    <Link to={`/product/${item.slug}`} className="text-sm font-medium hover:text-brand-700">
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
                          className="grid size-7 place-items-center text-ink-600"
                          onClick={() => dispatch(itemQuantityChanged({ product: item.product, quantity: item.quantity + 1 }))}
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
                  <span className="font-display text-sm">{currency(item.priceWithTax)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer className="border-t border-ink-200 px-5 py-4">
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
              <Button variant="outline" className="flex-1" onClick={() => dispatch(cartToggled(false))}>
                Keep shopping
              </Button>
              <Link
                to="/checkout"
                onClick={() => dispatch(cartToggled(false))}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-brand-600 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                Checkout
              </Link>
            </div>
          </footer>
        )}
      </aside>
    </div>
  )
}
