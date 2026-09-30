import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Heart, PackageSearch, ServerCrash, ShieldCheck, ShoppingBag, Truck } from 'lucide-react'
import clsx from 'clsx'
import { Badge, EmptyState, LoadingBlock, Rating, StatusDot } from '../components/ui/Display'
import { Button, ButtonLink } from '../components/ui/Button'
import { ProductCard } from '../components/catalog/ProductCard'
import { QuantityStepper } from '../components/store/QuantityStepper'
import { ReviewList, ReviewSummary, reviewStats } from '../components/store/ReviewList'
import { ReviewForm } from '../components/store/ReviewForm'
import { useProductBySlugQuery, useProductsQuery } from '../features/catalog/catalogApi'
import { useProductReviewsQuery } from '../features/reviews/reviewApi'
import { useToggleWishlistMutation, useWishlistQuery } from '../features/wishlist/wishlistApi'
import { TAX_RATE, itemAdded, selectCartItems } from '../features/cart/cartSlice'
import { selectIsAuthenticated } from '../features/auth/authSlice'
import { cartToggled, toastShown } from '../features/ui/uiSlice'
import { currency, describeProduct } from '../lib/format'
import { productGallery } from '../lib/productImages'

// Inline placeholder shown only if a photo fails to load.
const FALLBACK_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#e7e5e4"/><circle cx="2" cy="1.5" r="0.45" fill="#a8a29e"/></svg>'
  )

export default function Product() {
  const { slug } = useParams()
  const dispatch = useDispatch()
  const authenticated = useSelector(selectIsAuthenticated)
  const cartItems = useSelector(selectCartItems)

  const [quantity, setQuantity] = useState(1)
  const [plate, setPlate] = useState(0)

  const { data, isLoading, isError, error, refetch } = useProductBySlugQuery(slug, { skip: !slug })
  const { data: reviewData } = useProductReviewsQuery(slug, { skip: !slug })
  const { data: wishlist } = useWishlistQuery(undefined, { skip: !authenticated })
  const [toggleWishlist] = useToggleWishlistMutation()

  const product = data?.product
  const brandSlug = typeof product?.brand === 'object' ? product?.brand?.slug : undefined

  const { data: related } = useProductsQuery(
    { brand: brandSlug, min: 1, max: 5000, rating: 0, limit: 4, sortOrder: { created: -1 } },
    { skip: !brandSlug }
  )

  const reviews = reviewData?.reviews || []
  const stats = useMemo(() => reviewStats(reviews), [reviews])
  const plates = useMemo(() => (product ? productGallery(product) : []), [product])

  if (isLoading) return <LoadingBlock label="Loading product…" className="py-24" />

  if (isError || !product) {
    const notFound = error?.status === 404
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={notFound ? PackageSearch : ServerCrash}
          title={notFound ? 'Product not found' : 'This product did not load'}
          description={
            notFound
              ? 'The product may have been removed, or its brand is no longer active in the catalogue.'
              : 'The storefront could not load this product. Please try again.'
          }
          action={
            notFound ? (
              <ButtonLink to="/shop">Back to the shop</ButtonLink>
            ) : (
              <Button onClick={() => refetch()}>Retry</Button>
            )
          }
        />
      </div>
    )
  }

  const inStock = Number(product.quantity) > 0
  const maxQuantity = inStock ? Number(product.quantity) : 1
  const inCart = cartItems.find((item) => item.product === product._id)
  const liked = Boolean(wishlist?.wishlist?.some((entry) => entry.product?._id === product._id))
  const brandName = typeof product.brand === 'object' ? product.brand?.name : undefined

  const addToBag = () => {
    dispatch(itemAdded({ product, quantity }))
    dispatch(toastShown({ type: 'success', message: `${quantity} × ${product.name} added to your bag` }))
  }

  const like = async () => {
    if (!authenticated) {
      dispatch(toastShown({ type: 'info', message: 'Sign in to save products to your wishlist' }))
      return
    }
    try {
      await toggleWishlist({ product: product._id, isLiked: !liked }).unwrap()
      dispatch(toastShown({ type: 'success', message: liked ? 'Removed from wishlist' : 'Saved to wishlist' }))
    } catch {
      dispatch(toastShown({ type: 'error', message: 'Could not update your wishlist' }))
    }
  }

  return (
    <div className="container-page py-10">
      <nav className="mb-6 flex items-center gap-2 text-xs text-ink-500" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-700">Home</Link>
        <span>/</span>
        <Link to="/shop" className="hover:text-brand-700">Shop</Link>
        {brandSlug && (
          <>
            <span>/</span>
            <Link to={`/shop?brand=${brandSlug}`} className="hover:text-brand-700">{brandName}</Link>
          </>
        )}
        <span>/</span>
        <span className="truncate text-ink-700">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="card-surface overflow-hidden">
            <img
              src={plates[plate]}
              alt={product.name}
              className="aspect-4/3 w-full object-cover"
              onError={(event) => {
                event.currentTarget.onerror = null
                event.currentTarget.src = FALLBACK_IMAGE
              }}
            />
          </div>
          {plates.length > 1 && (
            <div className="mt-3 flex gap-3">
              {plates.map((source, index) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setPlate(index)}
                  aria-label={`View ${product.name} image ${index + 1}`}
                  className={clsx(
                    'overflow-hidden rounded-xl border transition-colors',
                    index === plate ? 'border-brand-500 ring-2 ring-brand-100' : 'border-ink-200 hover:border-ink-300'
                  )}
                >
                  <img src={source} alt="" className="size-16 object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            {brandSlug ? (
              <Link to={`/shop?brand=${brandSlug}`} className="eyebrow hover:text-brand-700">
                {brandName}
              </Link>
            ) : (
              <span className="eyebrow">Unbranded</span>
            )}
            <h1 className="mt-1 font-display text-3xl">{product.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Rating value={stats.average} count={stats.totalReviews} />
              <span className="text-xs text-ink-400">SKU {product.sku || '—'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-display text-3xl text-ink-900">{currency(product.price)}</span>
            {product.taxable ? (
              <Badge tone="neutral">Taxable · {TAX_RATE}% at checkout</Badge>
            ) : (
              <Badge tone="success">Tax free</Badge>
            )}
            {product.isActive === false && <Badge tone="warning">Inactive</Badge>}
          </div>

          <div className="flex items-center gap-3">
            <StatusDot ok={inStock} label={inStock ? 'In stock' : 'Out of stock'} />
            {inStock && <span className="text-sm text-ink-500">{product.quantity} available</span>}
          </div>

          <p className="text-sm leading-relaxed text-ink-600">{describeProduct(product)}</p>

          <div className="card-surface flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="eyebrow mb-1.5">Quantity</p>
                <QuantityStepper
                  value={quantity}
                  onChange={setQuantity}
                  max={maxQuantity}
                  disabled={!inStock}
                />
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-2 pt-5">
                <Button onClick={addToBag} disabled={!inStock}>
                  <ShoppingBag size={16} /> Add to bag
                </Button>
                <Button variant="outline" onClick={() => dispatch(cartToggled(true))}>
                  View bag
                </Button>
                <button
                  type="button"
                  onClick={like}
                  aria-pressed={liked}
                  className={clsx(
                    'inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                    liked
                      ? 'border-brand-200 bg-brand-50 text-brand-700'
                      : 'border-ink-300 bg-white text-ink-700 hover:border-ink-400'
                  )}
                >
                  <Heart size={16} className={liked ? 'fill-current' : undefined} />
                  {liked ? 'Saved' : 'Wishlist'}
                </button>
              </div>
            </div>

            {inCart && (
              <p className="text-xs text-ink-500">
                {inCart.quantity} in your bag ·{' '}
                <Link to="/cart" className="font-medium text-brand-700 hover:text-brand-800">review your bag</Link>
              </p>
            )}
            {!inStock && <p className="text-xs text-brand-600">This product is currently unavailable to order.</p>}
          </div>

          <ul className="grid gap-3 text-sm text-ink-600 sm:grid-cols-2">
            <li className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2.5">
              <Truck size={15} className="text-ink-400" /> Free shipping over $100
            </li>
            <li className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2.5">
              <ShieldCheck size={15} className="text-ink-400" /> 30-day returns, no questions asked
            </li>
          </ul>
        </div>
      </div>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <ReviewSummary reviews={reviews} />
          {reviews.length > 0 ? (
            <div className="card-surface px-5 py-2">
              <ReviewList reviews={reviews} />
            </div>
          ) : (
            <div className="card-surface px-5 py-6 text-sm text-ink-500">
              Approved reviews will appear here. Only reviews with the status <strong className="font-medium text-ink-700">Approved</strong> are published.
            </div>
          )}
        </div>
        <ReviewForm productId={product._id} productName={product.name} className="h-fit lg:sticky lg:top-28" />
      </section>

      {related?.products?.length > 1 && (
        <section className="mt-14">
          <h2 className="font-display text-xl">More from {brandName}</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {related.products
              .filter((item) => item._id !== product._id)
              .slice(0, 4)
              .map((item) => (
                <ProductCard key={item._id} product={item} />
              ))}
          </div>
        </section>
      )}
    </div>
  )
}
