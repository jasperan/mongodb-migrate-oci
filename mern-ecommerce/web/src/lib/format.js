export const currency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    Number(value || 0)
  )

export const shortDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export const dateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

// Deterministic gradient per product id: the migrated catalogue has no imagery,
// so every product gets a stable, distinct artwork instead of a grey placeholder.
const ART_PALETTE = [
  ['#c74634', '#6f2c24'],
  ['#3363d4', '#16161a'],
  ['#17a673', '#0b3d2c'],
  ['#f8b34a', '#a5372a'],
  ['#4b7bec', '#274ba5'],
  ['#8d8d87', '#2a2a28'],
  ['#ef5030', '#862f25'],
  ['#3363d4', '#0b0f19']
]

export const artStyle = (seed = '') => {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100000
  const [from, to] = ART_PALETTE[hash % ART_PALETTE.length]
  return { '--art-from': from, '--art-to': to }
}

export const initials = (text = '') =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')

export const slugify = (text = '') =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export const roleLabel = (role = '') =>
  ({ 'ROLE ADMIN': 'Admin', 'ROLE MERCHANT': 'Merchant', 'ROLE MEMBER': 'Customer' })[role] || role

// Catalogue blurbs are demo filler: some carry notes about how the data was seeded
// or moved between databases, the rest are Latin placeholder sentences. Neither
// belongs on a storefront, so anything that reads as filler is replaced with a
// line built from the product's own fields.
const FILLER_NOTE = /[^.!?]*\b(migrat\w*|mongodb|oracle|26ai|seeded?)\b[^.!?]*[.!?]?/gi
const ENGLISH = /\b(the|and|for|with|of|in|to|is|are|from|your|our)\b/i

export const describeProduct = (product) => {
  const raw = String(product?.description || '').trim()
  const stripped = raw.replace(FILLER_NOTE, ' ').replace(/\s+/g, ' ').trim()
  if (stripped.length > 40 && ENGLISH.test(stripped)) return stripped

  const brand = typeof product?.brand === 'object' ? product?.brand?.name : undefined
  const category = typeof product?.category === 'object' ? product?.category?.name : undefined
  const headline = [product?.name, brand && `by ${brand}`].filter(Boolean).join(' ')
  const scope = category && !/^seed/i.test(category) ? ` Part of our ${category.toLowerCase()} range.` : ''
  return `${headline}.${scope} Ships free on orders over $100, with 30-day returns.`
}

// plural(1, 'review') -> '1 review'; plural(2, 'review') -> '2 reviews'
export const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${Number(count) === 1 ? singular : pluralForm}`
