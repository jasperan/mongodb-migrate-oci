import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, ShoppingBag } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { Badge, Rating } from '../ui/Display'
import { artStyle, currency, describeProduct, initials } from '../../lib/format'
import { productImage } from '../../lib/productImages'
import { itemAdded } from '../../features/cart/cartSlice'
import { selectIsAuthenticated } from '../../features/auth/authSlice'
import { useToggleWishlistMutation, useWishlistQuery } from '../../features/wishlist/wishlistApi'
import { toastShown } from '../../features/ui/uiSlice'
import clsx from 'clsx'

// Catalogue documents carry no imagery of their own; `productImage` resolves a
// deterministic photo per product, and the gradient plate stays as the fallback
// when a picture is missing or fails to load.
export function ProductArt({ product, className, alt = '', eager = false }) {
  const [failed, setFailed] = useState(false)
  const src = productImage(product)

  if (src && !failed) {
    return (
      <div className={clsx('overflow-hidden bg-ink-100', className)}>
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={clsx('product-art grid place-items-center text-white', className)}
      style={artStyle(product?.slug || product?._id || product?.name || '')}
      aria-hidden
    >
      <span className="font-display text-2xl font-semibold tracking-wide opacity-90">
        {initials(product?.name || '')}
      </span>
    </div>
  )
}

export function ProductCard({ product, highlightWishlist = false }) {
  const dispatch = useDispatch()
  const authenticated = useSelector(selectIsAuthenticated)
  const { data: wishlist } = useWishlistQuery(undefined, { skip: !authenticated })
  const [toggleWishlist] = useToggleWishlistMutation()

  const liked = Boolean(wishlist?.wishlist?.some((entry) => entry.product?._id === product._id))

  const addToCart = () => {
    dispatch(itemAdded({ product, quantity: 1 }))
    dispatch(toastShown({ type: 'success', message: `${product.name} added to your bag` }))
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

  const brandName = typeof product.brand === 'object' ? product.brand?.name : product.brand

  return (
    <article className="card-surface hover-lift group flex flex-col overflow-hidden">
      <Link to={`/product/${product.slug}`} className="relative block">
        <ProductArt product={product} className="aspect-4/3 w-full" />
        <div className="absolute top-3 left-3 flex gap-2">
          {product.taxable === false && <Badge tone="success">Tax free</Badge>}
          {product.isActive === false && <Badge tone="warning">Inactive</Badge>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/product/${product.slug}`} className="font-display text-base leading-snug hover:text-brand-700">
            {product.name}
          </Link>
          <button
            onClick={like}
            aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
            className={clsx(
              'grid size-8 shrink-0 place-items-center rounded-full border transition-colors',
              liked ? 'border-brand-200 bg-brand-50 text-brand-600' : 'border-ink-200 text-ink-400 hover:text-brand-600',
              highlightWishlist && 'ring-2 ring-brand-100'
            )}
          >
            <Heart size={15} className={liked ? 'fill-current' : undefined} />
          </button>
        </div>
        {brandName && <p className="text-xs text-ink-500">by {brandName}</p>}
        {product.averageRating !== undefined && Number(product.totalReviews) > 0 && (
          <Rating value={product.averageRating} count={product.totalReviews} />
        )}
        <p className="line-clamp-2 text-sm text-ink-500">{describeProduct(product)}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-display text-lg text-ink-900">{currency(product.price)}</span>
          <button
            onClick={addToCart}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
          >
            <ShoppingBag size={14} /> Add
          </button>
        </div>
      </div>
    </article>
  )
}
