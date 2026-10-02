import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { CheckCircle2, MapPin, PackageCheck, Plus, ShieldCheck, Truck } from 'lucide-react'
import clsx from 'clsx'
import { Badge, EmptyState, LoadingBlock } from '../components/ui/Display'
import { Button, ButtonLink } from '../components/ui/Button'
import { AddressForm } from '../components/account/AddressForm'
import { FormAlert } from '../components/account/FormAlert'
import { BagNotices } from '../components/store/BagNotices'
import { OrderItemsTable, TotalsPanel } from '../components/store/OrderSummary'
import {
  cartCleared,
  cartLinesSynced,
  selectCartCount,
  selectCartItems,
  selectCartSubtotal,
  selectCartTax,
  selectCartTotal
} from '../features/cart/cartSlice'
import { useRevalidateCart } from '../features/cart/useRevalidateCart'
import { useCheckoutMutation } from '../features/orders/orderApi'
import { useAddAddressMutation, useAddressesQuery } from '../features/address/addressApi'
import { selectIsAuthenticated } from '../features/auth/authSlice'
import { toastShown } from '../features/ui/uiSlice'
import { apiErrorMessage } from '../lib/apiError'
import { currency } from '../lib/format'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function Checkout() {
  useDocumentTitle('Checkout')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const authenticated = useSelector(selectIsAuthenticated)

  const items = useSelector(selectCartItems)
  const count = useSelector(selectCartCount)
  const subtotal = useSelector(selectCartSubtotal)
  const tax = useSelector(selectCartTax)
  const total = useSelector(selectCartTotal)

  const { notices, checking, dismiss } = useRevalidateCart()
  const { data, isLoading: loadingAddresses } = useAddressesQuery(undefined, { skip: !authenticated })
  const [addAddress, { isLoading: savingAddress }] = useAddAddressMutation()
  const [checkout, { isLoading: placing }] = useCheckoutMutation()
  const inFlight = useRef(false)

  const [selected, setSelected] = useState(null)
  const [placed, setPlaced] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  const addresses = data?.addresses || []

  useEffect(() => {
    if (selected || addresses.length === 0) return
    const preferred = addresses.find((address) => address.isDefault) || addresses[0]
    setSelected(preferred._id)
    setShowForm(false)
  }, [addresses, selected])

  // checkout is gated on a session before anything is read or written
  if (!authenticated) {
    return <Navigate to="/login" state={{ from: '/checkout' }} replace />
  }

  // Clearing the bag re-renders this page before the lazily loaded confirmation
  // route has resolved; without this the shopper would see "Nothing to check out".
  if (placed) return <LoadingBlock label="Order placed — opening your confirmation…" className="py-24" />

  if (items.length === 0) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl">
          <BagNotices notices={notices} onDismiss={dismiss} />
        </div>
        <EmptyState
          icon={PackageCheck}
          title="Nothing to check out"
          description="Your bag is empty, so there is no order to place yet."
          action={<ButtonLink to="/shop">Browse products</ButtonLink>}
          className="mx-auto max-w-xl"
        />
      </div>
    )
  }

  const saveAddress = async (values) => {
    setFormError(null)
    try {
      const response = await addAddress(values).unwrap()
      dispatch(toastShown({ type: 'success', message: response?.message || 'Address saved' }))
      if (response?.address?._id) setSelected(response.address._id)
      setShowForm(false)
    } catch (error) {
      const message = apiErrorMessage(error, 'We could not save this address.')
      setFormError(message)
      dispatch(toastShown({ type: 'error', message }))
    }
  }

  // The server prices every line itself and reserves stock atomically, so the
  // request carries only ids and quantities; a failure leaves nothing reserved.
  const placeOrder = async () => {
    if (inFlight.current || checking || !selected) return
    inFlight.current = true
    setSubmitError(null)
    try {
      const result = await checkout(items.map(({ product, quantity }) => ({ product, quantity }))).unwrap()
      setPlaced(true)
      dispatch(cartCleared())
      dispatch(toastShown({ type: 'success', message: result?.message || 'Your order has been placed.' }))
      navigate(`/order/success/${result.order._id}`, { replace: true })
    } catch (error) {
      const code = error?.data?.code
      const productId = error?.data?.product
      let message = apiErrorMessage(error, 'We could not place your order. Please try again.')
      if (code === 'INSUFFICIENT_STOCK' && productId) {
        const available = Number(error.data.available)
        if (available > 0) {
          dispatch(cartLinesSynced({ updates: [{ product: productId, stock: available }] }))
          message += ' We lowered the quantity in your bag.'
        } else {
          const name = items.find((item) => item.product === productId)?.name
          dispatch(cartLinesSynced({ removed: [productId] }))
          message = `${name || 'An item'} is out of stock and was removed from your bag.`
        }
      } else if (code === 'PRODUCT_UNAVAILABLE' && productId) {
        dispatch(cartLinesSynced({ removed: [productId] }))
        message += ' It was removed from your bag.'
      }
      setSubmitError(message)
      dispatch(toastShown({ type: 'error', message }))
    } finally {
      inFlight.current = false
    }
  }

  return (
    <div className="container-page py-10">
      <BagNotices notices={notices} onDismiss={dismiss} />
      <header className="mb-8">
        <p className="eyebrow">Checkout</p>
        <h1 className="mt-1 font-display text-3xl">Delivery &amp; confirmation</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-500">
          Pick a delivery address, review your bag and place the order. Prices and availability are checked again when
          you place it.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="card-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-lg">
                <MapPin size={17} /> Delivery address
              </h2>
              <Button variant="outline" size="sm" onClick={() => setShowForm((open) => !open)}>
                <Plus size={14} /> {showForm ? 'Cancel' : 'New address'}
              </Button>
            </div>

            {loadingAddresses ? (
              <LoadingBlock label="Loading your addresses…" className="py-8" />
            ) : addresses.length === 0 && !showForm ? (
              <div className="mt-4 rounded-xl border border-dashed border-ink-300 px-4 py-6 text-center text-sm text-ink-500">
                No saved addresses yet — add one to continue.
              </div>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {addresses.map((address) => (
                  <li key={address._id}>
                    <label
                      className={clsx(
                        'flex cursor-pointer gap-3 rounded-xl border p-4 text-sm transition-colors',
                        selected === address._id
                          ? 'border-brand-400 bg-brand-50/60'
                          : 'border-ink-200 bg-white hover:border-ink-300'
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        className="mt-0.5 size-4 text-brand-600"
                        checked={selected === address._id}
                        onChange={() => setSelected(address._id)}
                      />
                      <span>
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-ink-900">{address.address}</span>
                          {address.isDefault && <Badge tone="duality">Default</Badge>}
                        </span>
                        <span className="mt-0.5 block text-ink-500">
                          {[address.city, address.state, address.country].filter(Boolean).join(', ')}
                          {address.zipCode ? ` ${address.zipCode}` : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            {showForm && (
              <div className="mt-5 rounded-xl border border-ink-200 bg-ink-50/60 p-4">
                <h3 className="mb-4 font-display text-sm">Add a new address</h3>
                {formError && <FormAlert className="mb-4">{formError}</FormAlert>}
                <AddressForm
                  onSubmit={saveAddress}
                  submitting={savingAddress}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            )}
          </section>

          <section className="card-surface p-6">
            <h2 className="flex items-center gap-2 font-display text-lg">
              <Truck size={17} /> Your bag
            </h2>
            <OrderItemsTable className="mt-2" items={items} />
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="card-surface flex gap-3 p-4 text-sm text-ink-600">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-ink-400" />
              Your items are set aside as soon as you place the order, and go back on sale if you cancel it.
            </div>
            <div className="card-surface flex gap-3 p-4 text-sm text-ink-600">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ink-400" />
              No payment is taken in this demo store, and the delivery address is not stored with the order.
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-28 lg:h-fit">
          <TotalsPanel
            subtotal={subtotal}
            tax={tax}
            total={total}
            itemCount={count}
            footer={
              <div className="space-y-3">
                {!selected && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Choose or add a delivery address to place the order.
                  </p>
                )}
                {submitError && <FormAlert>{submitError}</FormAlert>}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={placeOrder}
                  disabled={!selected || checking || placing}
                  loading={placing}
                >
                  Place order · {currency(total)}
                </Button>
                <ButtonLink to="/cart" variant="ghost" size="sm" className="w-full">
                  Back to bag
                </ButtonLink>
              </div>
            }
          />
        </div>
      </div>
    </div>
  )
}
