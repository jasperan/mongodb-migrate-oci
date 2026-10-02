import { useCallback } from 'react'
import { useDispatch, useStore } from 'react-redux'
import { toastShown } from '../ui/uiSlice'
import { itemAdded, lineLimit } from './cartSlice'

/** True only when the catalogue says there is nothing left (an unknown quantity is not "sold out"). */
export const isSoldOut = (product) => Number(product?.quantity) <= 0

/**
 * Adds a product to the bag and tells the shopper what actually happened. The
 * reducer clamps the line to the stock it knows about, so the toast is based on
 * how far the line grew rather than on the click. Returns the units added.
 */
export function useAddToBag() {
  const dispatch = useDispatch()
  const store = useStore()

  return useCallback(
    (product, quantity = 1) => {
      if (isSoldOut(product)) {
        dispatch(toastShown({ type: 'info', message: `${product.name} is sold out` }))
        return 0
      }

      const lineOf = () => store.getState().cart.items.find((item) => item.product === product._id)
      const before = lineOf()?.quantity ?? 0
      dispatch(itemAdded({ product, quantity }))
      const line = lineOf()
      const added = (line?.quantity ?? 0) - before

      if (added <= 0) {
        dispatch(toastShown({ type: 'info', message: `Only ${lineLimit(line)} available — your bag already has them all` }))
      } else if (added < quantity) {
        dispatch(toastShown({ type: 'info', message: `Only ${lineLimit(line)} available — added ${added} to your bag` }))
      } else {
        const label = added > 1 ? `${added} × ${product.name}` : product.name
        dispatch(toastShown({ type: 'success', message: `${label} added to your bag` }))
      }
      return added
    },
    [dispatch, store]
  )
}
