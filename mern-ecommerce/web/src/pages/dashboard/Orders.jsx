import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ChevronDown, Package, ShoppingBag } from 'lucide-react'
import clsx from 'clsx'
import { PageHeader } from '../../components/account/PageHeader'
import { StatusBadge } from '../../components/account/StatusBadge'
import { OrderDetailPanel } from '../../components/account/OrderDetailPanel'
import { FormAlert } from '../../components/account/FormAlert'
import { OrderLines, SearchInput, SegmentedTabs, useClampPage } from '../../components/manager'
import { apiErrorMessage } from '../../lib/apiError'
import { Badge, EmptyState, LoadingBlock } from '../../components/ui/Display'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { ProductArt } from '../../components/catalog/ProductCard'
import { selectRole } from '../../features/auth/authSlice'
import {
  useCancelOrderMutation,
  useMyOrdersQuery,
  useOrdersQuery,
  useSearchOrdersQuery
} from '../../features/orders/orderApi'
import { toastShown } from '../../features/ui/uiSlice'
import { currency, shortDate } from '../../lib/format'
import { canCancelOrder } from '../../lib/orders'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const LIMIT = 10
// GET /order/search matches one order by its full ObjectId.
const ORDER_ID_LENGTH = 24

export default function Orders() {
  useDocumentTitle('Orders')
  const dispatch = useDispatch()
  const isAdmin = useSelector(selectRole) === 'ROLE ADMIN'

  const [view, setView] = useState('all') // admins only; everyone else is always on 'mine'
  const [page, setPage] = useState(1)
  const [orderId, setOrderId] = useState('')
  const [openId, setOpenId] = useState(null)
  const [pendingCancel, setPendingCancel] = useState(null)

  const scope = isAdmin ? view : 'mine'
  const searching = scope === 'all' && orderId.length >= ORDER_ID_LENGTH

  const mine = useMyOrdersQuery({ page, limit: LIMIT }, { skip: scope !== 'mine' })
  const everyone = useOrdersQuery({ page, limit: LIMIT }, { skip: scope !== 'all' || searching })
  const found = useSearchOrdersQuery(orderId, { skip: !searching })
  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation()

  useClampPage(page, scope === 'mine' ? mine.data?.totalPages : everyone.data?.totalPages, setPage)

  const active = scope === 'mine' ? mine : searching ? found : everyone
  const { data, isLoading, isFetching, isError, error } = active
  const orders = data?.orders || []
  const totalPages = searching ? 1 : data?.totalPages || 1
  const currentPage = Math.min(page, totalPages)

  const changeView = (next) => {
    setView(next)
    setOrderId('')
    setPage(1)
    setOpenId(null)
  }

  const confirmCancel = async () => {
    if (!pendingCancel) return
    try {
      await cancelOrder(pendingCancel._id).unwrap()
      dispatch(toastShown({ type: 'success', message: 'Order has been cancelled successfully' }))
      setPendingCancel(null)
      setOpenId(null)
    } catch (requestError) {
      if (requestError?.data?.code === 'ORDER_DISPATCHED') {
        // A line shipped after this list was loaded; the cancelOrder tags make the list refetch.
        setPendingCancel(null)
        dispatch(
          toastShown({
            type: 'info',
            message: 'This order has already been dispatched, so it can no longer be cancelled.'
          })
        )
      } else {
        dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'The order could not be cancelled.') }))
      }
    }
  }

  const description =
    scope === 'all'
      ? `${data?.count ?? orders.length} order${(data?.count ?? orders.length) === 1 ? '' : 's'} across all customers, newest first. Move each line through fulfilment from its details.`
      : data?.count
        ? `${data.count} order${data.count === 1 ? '' : 's'} placed with this account.`
        : 'Everything you have ordered so far.'

  return (
    <>
      <PageHeader
        eyebrow={scope === 'all' ? 'Fulfilment' : 'Account'}
        title={scope === 'all' ? 'All orders' : 'Orders'}
        description={description}
        action={
          <ButtonLink to="/shop" variant="outline" size="sm">
            <ShoppingBag size={15} /> Continue shopping
          </ButtonLink>
        }
      />

      {isAdmin && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs
            label="Order scope"
            value={view}
            onChange={changeView}
            options={[
              { value: 'all', label: 'All orders' },
              { value: 'mine', label: 'My orders' }
            ]}
          />
          {scope === 'all' && (
            <SearchInput
              onChange={(value) => {
                setOrderId(value)
                setPage(1)
                setOpenId(null)
              }}
              minLength={ORDER_ID_LENGTH}
              placeholder="Find an order by its full id…"
              pending={searching && isFetching}
            />
          )}
        </div>
      )}

      {isLoading && <LoadingBlock label={scope === 'all' ? 'Loading orders…' : 'Loading your orders…'} />}

      {isError && !isLoading && <FormAlert>{apiErrorMessage(error, 'Your orders could not be loaded.')}</FormAlert>}

      {!isLoading && !isError && orders.length === 0 && (
        <EmptyState
          icon={Package}
          title={searching ? 'No order has that id.' : scope === 'all' ? 'No orders yet.' : 'You have no orders yet.'}
          description={
            scope === 'all'
              ? 'Orders placed from the storefront appear here with their fulfilment status.'
              : 'Once you place an order it will appear here with its delivery status.'
          }
          action={scope === 'mine' ? <ButtonLink to="/shop">Browse the catalogue</ButtonLink> : undefined}
        />
      )}

      {orders.length > 0 && (
        <div className={clsx('space-y-4', isFetching && 'opacity-60 transition-opacity')}>
          {orders.map((order) => {
            const expanded = openId === order._id
            const first = order.products?.[0]?.product
            const cancellable = canCancelOrder(order.products)
            return (
              <article key={order._id} className="card-surface overflow-hidden">
                <div className="flex flex-wrap items-center gap-4 p-4">
                  <ProductArt product={first || {}} className="size-16 shrink-0 rounded-xl" />

                  <div className="min-w-0">
                    <p className="font-mono text-xs text-ink-500">
                      {scope === 'all' ? <span className="select-all">{order._id}</span> : `#${String(order._id).slice(-10)}`}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-700">Ordered on {shortDate(order.created)}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {order.products?.length || 0} item{order.products?.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="ml-auto text-right">
                    <p className="font-display text-lg">{currency(order.totalWithTax ?? order.total)}</p>
                    <p className="text-xs text-ink-500">incl. {currency(order.totalTax)} tax</p>
                  </div>

                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOpenId(expanded ? null : order._id)}
                      aria-expanded={expanded}
                    >
                      {expanded ? 'Hide details' : 'View details'}
                      <ChevronDown size={15} className={clsx('transition-transform', expanded && 'rotate-180')} />
                    </Button>
                    {cancellable && (
                      <Button size="sm" variant="danger" onClick={() => setPendingCancel(order)}>
                        Cancel order
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-ink-100 px-4 py-3">
                  {(order.products || []).map((item) => (
                    <span
                      key={item._id}
                      className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-600"
                    >
                      {item.product?.slug ? (
                        <Link to={`/product/${item.product.slug}`} className="max-w-40 truncate hover:text-brand-700">
                          {item.product?.name || 'Product unavailable'}
                        </Link>
                      ) : (
                        <span className="max-w-40 truncate">{item.product?.name || 'Product unavailable'}</span>
                      )}
                      <span className="text-ink-400">×{item.quantity}</span>
                      <StatusBadge status={item.status} />
                    </span>
                  ))}
                </div>

                {expanded && (
                  <div className="space-y-5 px-4 pb-4">
                    {scope === 'all' && <OrderLines orderId={order._id} onOrderRemoved={() => setOpenId(null)} />}
                    <OrderDetailPanel
                      orderId={order._id}
                      fallback={order}
                      onCancel={cancellable ? setPendingCancel : undefined}
                      cancelling={isCancelling}
                    />
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          className="mt-8"
          page={currentPage}
          totalPages={totalPages}
          onChange={(next) => {
            setOpenId(null)
            setPage(next)
          }}
        />
      )}

      <Modal
        open={Boolean(pendingCancel)}
        onClose={() => setPendingCancel(null)}
        title="Cancel order"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingCancel(null)}>
              Keep order
            </Button>
            <Button variant="danger" loading={isCancelling} onClick={confirmCancel}>
              Cancel order
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Cancelling order <Badge tone="neutral">#{String(pendingCancel?._id || '').slice(-10)}</Badge> restores the
          stock for every line item and removes the order permanently. This cannot be undone.
        </p>
      </Modal>
    </>
  )
}
