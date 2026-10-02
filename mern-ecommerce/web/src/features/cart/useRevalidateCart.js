import { useEffect, useState } from 'react'
import { useDispatch, useStore } from 'react-redux'
import { catalogApi } from '../catalog/catalogApi'
import { cartLinesSynced } from './cartSlice'
import { currency } from '../../lib/format'

const fetchProduct = async (dispatch, slug) => {
  try {
    const { product } = await dispatch(
      catalogApi.endpoints.productBySlug.initiate(slug, { forceRefetch: true, subscribe: false })
    ).unwrap()
    return { product }
  } catch (error) {
    // 404 is the API's answer for an inactive product or a deactivated brand;
    // any other failure says nothing about the product, so the line is kept.
    return { gone: error?.status === 404 }
  }
}

/**
 * Checks every bag line against the catalogue once when the page mounts: price,
 * stock and availability come from the server, the bag is corrected, and the
 * shopper gets one sentence per correction.
 */
export function useRevalidateCart() {
  const dispatch = useDispatch()
  const store = useStore()
  const [notices, setNotices] = useState([])
  const [checking, setChecking] = useState(() => store.getState().cart.items.length > 0)

  useEffect(() => {
    let cancelled = false
    const lines = store.getState().cart.items
    if (lines.length === 0) {
      setChecking(false)
      return undefined
    }

    Promise.all(lines.map(async (line) => ({ line, ...(await fetchProduct(dispatch, line.slug)) }))).then((results) => {
      if (cancelled) return
      const updates = []
      const removed = []
      const messages = []

      results.forEach(({ line, product, gone }) => {
        if (gone || (product && (product.isActive === false || Number(product.quantity) <= 0))) {
          removed.push(line.product)
          messages.push(
            gone || product.isActive === false
              ? `${line.name} is no longer available and was removed from your bag.`
              : `${line.name} is out of stock and was removed from your bag.`
          )
          return
        }
        if (!product) return

        const stock = Number(product.quantity)
        if (stock < line.quantity) {
          messages.push(`Only ${stock} left of ${line.name}; your quantity was lowered to ${stock}.`)
        }
        if (Number(product.price) !== Number(line.price)) {
          messages.push(`The price of ${line.name} changed from ${currency(line.price)} to ${currency(product.price)}.`)
        }
        updates.push({ product: line.product, price: product.price, taxable: product.taxable, stock })
      })

      dispatch(cartLinesSynced({ updates, removed }))
      setNotices(messages)
      setChecking(false)
    })

    return () => {
      cancelled = true
    }
  }, [dispatch, store])

  return { notices, checking, dismiss: () => setNotices([]) }
}
