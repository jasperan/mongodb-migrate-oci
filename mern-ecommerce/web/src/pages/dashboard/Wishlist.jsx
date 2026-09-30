import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Heart, ShoppingBag, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/account/PageHeader'
import { FormAlert } from '../../components/account/FormAlert'
import { apiErrorMessage } from '../../lib/apiError'
import { EmptyState, LoadingBlock } from '../../components/ui/Display'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ProductArt } from '../../components/catalog/ProductCard'
import { useProductBySlugQuery } from '../../features/catalog/catalogApi'
import { itemAdded } from '../../features/cart/cartSlice'
import { cartToggled, toastShown } from '../../features/ui/uiSlice'
import { useToggleWishlistMutation, useWishlistQuery } from '../../features/wishlist/wishlistApi'
import { currency, shortDate } from '../../lib/format'

/**
 * The wishlist projection only carries `{name, slug, price, imageUrl}`, so
 * adding to the bag fetches the full product first — otherwise the cart line
 * would lose its `taxable` flag and the checkout tax would be wrong.
 */
function WishlistRow({ entry, onRemove, removing }) {
  const dispatch = useDispatch()
  const product = entry.product
  const [adding, setAdding] = useState(false)
  const { data, isFetching, isError, error } = useProductBySlugQuery(product?.slug, {
    skip: !adding || !product?.slug
  })

  useEffect(() => {
    if (!adding) return
    if (isError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(error, 'That product could not be added to your bag.') }))
      setAdding(false)
      return
    }
    if (data?.product) {
      dispatch(itemAdded({ product: data.product, quantity: 1 }))
      dispatch(toastShown({ type: 'success', message: `${data.product.name} added to your bag` }))
      dispatch(cartToggled(true))
      setAdding(false)
    }
  }, [adding, data, isError, error, dispatch])

  if (!product) {
    return (
      <li className="flex items-center gap-4 p-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-400">
          <Heart size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm">Product unavailable</p>
          <p className="text-xs text-ink-500">The product on this wishlist entry is no longer available.</p>
        </div>
        <Button size="sm" variant="ghost" loading={removing} onClick={() => onRemove(entry)}>
          <Trash2 size={14} /> Remove
        </Button>
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-4 p-4">
      <Link to={`/product/${product.slug}`} className="shrink-0">
        <ProductArt product={product} className="size-16 rounded-xl" />
      </Link>

      <div className="min-w-0 flex-1">
        <Link to={`/product/${product.slug}`} className="font-display text-sm hover:text-brand-700">
          {product.name}
        </Link>
        <p className="mt-0.5 text-sm text-ink-700">{currency(product.price)}</p>
        <p className="mt-0.5 text-xs text-ink-500">Wishlist added on {shortDate(entry.created)}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" loading={adding || isFetching} onClick={() => setAdding(true)}>
          <ShoppingBag size={14} /> Add to bag
        </Button>
        <Button size="sm" variant="ghost" loading={removing} onClick={() => onRemove(entry)}>
          <Trash2 size={14} /> Remove
        </Button>
      </div>
    </li>
  )
}

export default function Wishlist() {
  const dispatch = useDispatch()
  const { data, isLoading, isError, error } = useWishlistQuery()
  const [toggleWishlist, { isLoading: isToggling }] = useToggleWishlistMutation()

  const wishlist = data?.wishlist || []

  const remove = async (entry) => {
    const productId = entry.product?._id
    if (!productId) return
    try {
      await toggleWishlist({ product: productId, isLiked: false }).unwrap()
      dispatch(toastShown({ type: 'success', message: 'Removed from your wishlist' }))
    } catch (requestError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'Could not update your wishlist.') }))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Your Wishlist"
        description={
          wishlist.length
            ? `${wishlist.length} saved item${wishlist.length === 1 ? '' : 's'}.`
            : 'Products you save are kept here for later.'
        }
        action={
          <ButtonLink to="/shop" variant="outline" size="sm">
            <ShoppingBag size={15} /> Find more products
          </ButtonLink>
        }
      />

      {isLoading && <LoadingBlock label="Loading your wishlist…" />}

      {isError && !isLoading && (
        <FormAlert>{apiErrorMessage(error, 'Your wishlist could not be loaded.')}</FormAlert>
      )}

      {!isLoading && !isError && wishlist.length === 0 && (
        <EmptyState
          icon={Heart}
          title="You have no items in your wishlist yet."
          description="Tap the heart on any product to keep it here while you browse."
          action={<ButtonLink to="/shop">Browse the catalogue</ButtonLink>}
        />
      )}

      {wishlist.length > 0 && (
        <div className="card-surface divide-y divide-ink-100">
          <p className="px-4 py-3 text-xs text-ink-500">
            Removing an item only drops the wishlist flag — the product stays in the catalogue.
          </p>
          <ul>
            {wishlist.map((entry) => (
              <WishlistRow
                key={entry._id}
                entry={entry}
                onRemove={remove}
                removing={isToggling}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
