import { createSlice } from '@reduxjs/toolkit'

const STORAGE_KEY = 'mern26.cart'

const readStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const persist = (items) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* storage unavailable */
  }
}

/* Mirrors server/config/tax.js (stateTaxRate: 0.05) — the server effectively
   charges price * (0.05 / 100) * 100 per unit, i.e. 5% of taxable lines. */
export const TAX_RATE = 5

const lineTotals = (item) => {
  const totalPrice = Number((item.price * item.quantity).toFixed(2))
  const totalTax = item.taxable ? Number((item.price * (TAX_RATE / 100) * item.quantity).toFixed(2)) : 0
  return { totalPrice, totalTax, priceWithTax: Number((totalPrice + totalTax).toFixed(2)) }
}

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: readStored(), cartId: null },
  reducers: {
    itemAdded(state, action) {
      const { product, quantity = 1 } = action.payload
      const existing = state.items.find((item) => item.product === product._id)
      if (existing) {
        existing.quantity += quantity
        Object.assign(existing, lineTotals(existing))
      } else {
        const item = {
          product: product._id,
          name: product.name,
          slug: product.slug,
          imageUrl: product.imageUrl || null,
          brand: product.brand?.name || product.brand || null,
          quantity,
          price: product.price,
          taxable: Boolean(product.taxable),
          ...lineTotals({ price: product.price, quantity, taxable: product.taxable })
        }
        state.items.push(item)
      }
      persist(state.items)
    },
    itemQuantityChanged(state, action) {
      const { product, quantity } = action.payload
      const existing = state.items.find((item) => item.product === product)
      if (!existing) return
      existing.quantity = Math.max(1, quantity)
      Object.assign(existing, lineTotals(existing))
      persist(state.items)
    },
    itemRemoved(state, action) {
      state.items = state.items.filter((item) => item.product !== action.payload)
      persist(state.items)
    },
    cartCleared(state) {
      state.items = []
      state.cartId = null
      persist(state.items)
    },
    cartIdReceived(state, action) {
      state.cartId = action.payload
    }
  }
})

export const { itemAdded, itemQuantityChanged, itemRemoved, cartCleared, cartIdReceived } = cartSlice.actions

export const selectCartItems = (state) => state.cart.items
export const selectCartCount = (state) => state.cart.items.reduce((sum, item) => sum + item.quantity, 0)
export const selectCartSubtotal = (state) =>
  Number(state.cart.items.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2))
export const selectCartTax = (state) =>
  Number(state.cart.items.reduce((sum, item) => sum + item.totalTax, 0).toFixed(2))
export const selectCartTotal = (state) => Number((selectCartSubtotal(state) + selectCartTax(state)).toFixed(2))

// payload shape expected by POST /api/cart/add and POST /api/cart/add/:cartId
export const toCartPayload = (items) =>
  items.map((item) => ({
    product: item.product,
    quantity: item.quantity,
    price: item.price,
    taxable: item.taxable,
    totalPrice: item.totalPrice,
    totalTax: item.totalTax,
    priceWithTax: item.priceWithTax
  }))

export default cartSlice.reducer
