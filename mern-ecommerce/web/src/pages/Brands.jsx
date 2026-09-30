import { Link } from 'react-router-dom'
import { ArrowRight, Building2, ServerCrash, Store } from 'lucide-react'
import { Badge, EmptyState, LoadingBlock } from '../components/ui/Display'
import { Button, ButtonLink } from '../components/ui/Button'
import { useProductsQuery, useStoreBrandsQuery } from '../features/catalog/catalogApi'
import { artStyle, initials } from '../lib/format'

// Brand documents carry no product count, so each card asks the list endpoint for
// one row of its own brand and reads the aggregation's filtered `count`.
function BrandCard({ brand }) {
  const { data, isLoading } = useProductsQuery({
    brand: brand.slug,
    min: 1,
    max: 5000,
    rating: 0,
    limit: 1,
    page: 1
  })
  const count = data?.count

  return (
    <article className="card-surface hover-lift group flex flex-col overflow-hidden">
      <Link to={`/shop?brand=${brand.slug}`} className="block">
        <div
          className="product-art grid aspect-3/1 place-items-center text-white"
          style={artStyle(brand.slug || brand.name)}
          aria-hidden
        >
          <span className="font-display text-2xl font-semibold tracking-wide opacity-90">
            {initials(brand.name)}
          </span>
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/shop?brand=${brand.slug}`} className="font-display text-base leading-snug hover:text-brand-700">
            {brand.name}
          </Link>
          <Badge tone={count > 0 ? 'duality' : 'neutral'}>
            {isLoading ? '…' : `${count ?? 0} product${count === 1 ? '' : 's'}`}
          </Badge>
        </div>
        <p className="line-clamp-2 text-sm text-ink-500">{brand.description}</p>
        <Link
          to={`/shop?brand=${brand.slug}`}
          className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          Shop {brand.name} <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  )
}

export default function Brands() {
  const { data, isLoading, isError, refetch } = useStoreBrandsQuery()
  const brands = data?.brands || []

  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <p className="eyebrow">Shop by brand</p>
        <h1 className="mt-1 font-display text-3xl">Brands on the store</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-500">
          Every active brand in the catalogue with its live product count, read straight from the store
          collections. Only brands with active products can be shopped.
        </p>
      </header>

      {isLoading ? (
        <LoadingBlock label="Loading brands…" />
      ) : isError ? (
        <EmptyState
          icon={ServerCrash}
          title="Brands did not load"
          description="The brand collection could not be read from the API."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      ) : brands.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No brands yet"
          description="No active brand is registered in the catalogue."
          action={<ButtonLink to="/shop">Browse all products</ButtonLink>}
        />
      ) : (
        <>
          <div className="mb-6 flex items-center gap-3 text-sm text-ink-500">
            <Store size={15} className="text-ink-400" />
            {brands.length} active brand{brands.length === 1 ? '' : 's'}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {brands.map((brand) => (
              <BrandCard key={brand._id || brand.slug} brand={brand} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
