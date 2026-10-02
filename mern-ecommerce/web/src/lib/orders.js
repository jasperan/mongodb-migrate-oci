// Statuses a line can be in while the whole order may still be cancelled; the
// server refuses DELETE /order/cancel/:id with 409 ORDER_DISPATCHED once any
// line is Shipped or Delivered.
const CANCELLABLE_LINE = new Set(['Not processed', 'Processing', 'Cancelled'])

export const canCancelOrder = (items) =>
  Array.isArray(items) && items.length > 0 && items.every((item) => CANCELLABLE_LINE.has(item.status || 'Not processed'))

// Line totals are always pre-tax (tax is shown once, in the totals), so every
// screen that lists order or bag lines reads this and never `priceWithTax`.
export const lineTotal = (item, unitPrice = item.purchasePrice ?? item.price ?? 0) =>
  Number(item.totalPrice ?? Number(unitPrice) * Number(item.quantity || 1))
