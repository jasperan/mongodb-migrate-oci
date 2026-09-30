import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { CheckCircle2, MapPin, PackageCheck, Plus, ShieldCheck, Truck } from 'lucide-react'
import clsx from 'clsx'
import { Badge, EmptyState, LoadingBlock } from '../components/ui/Display'
import { Button, ButtonLink } from '../components/ui/Button'
import { Checkbox, Field, Input, Textarea } from '../components/ui/Field'
import { OrderItemsTable, TotalsPanel } from '../components/store/OrderSummary'
import {
  cartCleared,
  selectCartCount,
  selectCartItems,
  selectCartSubtotal,
  selectCartTax,
  selectCartTotal,
  toCartPayload
} from '../features/cart/cartSlice'
import { useCreateCartMutation } from '../features/cart/cartApi'
import { useCreateOrderMutation } from '../features/orders/orderApi'
import { useAddAddressMutation, useAddressesQuery } from '../features/address/addressApi'
import { selectIsAuthenticated } from '../features/auth/authSlice'
import { toastShown } from '../features/ui/uiSlice'
import { currency } from '../lib/format'

const EMPTY_ADDRESS = { address: '', city: '', state: '', country: '', zipCode: '', isDefault: false }

export default function Checkout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const authenticated = useSelector(selectIsAuthenticated)

  const items = useSelector(selectCartItems)
  const count = useSelector(selectCartCount)
  const subtotal = useSelector(selectCartSubtotal)
  const tax = useSelector(selectCartTax)
  const total = useSelector(selectCartTotal)

  const { data, isLoading: loadingAddresses } = useAddressesQuery(undefined, { skip: !authenticated })
  const [addAddress, { isLoading: savingAddress }] = useAddAddressMutation()
  const [createCart, { isLoading: creatingCart }] = useCreateCartMutation()
  const [createOrder, { isLoading: creatingOrder }] = useCreateOrderMutation()

  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_ADDRESS)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)

  const addresses = data?.addresses || []
  const placing = creatingCart || creatingOrder

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

  if (items.length === 0) {
    return (
      <div className="container-page py-16">
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

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const saveAddress = async (event) => {
    event.preventDefault()
    const next = {}
    if (!form.address.trim()) next.address = 'Street address is required.'
    if (!form.city.trim()) next.city = 'City is required.'
    if (!form.state.trim()) next.state = 'State is required.'
    if (!form.country.trim()) next.country = 'Country is required.'
    if (!form.zipCode.trim()) next.zipCode = 'Zip code is required.'
    setErrors(next)
    if (Object.keys(next).length) return

    try {
      const response = await addAddress(form).unwrap()
      dispatch(toastShown({ type: 'success', message: response?.message || 'Address saved' }))
      if (response?.address?._id) setSelected(response.address._id)
      setForm(EMPTY_ADDRESS)
      setShowForm(false)
    } catch (error) {
      const message = error?.data?.error || 'We could not save this address.'
      setErrors({ form: message })
      dispatch(toastShown({ type: 'error', message }))
    }
  }

  const placeOrder = async () => {
    setSubmitError(null)
    try {
      // Stock is decremented when the cart document is created, so the order is
      // always created from a freshly minted server cart.
      const cart = await createCart(toCartPayload(items)).unwrap()
      const order = await createOrder(cart.cartId).unwrap()
      dispatch(cartCleared())
      dispatch(
        toastShown({ type: 'success', message: order?.message || 'Your order has been placed successfully!' })
      )
      navigate(`/order/success/${order.order._id}`, { replace: true })
    } catch (error) {
      const message = error?.data?.error || 'We could not place your order. Please try again.'
      setSubmitError(message)
      dispatch(toastShown({ type: 'error', message }))
    }
  }

  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <p className="eyebrow">Checkout</p>
        <h1 className="mt-1 font-display text-3xl">Delivery &amp; confirmation</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-500">
          Pick a delivery address, review the bag, and place the order. The bag becomes a server cart in{' '}
          <code className="text-ink-700">carts</code>, then an order document linked to it.
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
              <form onSubmit={saveAddress} className="mt-5 rounded-xl border border-ink-200 bg-ink-50/60 p-4">
                <h3 className="font-display text-sm">Add a new address</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Street address" required error={errors.address} className="sm:col-span-2">
                    <Textarea
                      rows={2}
                      value={form.address}
                      onChange={(event) => change('address', event.target.value)}
                      placeholder="1 Market Street"
                    />
                  </Field>
                  <Field label="City" required error={errors.city}>
                    <Input value={form.city} onChange={(event) => change('city', event.target.value)} />
                  </Field>
                  <Field label="State" required error={errors.state}>
                    <Input value={form.state} onChange={(event) => change('state', event.target.value)} />
                  </Field>
                  <Field label="Country" required error={errors.country}>
                    <Input value={form.country} onChange={(event) => change('country', event.target.value)} />
                  </Field>
                  <Field label="Zip code" required error={errors.zipCode}>
                    <Input value={form.zipCode} onChange={(event) => change('zipCode', event.target.value)} />
                  </Field>
                </div>
                <Checkbox
                  className="mt-3"
                  label="Use as my default address"
                  checked={form.isDefault}
                  onChange={(event) => change('isDefault', event.target.checked)}
                />
                {errors.form && <p className="mt-3 text-xs text-brand-700">{errors.form}</p>}
                <Button type="submit" size="sm" className="mt-4" loading={savingAddress}>
                  Save address
                </Button>
              </form>
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
              Stock is reserved the moment the cart is created, and released again if the order is cancelled.
            </div>
            <div className="card-surface flex gap-3 p-4 text-sm text-ink-600">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ink-400" />
              Payment is not collected in this demo — placing the order writes the order document and returns its id.
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
                {submitError && (
                  <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">{submitError}</p>
                )}
                <Button size="lg" className="w-full" onClick={placeOrder} disabled={!selected} loading={placing}>
                  Place order · {currency(total)}
                </Button>
                <ButtonLink to="/cart" variant="ghost" size="sm" className="w-full">
                  Back to bag
                </ButtonLink>
              </div>
            }
          />
          <p className="text-xs text-ink-500">
            The server recomputes tax and totals from the line items on every read, so the stored order and this summary
            are derived from the same server-side calculation.
          </p>
        </div>
      </div>
    </div>
  )
}
