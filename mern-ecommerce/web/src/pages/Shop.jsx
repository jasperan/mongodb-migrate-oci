import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PackageSearch, ServerCrash, SlidersHorizontal, X } from 'lucide-react'
import { EmptyState, Skeleton } from '../components/ui/Display'
import { Button, ButtonLink } from '../components/ui/Button'
import { Pagination } from '../components/ui/Pagination'
import { ProductCard } from '../components/catalog/ProductCard'
import { Filters, categoryLabels } from '../components/store/Filters'
import { FilterSheet } from '../components/store/FilterSheet'
import { SortSelect, DEFAULT_SORT, isSortKey, sortOrderFor } from '../components/store/SortSelect'
import { useProductsQuery, useStoreBrandsQuery, useStoreCategoriesQuery } from '../features/catalog/catalogApi'
import { currency, plural } from '../lib/format'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const PAGE_SIZE = 12

const numberParam = (value) => {
  if (value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

const priceLabel = (min, max) => {
  if (min !== undefined && max !== undefined) return `${currency(min)} – ${currency(max)}`
  if (min !== undefined) return `${currency(min)} and up`
  return `Up to ${currency(max)}`
}

function ActiveChip({ label, onClear }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-700">
      {label}
      <button type="button" onClick={onClear} aria-label={`Clear ${label}`} className="text-ink-500 hover:text-brand-600">
        <X size={13} />
      </button>
    </span>
  )
}

function CardSkeleton() {
  return (
    <div className="card-surface overflow-hidden" aria-hidden>
      <Skeleton className="aspect-4/3 w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const brand = params.get('brand') || ''
  const term = (params.get('q') || '').trim()
  const min = numberParam(params.get('min'))
  const max = numberParam(params.get('max'))
  const rating = Math.min(5, Math.floor(numberParam(params.get('rating')) || 0))
  const sort = isSortKey(params.get('sort')) ? params.get('sort') : DEFAULT_SORT
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)

  const [sheetOpen, setSheetOpen] = useState(false)
  const headingRef = useRef(null)
  const previousPage = useRef(page)

  const { data: categoriesData, isSuccess: categoriesLoaded } = useStoreCategoriesQuery()
  const { data: brandsData, isSuccess: brandsLoaded } = useStoreBrandsQuery()
  const categories = categoriesData?.categories || []
  const brands = brandsData?.brands || []
  const activeCategory = categories.find((item) => item.slug === category)
  const activeBrand = brands.find((item) => item.slug === brand)
  const unknownSlug = (category && categoriesLoaded && !activeCategory) || (brand && brandsLoaded && !activeBrand)

  const { data, isLoading, isFetching, isError, refetch } = useProductsQuery(
    {
      name: term || undefined,
      min,
      max,
      rating,
      category: category || undefined,
      brand: brand || undefined,
      page,
      limit: PAGE_SIZE,
      sortOrder: sortOrderFor(sort)
    },
    { skip: Boolean(unknownSlug) }
  )

  const products = data?.products || []
  const totalPages = data?.totalPages || 1
  const count = data?.count ?? products.length
  // While a new page is loading `data` still belongs to the previous one.
  const serverPage = isFetching ? undefined : data?.currentPage
  const currentPage = serverPage ?? page

  // Every change except paging itself starts again from the first page.
  const setParam = (patch) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (!('page' in patch)) next.delete('page')
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') next.delete(key)
        else next.set(key, String(value))
      })
      return next
    })
  }

  const categoryName = activeCategory ? categoryLabels(categories).get(activeCategory.slug) : ''
  const heading = categoryName || activeBrand?.name || (term ? `Results for “${term}”` : 'All products')
  useDocumentTitle(unknownSlug ? 'Not found' : heading)

  const hasPrice = min !== undefined || max !== undefined
  const filterCount = [category, brand, hasPrice, rating > 0].filter(Boolean).length
  const hasFilters = filterCount > 0 || Boolean(term)

  const resetAll = () => {
    setSheetOpen(false)
    setParams(new URLSearchParams())
  }

  useEffect(() => {
    if (previousPage.current === page) return
    previousPage.current = page
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [page])

  // The server clamps an out-of-range page (stale bookmark, shrunken catalogue) to the
  // last one; make the address bar say so instead of paging from a page that is not there.
  useEffect(() => {
    if (isFetching || !serverPage || serverPage === page) return
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (serverPage === 1) next.delete('page')
        else next.set('page', String(serverPage))
        return next
      },
      { replace: true }
    )
  }, [isFetching, serverPage, page, setParams])

  if (unknownSlug) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={PackageSearch}
          title={category && !activeCategory ? 'Category not found' : 'Brand not found'}
          description="We could not find what you were looking for. It may have been removed or the link may be out of date."
          action={<ButtonLink to="/shop">Browse all products</ButtonLink>}
          className="mx-auto max-w-xl"
        />
      </div>
    )
  }

  const rangeStart = count === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, count)

  const filterProps = {
    min,
    max,
    rating,
    category,
    brand,
    categories,
    brands,
    onPriceChange: (nextMin, nextMax) => setParam({ min: nextMin, max: nextMax }),
    onRatingChange: (value) => setParam({ rating: value || '' }),
    onCategoryChange: (value) => setParam({ category: value }),
    onBrandChange: (value) => setParam({ brand: value })
  }

  return (
    <div className="container-page py-8 lg:py-10">
      <header className="mb-5">
        <p className="eyebrow">Shop</p>
        <h1 ref={headingRef} className="mt-1 scroll-mt-28 font-display text-3xl">
          {heading}
        </h1>
        <p className="mt-2 text-sm text-ink-500" aria-live="polite">
          {isLoading ? 'Loading products…' : `${rangeStart}–${rangeEnd} of ${plural(count, 'product')}`}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal size={14} /> Filters{filterCount ? ` (${filterCount})` : ''}
        </Button>
        <SortSelect value={sort} onChange={(value) => setParam({ sort: value === DEFAULT_SORT ? '' : value })} className="ml-auto" />
      </div>

      {hasFilters && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {activeCategory && <ActiveChip label={`Category: ${categoryName}`} onClear={() => setParam({ category: '' })} />}
          {activeBrand && <ActiveChip label={`Brand: ${activeBrand.name}`} onClear={() => setParam({ brand: '' })} />}
          {hasPrice && <ActiveChip label={`Price: ${priceLabel(min, max)}`} onClear={() => setParam({ min: '', max: '' })} />}
          {rating > 0 && <ActiveChip label={`Rating: ${rating}★ and up`} onClear={() => setParam({ rating: '' })} />}
          {term && <ActiveChip label={`Search: “${term}”`} onClear={() => setParam({ q: '' })} />}
          <button type="button" onClick={resetAll} className="px-1 text-xs font-medium text-brand-700 hover:text-brand-800">
            Clear all
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <Filters {...filterProps} onReset={resetAll} className="hidden h-fit lg:sticky lg:top-28 lg:block" />

        <div>
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading products">
              {Array.from({ length: PAGE_SIZE }, (_, index) => (
                <CardSkeleton key={index} />
              ))}
            </div>
          ) : isError ? (
            <EmptyState
              icon={ServerCrash}
              title="The products did not load"
              description="Check your connection and try again."
              action={<Button onClick={() => refetch()}>Retry</Button>}
            />
          ) : products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No products match"
              description={
                term
                  ? `Nothing in the shop matches “${term}” with these filters. Try another word or clear the filters.`
                  : 'Nothing matched this combination of category, brand, price and rating filters.'
              }
              action={hasFilters ? <Button onClick={resetAll}>Clear all filters</Button> : <Button onClick={() => refetch()}>Refresh</Button>}
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>

              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onChange={(next) => setParam({ page: next === 1 ? '' : next })}
                className={isFetching ? 'mt-8 opacity-60' : 'mt-8'}
              />
            </>
          )}

          {term && !isLoading && (
            <p className="mt-8 text-center text-xs text-ink-500">
              Looking for something else?{' '}
              <Link to="/shop" className="font-medium text-brand-700 hover:text-brand-800">
                Browse the full shop
              </Link>
            </p>
          )}
        </div>
      </div>

      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onReset={resetAll} resultCount={count}>
        <Filters {...filterProps} bare onReset={resetAll} />
      </FilterSheet>
    </div>
  )
}
