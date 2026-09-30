import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PackageSearch, ServerCrash, SlidersHorizontal, X } from 'lucide-react'
import { EmptyState, LoadingBlock } from '../components/ui/Display'
import { Button } from '../components/ui/Button'
import { Pagination } from '../components/ui/Pagination'
import { ProductCard } from '../components/catalog/ProductCard'
import { Filters, PRICE_BOUNDS } from '../components/store/Filters'
import { SortSelect, DEFAULT_SORT, sortOrderFor } from '../components/store/SortSelect'
import { useProductsQuery, useStoreBrandsQuery, useStoreCategoriesQuery } from '../features/catalog/catalogApi'

const PAGE_SIZE = 12

function ActiveChip({ label, onClear }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-700">
      {label}
      <button type="button" onClick={onClear} aria-label={`Clear ${label}`} className="text-ink-400 hover:text-brand-600">
        <X size={13} />
      </button>
    </span>
  )
}

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const brand = params.get('brand') || ''
  const term = params.get('q') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const [price, setPrice] = useState(PRICE_BOUNDS)
  const [rating, setRating] = useState(0)
  const [sort, setSort] = useState(DEFAULT_SORT)

  const { data: categoriesData } = useStoreCategoriesQuery()
  const { data: brandsData } = useStoreBrandsQuery()

  // min/max are always sent: the aggregation drops the price window (and can
  // return nothing) when the bounds are missing.
  const { data, isLoading, isFetching, isError, refetch } = useProductsQuery({
    min: price.min,
    max: price.max,
    rating,
    category: category || undefined,
    brand: brand || undefined,
    page,
    limit: PAGE_SIZE,
    sortOrder: sortOrderFor(sort)
  })

  const products = data?.products || []
  const totalPages = data?.totalPages || 1
  const count = data?.count ?? products.length

  // The list endpoint has no name filter, so a ?q= term narrows the current page.
  const visible = useMemo(() => {
    if (!term) return products
    const needle = term.trim().toLowerCase()
    if (!needle) return products
    return products.filter((product) => product.name?.toLowerCase().includes(needle))
  }, [products, term])

  const setParam = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') next.delete(key)
      else next.set(key, String(value))
    })
    setParams(next)
  }

  const categories = categoriesData?.categories || []
  const brands = brandsData?.brands || []
  const activeCategory = categories.find((item) => item.slug === category)
  const activeBrand = brands.find((item) => item.slug === brand)

  const hasFilters =
    Boolean(category || brand || term) || rating !== 0 || price.min !== PRICE_BOUNDS.min || price.max !== PRICE_BOUNDS.max

  const resetAll = () => {
    setPrice(PRICE_BOUNDS)
    setRating(0)
    setSort(DEFAULT_SORT)
    setParams(new URLSearchParams())
  }

  const rangeStart = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, count)

  return (
    <div className="container-page py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="mt-1 font-display text-3xl">
            {activeCategory ? activeCategory.name : activeBrand ? activeBrand.name : 'All products'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-500">
            {isLoading
              ? 'Loading products…'
              : `${rangeStart}–${rangeEnd} of ${count} products`}
            {term ? ` · filtered by name on this page` : ''}
          </p>
        </div>
        <SortSelect value={sort} onChange={(value) => { setSort(value); setParam({ page: '' }) }} />
      </header>

      {(category || brand || term) && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
            <SlidersHorizontal size={13} /> Active
          </span>
          {activeCategory && <ActiveChip label={`Category: ${activeCategory.name}`} onClear={() => setParam({ category: '', page: '' })} />}
          {activeBrand && <ActiveChip label={`Brand: ${activeBrand.name}`} onClear={() => setParam({ brand: '', page: '' })} />}
          {term && <ActiveChip label={`Search: “${term}”`} onClear={() => setParam({ q: '', page: '' })} />}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <Filters
          className="h-fit lg:sticky lg:top-28"
          min={price.min}
          max={price.max}
          rating={rating}
          category={category}
          brand={brand}
          categories={categories}
          brands={brands}
          onPriceChange={(min, max) => { setPrice({ min, max }); setParam({ page: '' }) }}
          onRatingChange={(value) => { setRating(value); setParam({ page: '' }) }}
          onCategoryChange={(value) => setParam({ category: value, page: '' })}
          onBrandChange={(value) => setParam({ brand: value, page: '' })}
          onReset={resetAll}
        />

        <div>
          {isLoading ? (
            <LoadingBlock label="Loading products…" />
          ) : isError ? (
            <EmptyState
              icon={ServerCrash}
              title="The catalogue did not load"
              description="The product aggregation could not be read. Check the API connection and try again."
              action={<Button onClick={() => refetch()}>Retry</Button>}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No products match"
              description={
                term
                  ? `No product on this page matches “${term}”. Try another page or clear the search.`
                  : 'Nothing matched this combination of category, brand, price and rating filters.'
              }
              action={
                hasFilters ? (
                  <Button onClick={resetAll}>Reset filters</Button>
                ) : (
                  <Button onClick={() => refetch()}>Refresh</Button>
                )
              }
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>

              {visible.length !== products.length && (
                <p className="mt-6 text-center text-xs text-ink-500">
                  Showing {visible.length} of the {products.length} products on page {page}.
                </p>
              )}

              <Pagination
                page={page}
                totalPages={totalPages}
                onChange={(next) => setParam({ page: next === 1 ? '' : next })}
                className={isFetching ? 'mt-8 opacity-60' : 'mt-8'}
              />
            </>
          )}

          {term && (
            <p className="mt-8 text-center text-xs text-ink-400">
              Looking for more?{' '}
              <Link to="/shop" className="font-medium text-brand-700 hover:text-brand-800">
                Browse the full catalogue
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
