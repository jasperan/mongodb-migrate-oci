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

// POST /order/checkout accepts 1..99 per line; `stock` (the product quantity when
// the line was added or last revalidated) tightens that when it is known.
const MAX_LINE_QUANTITY = 99

const stockOf = (value) => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : null)

export const lineLimit = (item) => {
  const stock = stockOf(item.stock)
  return stock === null ? MAX_LINE_QUANTITY : Math.max(1, Math.min(stock, MAX_LINE_QUANTITY))
}

const clampQuantity = (item, quantity) => Math.min(Math.max(1, Math.floor(Number(quantity) || 1)), lineLimit(item))

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: readStored() },
  reducers: {
    itemAdded(state, action) {
      const { product, quantity = 1 } = action.payload
      const stock = stockOf(product.quantity)
      const existing = state.items.find((item) => item.product === product._id)
      if (existing) {
        if (stock !== null) existing.stock = stock
        existing.quantity = clampQuantity(existing, existing.quantity + quantity)
        Object.assign(existing, lineTotals(existing))
      } else {
        const item = {
          product: product._id,
          name: product.name,
          slug: product.slug,
          imageUrl: product.imageUrl || null,
          brand: product.brand?.name || product.brand || null,
          quantity: 1,
          price: product.price,
          taxable: Boolean(product.taxable),
          stock
        }
        item.quantity = clampQuantity(item, quantity)
        state.items.push({ ...item, ...lineTotals(item) })
      }
      persist(state.items)
    },
    itemQuantityChanged(state, action) {
      const { product, quantity } = action.payload
      const existing = state.items.find((item) => item.product === product)
      if (!existing) return
      existing.quantity = clampQuantity(existing, quantity)
      Object.assign(existing, lineTotals(existing))
      persist(state.items)
    },
    itemRemoved(state, action) {
      state.items = state.items.filter((item) => item.product !== action.payload)
      persist(state.items)
    },
    cartCleared(state) {
      state.items = []
      persist(state.items)
    },
    // Applies what the server said about the lines: fresh price/stock/tax flag per
    // product id, and the ids that can no longer be bought.
    cartLinesSynced(state, action) {
      const { updates = [], removed = [] } = action.payload
      state.items = state.items.filter((item) => !removed.includes(item.product))
      updates.forEach((update) => {
        const line = state.items.find((item) => item.product === update.product)
        if (!line) return
        if (update.price !== undefined) line.price = update.price
        if (update.taxable !== undefined) line.taxable = Boolean(update.taxable)
        if (update.stock !== undefined) line.stock = stockOf(update.stock)
        line.quantity = clampQuantity(line, line.quantity)
        Object.assign(line, lineTotals(line))
      })
      persist(state.items)
    }
  }
})

export const { itemAdded, itemQuantityChanged, itemRemoved, cartCleared, cartLinesSynced } = cartSlice.actions

export const selectCartItems = (state) => state.cart.items
export const selectCartCount = (state) => state.cart.items.reduce((sum, item) => sum + item.quantity, 0)
export const selectCartSubtotal = (state) =>
  Number(state.cart.items.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2))
export const selectCartTax = (state) =>
  Number(state.cart.items.reduce((sum, item) => sum + item.totalTax, 0).toFixed(2))
export const selectCartTotal = (state) => Number((selectCartSubtotal(state) + selectCartTax(state)).toFixed(2))

export default cartSlice.reducer
