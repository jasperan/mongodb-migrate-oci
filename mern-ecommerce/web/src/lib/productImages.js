// Product imagery for the storefront. The catalogue documents themselves carry no
// pictures, so images are resolved from the product name (its noun) and, failing
// that, from the product's category - deterministically per product id, so a
// product always shows the same photo.
//
// Photos: Unsplash (https://unsplash.com/license) - free to use, no attribution
// required. Files live in `public/products/`.

import { slugify } from './format'

const BASE = `${import.meta.env.BASE_URL}products/`

const url = (file) => `${BASE}${file}`

const BY_NOUN = {
  "backpack": [
    "backpack-1.jpg",
    "backpack-2.jpg",
    "backpack-3.jpg"
  ],
  "bacon": [
    "bacon-1.jpg",
    "bacon-2.jpg",
    "bacon-3.jpg"
  ],
  "ball": [
    "ball-1.jpg",
    "ball-2.jpg",
    "ball-3.jpg"
  ],
  "bike": [
    "bike-1.jpg",
    "bike-2.jpg",
    "bike-3.jpg"
  ],
  "blanket": [
    "blanket-1.jpg",
    "blanket-2.jpg",
    "blanket-3.jpg"
  ],
  "car": [
    "car-1.jpg",
    "car-2.jpg",
    "car-3.jpg"
  ],
  "chair": [
    "chair-1.jpg",
    "chair-2.jpg",
    "chair-3.jpg"
  ],
  "cheese": [
    "cheese-1.jpg",
    "cheese-2.jpg",
    "cheese-3.jpg"
  ],
  "chicken": [
    "chicken-1.jpg",
    "chicken-2.jpg",
    "chicken-3.jpg"
  ],
  "chips": [
    "chips-1.jpg",
    "chips-2.jpg",
    "chips-3.jpg"
  ],
  "computer": [
    "computer-1.jpg",
    "computer-2.jpg",
    "computer-3.jpg"
  ],
  "fish": [
    "fish-1.jpg",
    "fish-2.jpg",
    "fish-3.jpg"
  ],
  "gloves": [
    "gloves-1.jpg",
    "gloves-2.jpg",
    "gloves-3.jpg"
  ],
  "hat": [
    "hat-1.jpg",
    "hat-2.jpg",
    "hat-3.jpg"
  ],
  "keyboard": [
    "keyboard-1.jpg",
    "keyboard-2.jpg",
    "keyboard-3.jpg"
  ],
  "lantern": [
    "lantern-1.jpg",
    "lantern-2.jpg",
    "lantern-3.jpg"
  ],
  "mouse": [
    "mouse-1.jpg",
    "mouse-2.jpg",
    "mouse-3.jpg"
  ],
  "mug": [
    "mug-1.jpg",
    "mug-2.jpg",
    "mug-3.jpg"
  ],
  "pants": [
    "pants-1.jpg",
    "pants-2.jpg",
    "pants-3.jpg"
  ],
  "pizza": [
    "pizza-1.jpg",
    "pizza-2.jpg",
    "pizza-3.jpg"
  ],
  "salad": [
    "salad-1.jpg",
    "salad-2.jpg",
    "salad-3.jpg"
  ],
  "sausages": [
    "sausages-1.jpg",
    "sausages-2.jpg",
    "sausages-3.jpg"
  ],
  "shirt": [
    "shirt-1.jpg",
    "shirt-2.jpg",
    "shirt-3.jpg"
  ],
  "shoes": [
    "shoes-1.jpg",
    "shoes-2.jpg",
    "shoes-3.jpg"
  ],
  "soap": [
    "soap-1.jpg",
    "soap-2.jpg",
    "soap-3.jpg"
  ],
  "table": [
    "table-1.jpg",
    "table-2.jpg",
    "table-3.jpg"
  ],
  "towels": [
    "towels-1.jpg",
    "towels-2.jpg",
    "towels-3.jpg"
  ],
  "tuna": [
    "tuna-1.jpg",
    "tuna-2.jpg",
    "tuna-3.jpg"
  ]
}

const BY_CATEGORY = {
  "automotive": [
    "cat-automotive-1.jpg",
    "cat-automotive-2.jpg"
  ],
  "beauty": [
    "cat-beauty-1.jpg",
    "cat-beauty-2.jpg"
  ],
  "camping-essentials": [
    "cat-camping-essentials-1.jpg",
    "cat-camping-essentials-2.jpg",
    "cat-camping-essentials-3.jpg"
  ],
  "garden": [
    "cat-garden-1.jpg",
    "cat-garden-2.jpg"
  ],
  "health": [
    "cat-health-1.jpg",
    "cat-health-2.jpg"
  ],
  "home-comfort": [
    "cat-home-comfort-1.jpg",
    "cat-home-comfort-2.jpg",
    "cat-home-comfort-3.jpg"
  ],
  "kids": [
    "cat-kids-1.jpg",
    "cat-kids-2.jpg"
  ],
  "movies": [
    "cat-movies-1.jpg",
    "cat-movies-2.jpg"
  ],
  "music": [
    "cat-music-1.jpg",
    "cat-music-2.jpg"
  ],
  "outdoor-gear": [
    "cat-outdoor-gear-1.jpg",
    "cat-outdoor-gear-2.jpg",
    "cat-outdoor-gear-3.jpg"
  ],
  "tools": [
    "cat-tools-1.jpg",
    "cat-tools-2.jpg"
  ],
  "toys": [
    "cat-toys-1.jpg",
    "cat-toys-2.jpg"
  ]
}

const GENERIC = [
  "cat-automotive-1.jpg",
  "cat-automotive-2.jpg",
  "cat-beauty-1.jpg",
  "cat-beauty-2.jpg",
  "cat-camping-essentials-1.jpg",
  "cat-camping-essentials-2.jpg",
  "cat-camping-essentials-3.jpg",
  "cat-garden-1.jpg",
  "cat-garden-2.jpg",
  "cat-health-1.jpg",
  "cat-health-2.jpg",
  "cat-home-comfort-1.jpg",
  "cat-home-comfort-2.jpg",
  "cat-home-comfort-3.jpg",
  "cat-kids-1.jpg",
  "cat-kids-2.jpg",
  "cat-movies-1.jpg",
  "cat-movies-2.jpg",
  "cat-music-1.jpg",
  "cat-music-2.jpg",
  "cat-outdoor-gear-1.jpg",
  "cat-outdoor-gear-2.jpg",
  "cat-outdoor-gear-3.jpg",
  "cat-tools-1.jpg",
  "cat-tools-2.jpg",
  "cat-toys-1.jpg",
  "cat-toys-2.jpg"
]

export const HERO_IMAGES = [
  "hero-1-1.jpg",
  "hero-1-2.jpg",
  "hero-2-1.jpg",
  "hero-2-2.jpg",
  "hero-3-1.jpg",
  "hero-3-2.jpg"
].map(url)

const hash = (seed = '') => {
  let value = 0
  for (let i = 0; i < seed.length; i += 1) value = (value * 31 + seed.charCodeAt(i)) % 100000
  return value
}

const nounOf = (product) => String(product?.name || '').trim().split(/\s+/).pop().toLowerCase()

const categoryOf = (product) => {
  const raw = typeof product?.category === 'object' ? product?.category?.name : product?.category
  return slugify(raw)
}

const pick = (list, seed) => (list?.length ? url(list[hash(seed) % list.length]) : null)

// Single representative image (grids, thumbnails, cart lines).
export function productImage(product) {
  const seed = String(product?.slug || product?._id || product?.name || '')
  return pick(BY_NOUN[nounOf(product)], seed) || pick(BY_CATEGORY[categoryOf(product)], seed) || pick(GENERIC, seed)
}

// Every picture available for a product (product detail gallery).
export function productGallery(product) {
  const own = BY_NOUN[nounOf(product)]
  if (own?.length) return own.map(url)
  const byCategory = BY_CATEGORY[categoryOf(product)]
  if (byCategory?.length) return byCategory.map(url)
  return GENERIC.slice(0, 3).map(url)
}

// Category tile imagery (home page).
export function categoryImage(name) {
  const slug = slugify(name)
  return pick(BY_CATEGORY[slug], slug) || pick(GENERIC, slug)
}
