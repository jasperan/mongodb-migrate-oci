import { useParams } from 'react-router-dom'
import { CheckCircle2, PackageSearch, ServerCrash } from 'lucide-react'
import { Badge, EmptyState, LoadingBlock } from '../components/ui/Display'
import { Button, ButtonLink } from '../components/ui/Button'
import { OrderItemsTable, OrderTotals } from '../components/store/OrderSummary'
import { useOrderByIdQuery } from '../features/orders/orderApi'
import { dateTime } from '../lib/format'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function OrderSuccess() {
  const { id } = useParams()
  const { data, isLoading, isError, error, refetch } = useOrderByIdQuery(id, { skip: !id })
  const order = data?.order
  useDocumentTitle(order ? 'Order placed' : 'Your order')

  if (isLoading) return <LoadingBlock label="Fetching your order…" className="py-24" />

  if (isError || !order) {
    const notFound = error?.status === 404
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={notFound ? PackageSearch : ServerCrash}
          title={notFound ? 'No order found' : 'We could not load this order'}
          description={
            notFound
              ? `No order matches the id ${id}. It may have been cancelled or you may not have access to it.`
              : 'We could not load this order. Make sure you are signed in as the account that placed it.'
          }
          action={
            notFound ? (
              <ButtonLink to="/shop">Continue shopping</ButtonLink>
            ) : (
              <Button onClick={() => refetch()}>Retry</Button>
            )
          }
        />
      </div>
    )
  }

  const items = order.products || []

  return (
    <div className="container-page py-12">
      <div className="card-surface mx-auto max-w-3xl p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
          <CheckCircle2 size={28} />
        </span>
        <h1 className="mt-4 font-display text-3xl">Thank you for your order</h1>
        <p className="mt-2 text-sm text-ink-600">
          Your order is confirmed and the items are reserved for you. You can follow its progress from your orders.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Badge tone="success">Order placed</Badge>
          <span className="font-mono text-xs text-ink-500">{order._id}</span>
          {order.created && <span className="text-xs text-ink-500">· {dateTime(order.created)}</span>}
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-4xl gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="card-surface p-5">
          <h2 className="font-display text-lg">What you ordered</h2>
          <OrderItemsTable items={items} className="mt-2" />
        </div>
        <div className="flex flex-col gap-4">
          <OrderTotals order={order} />
          <div className="card-surface flex flex-col gap-2 p-5">
            <ButtonLink to={`/order/${order._id}`} className="w-full">
              View order details
            </ButtonLink>
            <ButtonLink to="/dashboard/orders" variant="outline" className="w-full">
              Manage orders
            </ButtonLink>
            <ButtonLink to="/shop" variant="ghost" className="w-full">
              Continue shopping
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  )
}
