import clsx from 'clsx'
import { Star } from 'lucide-react'
import { Rating } from '../ui/Display'
import { dateTime, initials } from '../../lib/format'

export const reviewStats = (reviews = []) => {
  const totalReviews = reviews.length
  const totalRatings = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0)
  const average = totalReviews ? totalRatings / totalReviews : 0
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((review) => Math.round(Number(review.rating) || 0) === stars).length
  }))
  return { totalReviews, totalRatings, average, distribution }
}

export function ReviewSummary({ reviews = [], className }) {
  const { totalReviews, average, distribution } = reviewStats(reviews)

  return (
    <div className={clsx('card-surface p-5', className)}>
      <h3 className="font-display text-base">Customer reviews</h3>
      {totalReviews === 0 ? (
        <p className="mt-2 text-sm text-ink-500">No approved reviews yet — be the first to add one.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-6">
          <div className="text-center">
            <p className="font-display text-4xl leading-none text-ink-900">{average.toFixed(1)}</p>
            <Rating value={average} className="mt-2" />
            <p className="mt-1 text-xs text-ink-500">based on {totalReviews} review{totalReviews === 1 ? '' : 's'}</p>
          </div>
          <ul className="min-w-48 flex-1 space-y-1.5">
            {distribution.map(({ stars, count }) => {
              const percentage = totalReviews ? (count / totalReviews) * 100 : 0
              return (
                <li key={stars} className="flex items-center gap-2 text-xs text-ink-500">
                  <span className="inline-flex w-8 items-center gap-0.5">
                    {stars}
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <span className="block h-full rounded-full bg-amber-400" style={{ width: `${percentage}%` }} />
                  </span>
                  <span className="w-6 text-right tabular-nums">{count}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export function ReviewList({ reviews = [], className }) {
  if (!reviews.length) return null

  return (
    <ul className={clsx('divide-y divide-ink-100', className)}>
      {reviews.map((review, index) => {
        const name = review.user?.firstName || 'Customer'
        return (
          <li key={review._id || index} className="flex gap-4 py-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-duality-50 font-display text-sm font-semibold text-duality-700">
              {initials(name) || 'C'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-medium text-ink-900">{name}</span>
                <Rating value={review.rating} size={13} />
                <span className="text-xs text-ink-400">{dateTime(review.created)}</span>
                {review.isRecommended === false && <span className="text-xs text-ink-500">· would not recommend</span>}
              </div>
              {review.title && <p className="mt-1.5 font-display text-sm text-ink-900">{review.title}</p>}
              <p className="mt-1 text-sm leading-relaxed text-ink-600">{review.review}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
