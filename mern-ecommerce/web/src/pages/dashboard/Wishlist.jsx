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
import { isSoldOut, useAddToBag } from '../../features/cart/useAddToBag'
import { cartToggled, toastShown } from '../../features/ui/uiSlice'
import { useRemoveWishlistEntryMutation, useWishlistQuery } from '../../features/wishlist/wishlistApi'
import { currency, shortDate } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useRowAction } from '../../components/manager'

/**
 * The wishlist projection only carries `{name, slug, price, imageUrl}`, so
 * adding to the bag fetches the full product first — otherwise the cart line
 * would lose its `taxable` flag and the checkout tax would be wrong.
 */
function WishlistRow({ entry, onRemove, removing }) {
  const dispatch = useDispatch()
  const product = entry.product
  const [adding, setAdding] = useState(false)
  const [soldOut, setSoldOut] = useState(false)
  const addToBag = useAddToBag()
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
      // The projection has no stock, so a sold-out product is only discovered here.
      if (isSoldOut(data.product)) setSoldOut(true)
      if (addToBag(data.product, 1) > 0) dispatch(cartToggled(true))
      setAdding(false)
    }
  }, [adding, data, isError, error, dispatch, addToBag])

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
        <Button size="sm" loading={adding || isFetching} disabled={soldOut} onClick={() => setAdding(true)}>
          <ShoppingBag size={14} /> {soldOut ? 'Sold out' : 'Add to bag'}
        </Button>
        <Button size="sm" variant="ghost" loading={removing} onClick={() => onRemove(entry)}>
          <Trash2 size={14} /> Remove
        </Button>
      </div>
    </li>
  )
}

export default function Wishlist() {
  useDocumentTitle('Wishlist')
  const { data, isLoading, isError, error } = useWishlistQuery()
  const [removeEntry] = useRemoveWishlistEntryMutation()
  const { pendingId, run } = useRowAction()

  const wishlist = data?.wishlist || []

  // Removal goes by the entry's own id, so rows whose product was deleted
  // (nothing left to toggle by product id) can be dropped too.
  const remove = (entry) =>
    run(entry._id, () => removeEntry(entry._id).unwrap(), {
      success: 'Removed from your wishlist',
      failure: 'Could not update your wishlist.'
    })

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
                removing={pendingId === entry._id}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
