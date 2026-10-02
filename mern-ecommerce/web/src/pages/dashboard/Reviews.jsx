import { useState } from 'react'
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
  useClampPage,
  useRowAction
} from '../../components/manager'
import {
  useApproveReviewMutation,
  useDeleteReviewMutation,
  useRejectReviewMutation,
  useReviewsQuery
} from '../../features/reviews/reviewApi'
import { apiErrorMessage } from '../../lib/apiError'
import { shortDate } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const PER_PAGE = 12
const PENDING = 'Waiting Approval'

const OUTCOMES = {
  approve: { success: 'Review approved', failure: 'The action failed.' },
  reject: { success: 'Review rejected', failure: 'The action failed.' },
  delete: { success: 'Review deleted', failure: 'The action failed.' }
}

export default function Reviews() {
  useDocumentTitle('Reviews')
  const [tab, setTab] = useState('all')
  const [allPage, setAllPage] = useState(1)
  const [queuePage, setQueuePage] = useState(1)
  const [confirming, setConfirming] = useState(null) // { review, type }
  const { pendingId, run } = useRowAction()

  // Both tabs stay mounted so their counters are accurate before you switch; the
  // moderation queue is filtered by the API, so it never misses older reviews.
  const all = useReviewsQuery({ page: allPage, limit: PER_PAGE })
  const queue = useReviewsQuery({ page: queuePage, limit: PER_PAGE, status: PENDING })
  useClampPage(allPage, all.data?.totalPages, setAllPage)
  useClampPage(queuePage, queue.data?.totalPages, setQueuePage)

  const [approveReview, approveState] = useApproveReviewMutation()
  const [rejectReview, rejectState] = useRejectReviewMutation()
  const [deleteReview, deleteState] = useDeleteReviewMutation()

  const browsingAll = tab === 'all'
  const active = browsingAll ? all : queue
  const rows = active.data?.reviews || []
  const { isLoading, isError, error, refetch } = active

  const count = active.data?.count || 0
  const totalPages = active.data?.totalPages || 1
  const currentPage = Math.min(browsingAll ? allPage : queuePage, totalPages)

  const moderate = async (review, type) => {
    const call = { approve: approveReview, reject: rejectReview, delete: deleteReview }[type]
    const done = await run(review._id, () => call(review._id).unwrap(), OUTCOMES[type])
    if (done) setConfirming(null)
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
          label="Review filter"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: 'All reviews', count: all.data?.count },
            { value: 'pending', label: 'Pending', count: queue.data?.count }
          ]}
        />
        <p className="text-xs text-ink-500">Product, reviewer, rating and status come from the review queue endpoint.</p>
      </Toolbar>

      <TableShell tableClassName="min-w-[54rem]">
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Reviewer</Th>
            <Th>Rating</Th>
            <Th>Review</Th>
            <Th>Added</Th>
            <Th>Status</Th>
            <Th sticky className="text-right">Actions</Th>
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
                <Td className="max-w-52">
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
                <Td sticky>
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
          onPage={browsingAll ? setAllPage : setQueuePage}
          unit={count === 1 ? 'review' : 'reviews'}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        onConfirm={() => moderate(confirming.review, confirming.type)}
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
