import { useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ChevronDown, LayoutDashboard, LogOut, Menu, Search, ShoppingBag, Truck, User, X } from 'lucide-react'
import { Button, IconButton, ButtonLink } from '../ui/Button'
import { selectAuth, loggedOut } from '../../features/auth/authSlice'
import { selectCartCount, selectCartSubtotal } from '../../features/cart/cartSlice'
import { cartToggled, toastShown } from '../../features/ui/uiSlice'
import { useStoreCategoriesQuery, useSearchProductsQuery } from '../../features/catalog/catalogApi'
import { cn } from '../../lib/cn'
import { currency, plural } from '../../lib/format'
import { useDismiss } from '../../lib/useDismiss'

const NAV_LINKS = [
  { to: '/shop', label: 'Shop' },
  { to: '/brands', label: 'Brands' },
  { to: '/sell', label: 'Sell with us' },
  { to: '/support/llm-chat', label: 'AI Assistant' },
  { to: '/contact', label: 'Contact' }
]

// The demo catalogue has two categories named "Toys". The strip is a shortcut
// list, so each name appears once (the larger category); the Shop filter still
// lists both with their product counts.
function stripCategories(categories = []) {
  const byName = new Map()
  for (const category of categories) {
    const key = String(category.name).trim().toLowerCase()
    const current = byName.get(key)
    if (!current || (category.products?.length ?? 0) > (current.products?.length ?? 0)) byName.set(key, category)
  }
  return [...byName.values()].slice(0, 8)
}

function SearchBox({ className, onNavigate }) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const { data, isFetching } = useSearchProductsQuery(term, { skip: term.trim().length < 2 })

  useDismiss([containerRef], open, () => setOpen(false))

  const submit = (event) => {
    event.preventDefault()
    if (!term.trim()) return
    navigate(`/shop?q=${encodeURIComponent(term.trim())}`)
    setOpen(false)
    onNavigate?.()
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <form onSubmit={submit} className="flex items-center">
        <Search size={16} className="pointer-events-none absolute left-3.5 text-ink-500" aria-hidden />
        <input
          value={term}
          onChange={(event) => {
            setTerm(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search products"
          className="h-10 w-full rounded-full border border-ink-200 bg-ink-50 pl-9 pr-4 text-sm placeholder:text-ink-400 focus:border-brand-400 focus:bg-white"
          aria-label="Search products"
        />
      </form>
      {open && term.trim().length >= 2 && (
        <div className="card-surface absolute top-12 left-0 z-40 max-h-80 w-full overflow-y-auto p-2">
          {isFetching && <p className="px-3 py-2 text-sm text-ink-500">Searching…</p>}
          {!isFetching && (data?.products?.length ? data.products.slice(0, 8).map((item) => (
            <Link
              key={item.slug}
              to={`/product/${item.slug}`}
              onClick={() => {
                setOpen(false)
                onNavigate?.()
              }}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-ink-50"
            >
              <span className="truncate">{item.name}</span>
              <span className="text-ink-500">{currency(item.price)}</span>
            </Link>
          )) : (
            <p className="px-3 py-2 text-sm text-ink-500">No products match “{term}”.</p>
          ))}
        </div>
      )}
    </div>
  )
}

export function Header() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { token, user } = useSelector(selectAuth)
  const cartCount = useSelector(selectCartCount)
  const cartSubtotal = useSelector(selectCartSubtotal)
  const { data: categories } = useStoreCategoriesQuery()
  const { pathname } = useLocation()
  const menuId = useId()
  const accountId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [seenPath, setSeenPath] = useState(pathname)
  const menuButtonRef = useRef(null)
  const menuRef = useRef(null)
  const accountRef = useRef(null)
  const accountButtonRef = useRef(null)

  // Menus never outlive the page they were opened on.
  if (seenPath !== pathname) {
    setSeenPath(pathname)
    setAccountOpen(false)
    setMenuOpen(false)
  }

  useDismiss([accountRef], accountOpen, (escaped) => {
    setAccountOpen(false)
    if (escaped) accountButtonRef.current?.focus()
  })
  useDismiss([menuButtonRef, menuRef], menuOpen, (escaped) => {
    setMenuOpen(false)
    if (escaped) menuButtonRef.current?.focus()
  })

  const signOut = () => {
    dispatch(loggedOut())
    setAccountOpen(false)
    setMenuOpen(false)
    dispatch(toastShown({ type: 'info', message: 'Signed out' }))
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/85 backdrop-blur">
      <div className="hidden bg-ink-950 py-2 text-xs text-ink-200 md:block">
        <div className="container-page flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Truck size={13} className="text-brand-400" />
            Free shipping on orders over $100
          </span>
          <span className="text-ink-300">30-day returns · Support 24/7</span>
        </div>
      </div>

      <div className="container-page flex h-16 items-center gap-4">
        <IconButton
          ref={menuButtonRef}
          label="Menu"
          className="lg:hidden"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </IconButton>

        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-600 font-display text-sm font-bold text-white">
            M
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">MERN Store</span>
        </Link>

        <SearchBox className="ml-auto hidden max-w-sm flex-1 md:block" />

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <div className="relative" ref={accountRef}>
            <IconButton
              ref={accountButtonRef}
              label="Account"
              aria-expanded={accountOpen}
              aria-controls={accountId}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <User size={19} />
            </IconButton>
            {accountOpen && (
              <div id={accountId} className="card-surface absolute right-0 z-40 mt-2 w-56 p-2 text-sm">
                {token ? (
                  <>
                    <p className="px-3 py-2 text-xs text-ink-500">
                      Signed in as <span className="font-medium text-ink-800">{user?.email}</span>
                    </p>
                    <Link to="/dashboard" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-ink-50">
                      <LayoutDashboard size={15} /> Dashboard
                    </Link>
                    <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-ink-50">
                      <LogOut size={15} /> Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setAccountOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-ink-50">
                      Sign in
                    </Link>
                    <Link to="/register" onClick={() => setAccountOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-ink-50">
                      Create an account
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => dispatch(cartToggled(true))}
            aria-label={`Open bag, ${plural(cartCount, 'item')}`}
            className="relative inline-flex h-10 items-center gap-2 rounded-full bg-ink-900 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            <ShoppingBag size={16} aria-hidden />
            <span className="hidden sm:inline">{currency(cartSubtotal)}</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* category strip */}
      <div className="hidden border-t border-ink-100 lg:block">
        <div className="container-page flex items-center gap-1 py-2">
          <span className="eyebrow mr-2">Categories</span>
          {stripCategories(categories?.categories).map((category) => (
            <Link
              key={category._id}
              to={`/shop?category=${category.slug}`}
              className="rounded-full px-3 py-1.5 text-sm text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              {category.name}
            </Link>
          ))}
          <Link to="/shop" className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
            All products <ChevronDown size={14} className="-rotate-90" />
          </Link>
        </div>
      </div>

      {menuOpen && (
        <div id={menuId} ref={menuRef} className="border-t border-ink-200 bg-white p-4 lg:hidden">
          <SearchBox className="mb-3" onNavigate={() => setMenuOpen(false)} />
          <div className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm hover:bg-ink-50">
                {link.label}
              </Link>
            ))}
            {token ? (
              <Button variant="outline" size="sm" className="mt-2" onClick={signOut}>
                Sign out
              </Button>
            ) : (
              <ButtonLink to="/login" size="sm" className="mt-2" onClick={() => setMenuOpen(false)}>
                Sign in
              </ButtonLink>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
