import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  BadgeCheck,
  Boxes,
  ChevronDown,
  Heart,
  LifeBuoy,
  LogOut,
  MapPin,
  Menu,
  Package,
  ShieldAlert,
  ShieldCheck,
  Star,
  Store,
  Tags,
  UserRound,
  Users
} from 'lucide-react'
import { Badge } from '../../components/ui/Display'
import { Button } from '../../components/ui/Button'
import { useProfileQuery } from '../../features/auth/authApi'
import { loggedOut, profileReceived, selectAuth } from '../../features/auth/authSlice'
import { toastShown } from '../../features/ui/uiSlice'
import { cn } from '../../lib/cn'
import { initials, roleLabel } from '../../lib/format'

// Mirrors `client/app/containers/Dashboard/links.json`: every role gets the
// account, order and wishlist pages; the management pages are role-gated here
// and in routes.jsx, and the API enforces the same matrix on every request.
const ACCOUNT_LINKS = [
  { to: '/dashboard', label: 'Account details', icon: UserRound, end: true },
  { to: '/dashboard/security', label: 'Security', icon: ShieldCheck },
  { to: '/dashboard/address', label: 'Address', icon: MapPin },
  { to: '/dashboard/orders', label: 'Orders', icon: Package },
  { to: '/dashboard/wishlist', label: 'Wishlist', icon: Heart }
]

const ADMIN_LINKS = [
  { to: '/dashboard/product', label: 'Products', icon: Boxes },
  { to: '/dashboard/category', label: 'Categories', icon: Tags },
  { to: '/dashboard/brand', label: 'Brands', icon: Store },
  { to: '/dashboard/users', label: 'Users', icon: Users },
  { to: '/dashboard/merchant', label: 'Merchants', icon: BadgeCheck },
  { to: '/dashboard/review', label: 'Reviews', icon: Star }
]

const MERCHANT_LINKS = [
  { to: '/dashboard/brand', label: 'Brand', icon: Store },
  { to: '/dashboard/product', label: 'Products', icon: Boxes }
]

const SUPPORT_LINK = { to: '/support', label: 'Support', icon: LifeBuoy }

const ROLE_TONES = {
  'ROLE ADMIN': 'brand',
  'ROLE MERCHANT': 'dark',
  'ROLE MEMBER': 'neutral'
}

function navLinkClass({ isActive }) {
  return cn(
    'inline-flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
  )
}

function DisabledMerchantNotice({ className }) {
  return (
    <div
      role="status"
      className={cn('flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800', className)}
    >
      <ShieldAlert size={16} className="mt-0.5 shrink-0" />
      <p>
        <span className="font-semibold">Merchant account disabled.</span> An administrator turned off your access to
        product and brand management. Orders, addresses and your wishlist keep working; contact the store team to be
        re-enabled.
      </p>
    </div>
  )
}

export default function DashboardLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const authUser = useSelector(selectAuth).user
  const { data } = useProfileQuery()
  const profile = data?.user
  const [menuOpen, setMenuOpen] = useState(false)

  // The slice only knows what the login response carried; the full document
  // (merchant, brand) comes from GET /user/me, so keep both in sync for the
  // header and the sidebar.
  useEffect(() => {
    if (profile) dispatch(profileReceived(profile))
  }, [dispatch, profile])

  const user = profile || authUser || {}
  const role = user.role
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Your account'

  // `merchant.isActive === false` is what the admin's Merchants switch writes; the
  // API answers 403 to such an account on every management route.
  const merchantDisabled = role === 'ROLE MERCHANT' && user.merchant?.isActive === false
  const roleLinks = merchantDisabled
    ? []
    : role === 'ROLE ADMIN'
      ? ADMIN_LINKS
      : role === 'ROLE MERCHANT'
        ? MERCHANT_LINKS
        : []
  const blockedPage = merchantDisabled && MERCHANT_LINKS.some((link) => pathname.startsWith(link.to))

  const groups = [
    { label: 'Account', items: ACCOUNT_LINKS },
    ...(roleLinks.length ? [{ label: 'Manage', items: roleLinks }] : []),
    { label: 'Help', items: [SUPPORT_LINK] }
  ]

  const current = groups
    .flatMap((group) => group.items)
    .find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))

  const signOut = () => {
    dispatch(loggedOut())
    dispatch(toastShown({ type: 'info', message: 'You have signed out!' }))
    navigate('/login', { replace: true })
  }

  return (
    <div className="container-page py-6 lg:py-10">
      <div className="grid gap-6 lg:grid-cols-[17.5rem_1fr] lg:gap-8">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {/* On short laptops the nav scrolls inside the card so Sign out stays on screen. */}
          <div className="card-surface overflow-hidden lg:flex lg:max-h-[calc(100dvh-7rem)] lg:flex-col">
            <div className="flex shrink-0 items-center gap-3 bg-ink-950 p-4 text-white">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 font-display text-sm font-semibold">
                {initials(displayName)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm leading-tight">{displayName}</p>
                <p className="truncate text-xs text-white/60">{user.email || 'Signed in'}</p>
              </div>
              {role && (
                <Badge tone={ROLE_TONES[role] || 'neutral'} className="ml-auto shrink-0">
                  {roleLabel(role)}
                </Badge>
              )}
            </div>

            {(user.merchant?.name || user.merchant?.brand?.name) && (
              <div className="shrink-0 border-b border-ink-100 bg-ink-50 px-4 py-2.5 text-xs text-ink-600">
                {user.merchant?.name && (
                  <p className="truncate">
                    Merchant: <span className="font-medium text-ink-800">{user.merchant.name}</span>
                  </p>
                )}
                {user.merchant?.brand?.name && (
                  <p className="truncate">
                    Brand: <span className="font-medium text-ink-800">{user.merchant.brand.name}</span>
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="dashboard-nav"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 text-sm font-medium text-ink-800 lg:hidden"
            >
              <span className="inline-flex items-center gap-2">
                <Menu size={16} /> {current?.label || 'Dashboard menu'}
              </span>
              <ChevronDown size={16} className={cn('transition-transform', menuOpen && 'rotate-180')} />
            </button>

            <nav
              id="dashboard-nav"
              aria-label="Dashboard"
              className={cn(
                'max-h-[60dvh] flex-col gap-1 overflow-y-auto p-2 lg:block lg:max-h-none lg:min-h-0 lg:flex-1',
                menuOpen ? 'flex' : 'hidden'
              )}
            >
              {groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-1">
                  <span className="eyebrow px-3 pt-3 pb-1">{group.label}</span>
                  {group.items.map(({ to, label, icon: Icon, end }) => (
                    <NavLink key={to} to={to} end={end} className={navLinkClass} onClick={() => setMenuOpen(false)}>
                      <Icon size={16} />
                      {label}
                    </NavLink>
                  ))}
                </div>
              ))}
              {merchantDisabled && <DisabledMerchantNotice className="mt-3" />}
            </nav>

            <div className="shrink-0 border-t border-ink-100 p-3">
              <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
                <LogOut size={15} /> Sign out
              </Button>
            </div>
          </div>
        </aside>

        <section className="min-w-0">{blockedPage ? <DisabledMerchantNotice className="p-5 text-sm" /> : <Outlet />}</section>
      </div>
    </div>
  )
}
