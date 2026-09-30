import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { CircleCheck, CircleX, MessageSquareQuote, Trash2 } from 'lucide-react'
import { Rating } from '../../components/ui/Display'
import { Button, IconButton } from '../../components/ui/Button'
import { ProductArt } from '../../components/catalog/ProductCard'
import {
  Avatar,
  ConfirmDialog,
  PageHeader,
  ResultMeta,
  SegmentedTabs,
  StatusBadge,
  TableFooter,
  TableLoading,
  TableMessage,
  TableShell,
  Td,
  Th,
  Toolbar,
  apiErrorMessage,
  useClientPage
} from '../../components/manager'
import {
  useApproveReviewMutation,
  useDeleteReviewMutation,
  useRejectReviewMutation,
  useReviewsQuery
} from '../../features/reviews/reviewApi'
import { toastShown } from '../../features/ui/uiSlice'
import { shortDate } from '../../lib/format'

const PER_PAGE = 12
const PENDING = 'Waiting Approval'

export default function Reviews() {
  const dispatch = useDispatch()
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [confirming, setConfirming] = useState(null) // { review, type }
  const [pendingId, setPendingId] = useState(null)

  // "All" is paginated by the server; the pending queue asks for a large window and
  // filters in the browser because the API has no status filter. Both stay mounted so
  // the tab counters are accurate before you switch to them.
  const all = useReviewsQuery({ page, limit: PER_PAGE })
  const queue = useReviewsQuery({ page: 1, limit: 100 })

  const [approveReview, approveState] = useApproveReviewMutation()
  const [rejectReview, rejectState] = useRejectReviewMutation()
  const [deleteReview, deleteState] = useDeleteReviewMutation()

  const pendingRows = (queue.data?.reviews || []).filter((review) => review.status === PENDING)
  const local = useClientPage(pendingRows, PER_PAGE)

  const browsingAll = tab === 'all'
  const active = browsingAll ? all : queue
  const rows = browsingAll ? all.data?.reviews || [] : local.visible
  const { isLoading, isError, error, refetch } = active

  const count = browsingAll ? all.data?.count || 0 : local.count
  const totalPages = browsingAll ? all.data?.totalPages || 1 : local.totalPages
  const currentPage = browsingAll ? all.data?.currentPage || page : local.page

  const run = async (review, type) => {
    setPendingId(review._id)
    try {
      if (type === 'approve') {
        await approveReview(review._id).unwrap()
        dispatch(toastShown({ type: 'success', message: 'Review approved' }))
      } else if (type === 'reject') {
        await rejectReview(review._id).unwrap()
        dispatch(toastShown({ type: 'success', message: 'Review rejected' }))
      } else {
        await deleteReview(review._id).unwrap()
        dispatch(toastShown({ type: 'success', message: 'Review deleted' }))
      }
      setConfirming(null)
    } catch (requestError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'The action failed.') }))
    } finally {
      setPendingId(null)
    }
  }

  const confirmCopy = {
    approve: {
      title: 'Approve review',
      confirmLabel: 'Approve',
      tone: 'primary',
      body: 'The review becomes visible on the product page.'
    },
    reject: {
      title: 'Reject review',
      confirmLabel: 'Reject',
      tone: 'secondary',
      body: 'The review stays hidden from the storefront.'
    },
    delete: {
      title: 'Delete review',
      confirmLabel: 'Delete review',
      tone: 'danger',
      body: 'Deleting is permanent — the review cannot be recovered.'
    }
  }[confirming?.type] || {}

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Moderation"
        title="Reviews"
        meta={<ResultMeta count={count} label={count === 1 ? 'review' : 'reviews'} />}
        description="New reviews wait for approval before they appear on the product page."
      />

      <Toolbar className="justify-between">
        <SegmentedTabs
          value={tab}
          onChange={(value) => {
            setTab(value)
            setPage(1)
            local.reset()
          }}
          options={[
            { value: 'all', label: 'All reviews', count: all.data?.count },
            { value: 'pending', label: 'Pending', count: pendingRows.length }
          ]}
        />
        <p className="text-xs text-ink-500">Product, reviewer, rating and status come from the review queue endpoint.</p>
      </Toolbar>

      <TableShell tableClassName="min-w-[62rem]">
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Reviewer</Th>
            <Th>Rating</Th>
            <Th>Review</Th>
            <Th>Added</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <TableLoading colSpan={7} />}
          {isError && (
            <TableMessage
              colSpan={7}
              title="Reviews could not be loaded"
              description={apiErrorMessage(error)}
              action={
                <Button variant="outline" size="sm" className="mt-2" onClick={refetch}>
                  Try again
                </Button>
              }
            />
          )}
          {!isLoading && !isError && rows.length === 0 && (
            <TableMessage
              colSpan={7}
              icon={MessageSquareQuote}
              title={browsingAll ? 'No reviews yet' : 'Nothing waiting for approval'}
              description={
                browsingAll
                  ? 'Customers can leave a review from the product page once their order is delivered.'
                  : 'Every review has been moderated. Switch to “All reviews” to see the history.'
              }
            />
          )}
          {!isLoading &&
            !isError &&
            rows.map((review) => (
              <tr key={review._id} className="transition-colors hover:bg-ink-50/70">
                <Td>
                  <div className="flex items-center gap-3">
                    <ProductArt product={review.product} className="size-10 shrink-0 rounded-lg" />
                    <div className="min-w-0">
                      {review.product?.slug ? (
                        <Link
                          to={`/product/${review.product.slug}`}
                          className="block truncate text-sm font-medium text-ink-900 hover:text-brand-700"
                        >
                          {review.product.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-ink-500">Product removed</span>
                      )}
                    </div>
                  </div>
                </Td>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={review.user?.firstName} className="size-8 text-[0.625rem]" />
                    <span className="text-sm text-ink-700">{review.user?.firstName || 'Unknown'}</span>
                  </div>
                </Td>
                <Td>
                  <Rating value={review.rating} />
                </Td>
                <Td className="max-w-md">
                  {review.title && <p className="text-sm font-medium text-ink-900">{review.title}</p>}
                  <p className="line-clamp-2 text-sm text-ink-600">{review.review}</p>
                  {review.isRecommended === false && <p className="text-xs text-ink-500">Does not recommend</p>}
                </Td>
                <Td className="text-sm whitespace-nowrap text-ink-500">{shortDate(review.created)}</Td>
                <Td>
                  <StatusBadge status={review.status} />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    {review.status !== 'Approved' && (
                      <IconButton
                        label="Approve review"
                        className="hover:bg-emerald-50 hover:text-emerald-700"
                        disabled={pendingId === review._id}
                        onClick={() => setConfirming({ review, type: 'approve' })}
                      >
                        <CircleCheck size={16} />
                      </IconButton>
                    )}
                    {review.status !== 'Rejected' && (
                      <IconButton
                        label="Reject review"
                        className="hover:bg-amber-50 hover:text-amber-700"
                        disabled={pendingId === review._id}
                        onClick={() => setConfirming({ review, type: 'reject' })}
                      >
                        <CircleX size={16} />
                      </IconButton>
                    )}
                    <IconButton
                      label="Delete review"
                      className="hover:bg-brand-50 hover:text-brand-700"
                      disabled={pendingId === review._id}
                      onClick={() => setConfirming({ review, type: 'delete' })}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </Td>
              </tr>
            ))}
        </tbody>
      </TableShell>

      {!isLoading && !isError && count > 0 && (
        <TableFooter
          page={currentPage}
          totalPages={totalPages}
          count={count}
          limit={PER_PAGE}
          onPage={browsingAll ? setPage : local.setPage}
          unit={count === 1 ? 'review' : 'reviews'}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        onConfirm={() => run(confirming.review, confirming.type)}
        loading={approveState.isLoading || rejectState.isLoading || deleteState.isLoading}
        title={confirmCopy.title}
        confirmLabel={confirmCopy.confirmLabel}
        tone={confirmCopy.tone}
        description={
          <>
            <p>
              <span className="font-medium text-ink-900">{confirming?.review?.title || 'Review'}</span> on{' '}
              {confirming?.review?.product?.name || 'a deleted product'}
            </p>
            <p className="text-xs text-ink-500">{confirmCopy.body}</p>
          </>
        }
      />
    </div>
  )
}
