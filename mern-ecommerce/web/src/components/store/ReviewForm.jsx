import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Star } from 'lucide-react'
import clsx from 'clsx'
import { Button, ButtonLink } from '../ui/Button'
import { Checkbox, Field, Input, Textarea } from '../ui/Field'
import { Badge } from '../ui/Display'
import { selectIsAuthenticated } from '../../features/auth/authSlice'
import { useAddReviewMutation } from '../../features/reviews/reviewApi'
import { toastShown } from '../../features/ui/uiSlice'

const EMPTY = { title: '', review: '', rating: 0, isRecommended: true }

function StarPicker({ value, onChange, error }) {
  return (
    <div>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            onClick={() => onChange(star)}
            className="rounded-full p-0.5 transition-transform hover:scale-110"
          >
            <Star
              size={22}
              className={clsx(star <= value ? 'fill-amber-400 text-amber-400' : 'text-ink-300')}
              strokeWidth={1.5}
            />
          </button>
        ))}
        {value > 0 && <span className="ml-2 text-sm text-ink-500">{value} / 5</span>}
      </div>
      {error && <span className="mt-1 block text-xs font-medium text-brand-600">{error}</span>}
    </div>
  )
}

export function ReviewForm({ productId, productName, className }) {
  const dispatch = useDispatch()
  const authenticated = useSelector(selectIsAuthenticated)
  const [addReview, { isLoading }] = useAddReviewMutation()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  if (!authenticated) {
    return (
      <div className={clsx('card-surface flex flex-wrap items-center justify-between gap-4 p-5', className)}>
        <div>
          <h3 className="font-display text-base">Write a review</h3>
          <p className="mt-1 text-sm text-ink-500">
            Sign in to share your experience with {productName || 'this product'}.
          </p>
        </div>
        <ButtonLink to="/login" size="sm">
          Sign in
        </ButtonLink>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className={clsx('card-surface p-5', className)}>
        <Badge tone="success">Review submitted</Badge>
        <h3 className="mt-2 font-display text-base">Thanks for the feedback</h3>
        <p className="mt-1 text-sm text-ink-500">
          Your review is queued as <strong className="font-medium text-ink-700">Waiting Approval</strong> and will
          appear on this page once a store admin approves it.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSubmitted(false); setForm(EMPTY) }}>
          Write another review
        </Button>
      </div>
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.title.trim()) nextErrors.title = 'Title is required.'
    if (!form.review.trim()) nextErrors.review = 'Review is required.'
    if (!form.rating) nextErrors.rating = 'Rating is required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    try {
      const result = await addReview({
        product: productId,
        title: form.title.trim(),
        rating: form.rating,
        review: form.review.trim(),
        isRecommended: form.isRecommended
      }).unwrap()
      dispatch(
        toastShown({
          type: 'success',
          message: result?.message || 'Your review has been added successfully and will appear when approved!'
        })
      )
      setSubmitted(true)
    } catch (error) {
      dispatch(
        toastShown({
          type: 'error',
          message: error?.data?.error || 'We could not save your review. Please try again.'
        })
      )
    }
  }

  return (
    <form onSubmit={submit} className={clsx('card-surface p-5', className)}>
      <h3 className="font-display text-base">Write a review</h3>
      <p className="mt-1 text-xs text-ink-500">
        Reviews are moderated — yours is published as soon as an admin approves it.
      </p>

      <div className="mt-4 space-y-4">
        <Field label="Rating" required error={errors.rating}>
          <StarPicker value={form.rating} onChange={(value) => change('rating', value)} error={null} />
        </Field>
        <Field label="Title" required error={errors.title}>
          <Input
            value={form.title}
            onChange={(event) => change('title', event.target.value)}
            placeholder="Sum it up in a few words"
            maxLength={80}
          />
        </Field>
        <Field label="Review" required error={errors.review}>
          <Textarea
            value={form.review}
            onChange={(event) => change('review', event.target.value)}
            rows={5}
            placeholder={`What did you think of ${productName || 'this product'}?`}
          />
        </Field>
        <Checkbox
          label="I would recommend this product"
          checked={form.isRecommended}
          onChange={(event) => change('isRecommended', event.target.checked)}
        />
      </div>

      <Button type="submit" className="mt-5" loading={isLoading}>
        Publish review
      </Button>
    </form>
  )
}
