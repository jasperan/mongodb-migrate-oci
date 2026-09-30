import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Headphones,
  RotateCcw,
  Sparkles,
  Truck
} from 'lucide-react'
import { LoadingBlock, EmptyState } from '../components/ui/Display'
import { ButtonLink } from '../components/ui/Button'
import { ProductArt, ProductCard } from '../components/catalog/ProductCard'
import { useProductsQuery, useStoreBrandsQuery, useStoreCategoriesQuery } from '../features/catalog/catalogApi'
import { categoryImage, HERO_IMAGES } from '../lib/productImages'

const heroImage = (name) => HERO_IMAGES.find((src) => src.endsWith(name)) || HERO_IMAGES[0]
const HERO = heroImage('hero-2-1.jpg')
const PROMO_SHOPPING = heroImage('hero-1-1.jpg')
const PROMO_DELIVERY = heroImage('hero-3-1.jpg')

const SERVICES = [
  { icon: Truck, title: 'Free delivery', body: 'On every order over $100, to your door in 2–4 days.' },
  { icon: RotateCcw, title: '30-day returns', body: 'Changed your mind? Send it back, no questions asked.' },
  { icon: BadgeCheck, title: 'Secure checkout', body: 'Encrypted payments and buyer protection on every order.' },
  { icon: Headphones, title: 'Support 24/7', body: 'Live chat with a real person, any time of day.' }
]

const isRealCategory = (category) => !/^seed/i.test(category?.name || '')

export default function Home() {
  const { data: featured, isLoading } = useProductsQuery({ limit: 8, sortOrder: { created: -1 } })
  const { data: premium } = useProductsQuery({ limit: 4, sortOrder: { price: -1 } })
  const { data: categories } = useStoreCategoriesQuery()
  const { data: brands } = useStoreBrandsQuery()

  const shopCategories = (categories?.categories || []).filter(isRealCategory).slice(0, 6)

  return (
    <div>
      {/* hero */}
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <img
          src={HERO}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-45"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/40" aria-hidden />
        <div className="container-page relative grid gap-10 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <Sparkles size={13} className="text-brand-400" />
              New season deals are live
            </span>
            <h1 className="mt-5 font-display text-4xl leading-[1.05] font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Everything you need,
              <br />
              delivered <span className="text-brand-400">fast</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-200">
              Shop thousands of products across electronics, home, fashion, beauty, food and more — with free delivery
              over $100, 30-day returns and live support around the clock.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/shop" size="lg">
                Shop all products <ArrowRight size={16} />
              </ButtonLink>
              <ButtonLink to="/shop?category=beauty" size="lg" variant="outlineLight">
                Explore deals
              </ButtonLink>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6 text-sm">
              <div>
                <dt className="text-ink-400">Products</dt>
                <dd className="mt-1 font-display text-xl text-white">100+</dd>
              </div>
              <div>
                <dt className="text-ink-400">Brands</dt>
                <dd className="mt-1 font-display text-xl text-white">{(brands?.brands || []).length || 16}</dd>
              </div>
              <div>
                <dt className="text-ink-400">Delivery</dt>
                <dd className="mt-1 font-display text-xl text-white">2–4 days</dd>
              </div>
            </dl>
          </div>

          <div className="relative hidden lg:block">
            <div className="absolute inset-0 rounded-3xl border border-white/10 bg-white/5" aria-hidden />
            <div className="relative grid h-full content-center gap-4 p-8">
              <p className="eyebrow text-white/60">Why shoppers stay</p>
              <ul className="grid gap-4">
                {SERVICES.slice(0, 3).map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10">
                      <Icon size={18} className="text-brand-300" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-white">{title}</span>
                      <span className="block text-sm text-ink-300">{body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* services */}
      <section className="container-page relative z-10 -mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="card-surface p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Icon size={18} />
            </span>
            <h2 className="mt-3 font-display text-base">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">{body}</p>
          </div>
        ))}
      </section>

      {/* categories */}
      {shopCategories.length > 0 && (
        <section className="container-page py-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <span className="eyebrow">Browse</span>
              <h2 className="font-display text-2xl">Shop by category</h2>
            </div>
            <Link to="/shop" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
              All categories <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shopCategories.map((category) => (
              <Link
                key={category._id}
                to={`/shop?category=${category.slug}`}
                className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-ink-900"
              >
                <img
                  src={categoryImage(category.name)}
                  alt=""
                  loading="lazy"
                  className="h-40 w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/30 to-transparent" aria-hidden />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4 text-white">
                  <div>
                    <p className="font-display text-lg">{category.name}</p>
                    <p className="text-xs text-white/70">{category.products?.length ?? 0} products</p>
                  </div>
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* new arrivals */}
      <section className="container-page pb-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Just landed</span>
            <h2 className="font-display text-2xl">New arrivals</h2>
          </div>
          <Link to="/shop" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
            View all products <ArrowRight size={15} />
          </Link>
        </div>

        {isLoading ? (
          <LoadingBlock label="Loading products…" />
        ) : featured?.products?.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.products.slice(0, 8).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Boxes} title="No products yet" description="Products will appear here once the catalogue is stocked." />
        )}
      </section>

      {/* promo band */}
      <section className="container-page grid gap-4 pb-14 lg:grid-cols-2">
        <Link to="/shop" className="group relative overflow-hidden rounded-2xl">
          <img src={PROMO_SHOPPING} alt="" loading="lazy" className="h-56 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/85 to-transparent" aria-hidden />
          <div className="absolute inset-y-0 left-0 flex max-w-sm flex-col justify-center gap-2 p-7 text-white">
            <span className="eyebrow text-white/60">This week</span>
            <p className="font-display text-2xl leading-tight">Deals across every department</p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-300">
              Shop the deals <ArrowRight size={15} />
            </span>
          </div>
        </Link>
        <Link to="/shop" className="group relative overflow-hidden rounded-2xl">
          <img src={PROMO_DELIVERY} alt="" loading="lazy" className="h-56 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/85 to-transparent" aria-hidden />
          <div className="absolute inset-y-0 left-0 flex max-w-sm flex-col justify-center gap-2 p-7 text-white">
            <span className="eyebrow text-white/60">Fast and free</span>
            <p className="font-display text-2xl leading-tight">Free delivery on orders over $100</p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-300">
              Start shopping <ArrowRight size={15} />
            </span>
          </div>
        </Link>
      </section>

      {/* premium picks + brands */}
      <section className="container-page grid gap-6 pb-14 lg:grid-cols-[1.4fr_1fr]">
        <div className="card-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={17} className="text-brand-600" />
            <h2 className="font-display text-lg">Premium picks</h2>
          </div>
          <ul className="flex flex-col gap-3">
            {(premium?.products || []).slice(0, 4).map((product) => (
              <li key={product._id}>
                <Link to={`/product/${product.slug}`} className="flex items-center gap-3">
                  <ProductArt product={product} className="size-12 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{product.name}</span>
                    <span className="block text-xs text-ink-500">
                      ${product.price} · {product.totalReviews || 0} reviews
                    </span>
                  </span>
                  <ArrowRight size={15} className="text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-dashed border-ink-200 pt-4">
            <span className="eyebrow">Brands</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {(brands?.brands || []).slice(0, 8).map((brand) => (
                <Link
                  key={brand._id}
                  to={`/shop?brand=${brand.slug}`}
                  className="rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  {brand.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="card-surface flex flex-col justify-between gap-6 p-6">
          <div>
            <span className="eyebrow">Members</span>
            <h2 className="mt-1 font-display text-lg">Save more with an account</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Track orders, keep a wishlist, review what you bought and check out in one tap next time.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/register">Create an account</ButtonLink>
            <ButtonLink to="/shop" variant="outline">
              Keep browsing
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  )
}
