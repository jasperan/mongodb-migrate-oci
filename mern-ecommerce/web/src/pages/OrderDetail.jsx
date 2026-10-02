import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowLeft, Ban, PackageSearch, ServerCrash } from 'lucide-react'
import { Badge, EmptyState, LoadingBlock } from '../components/ui/Display'
import { Button, ButtonLink } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { OrderItemsTable, OrderStatusTimeline, OrderTotals } from '../components/store/OrderSummary'
import { useCancelOrderMutation, useOrderByIdQuery } from '../features/orders/orderApi'
import { selectIsAuthenticated, selectRole } from '../features/auth/authSlice'
import { toastShown } from '../features/ui/uiSlice'
import { currency, dateTime } from '../lib/format'
import { canCancelOrder } from '../lib/orders'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function OrderDetail() {
  const { id } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const authenticated = useSelector(selectIsAuthenticated)
  const role = useSelector(selectRole)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const { data, isLoading, isError, error, refetch } = useOrderByIdQuery(id, { skip: !id || !authenticated })
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation()

  const order = data?.order
  useDocumentTitle(order ? `Order ${order._id.slice(-6)}` : 'Order')

  if (!authenticated) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={PackageSearch}
          title="Sign in to view this order"
          description="Orders are private to the account that placed them. Sign in and try again."
          action={
            <ButtonLink to="/login" state={{ from: `/order/${id}` }}>
              Sign in
            </ButtonLink>
          }
          className="mx-auto max-w-xl"
        />
      </div>
    )
  }

  if (isLoading) return <LoadingBlock label="Loading your order…" className="py-24" />

  if (isError || !order) {
    const notFound = error?.status === 404
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={notFound ? PackageSearch : ServerCrash}
          title={notFound ? 'No order found' : 'We could not load this order'}
          description={
            notFound
              ? `No order matches the id ${id} for your account. It may already have been cancelled.`
              : 'We could not load this order. Please try again.'
          }
          action={
            notFound ? (
              <ButtonLink to="/dashboard/orders">Back to my orders</ButtonLink>
            ) : (
              <Button onClick={() => refetch()}>Retry</Button>
            )
          }
          className="mx-auto max-w-xl"
        />
      </div>
    )
  }

  const items = order.products || []
  const allCancelled = items.length > 0 && items.every((item) => item.status === 'Cancelled')
  const cancellable = !allCancelled && canCancelOrder(items)

  const cancel = async () => {
    try {
      await cancelOrder(order._id).unwrap()
      dispatch(toastShown({ type: 'success', message: 'Your order has been cancelled successfully' }))
      setConfirmOpen(false)
      navigate('/dashboard/orders', { replace: true })
    } catch (cancelError) {
      if (cancelError?.data?.code === 'ORDER_DISPATCHED') {
        // The cancelOrder tags refetch the order, so the button disappears with the new statuses.
        setConfirmOpen(false)
        dispatch(
          toastShown({
            type: 'info',
            message: 'This order has already been dispatched, so it can no longer be cancelled.'
          })
        )
      } else {
        dispatch(
          toastShown({
            type: 'error',
            message: cancelError?.data?.error || 'We could not cancel this order. Please try again.'
          })
        )
      }
    }
  }

  return (
    <div className="container-page py-10">
      <Link to="/dashboard/orders" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700">
        <ArrowLeft size={15} /> Back to my orders
      </Link>

      <header className="mt-4 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Order detail</p>
          <h1 className="mt-1 font-display text-3xl">Order {order._id}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-500">
            {order.created && <span>Placed {dateTime(order.created)}</span>}
            <Badge tone={allCancelled ? 'brand' : 'duality'}>
              {allCancelled ? 'Cancelled' : `${items.length} item${items.length === 1 ? '' : 's'}`}
            </Badge>
            {role === 'ROLE ADMIN' && <Badge tone="dark">Admin view</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-2xl">{currency(order.totalWithTax ?? order.total)}</span>
          {cancellable && (
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              <Ban size={15} /> Cancel order
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="card-surface p-5">
          <h2 className="font-display text-lg">Items</h2>
          <OrderItemsTable items={items} className="mt-2" />
        </div>

        <div className="flex flex-col gap-4">
          <OrderTotals order={order} />
          <OrderStatusTimeline order={order} items={items} />
          <div className="card-surface p-5 text-xs text-ink-500">
            <p>
              Cancelling the order removes it and returns every item to stock.
            </p>
          </div>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancel this order?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep order
            </Button>
            <Button variant="danger" loading={cancelling} onClick={cancel}>
              Yes, cancel it
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          The whole order is cancelled and every item goes back on sale. This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
