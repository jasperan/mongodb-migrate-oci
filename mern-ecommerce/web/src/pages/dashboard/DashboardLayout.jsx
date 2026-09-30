import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  BadgeCheck,
  Boxes,
  Heart,
  LifeBuoy,
  LogOut,
  MapPin,
  Package,
  ShieldCheck,
  Star,
  Store,
  Tags,
  UserRound,
  Users
} from 'lucide-react'
import clsx from 'clsx'
import { Badge } from '../../components/ui/Display'
import { Button } from '../../components/ui/Button'
import { useProfileQuery } from '../../features/auth/authApi'
import { loggedOut, profileReceived, selectAuth } from '../../features/auth/authSlice'
import { toastShown } from '../../features/ui/uiSlice'
import { initials, roleLabel } from '../../lib/format'

// Mirrors `client/app/containers/Dashboard/links.json`: every role gets the
// account, order and wishlist pages; the management pages are role-gated and
// the route table enforces the same matrix server-side.
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
  { to: '/dashboard/brand', label: 'Brand', icon: Store },
  { to: '/dashboard/users', label: 'Users', icon: Users },
  { to: '/dashboard/merchant', label: 'Merchants', icon: BadgeCheck },
  { to: '/dashboard/review', label: 'Reviews', icon: Star }
]

const MERCHANT_LINKS = [
  { to: '/dashboard/brand', label: 'Brand', icon: Store },
  { to: '/dashboard/product', label: 'Products', icon: Boxes },
  { to: '/dashboard/review', label: 'Reviews', icon: Star }
]

const SUPPORT_LINK = { to: '/support', label: 'Support', icon: LifeBuoy }

const ROLE_TONES = {
  'ROLE ADMIN': 'brand',
  'ROLE MERCHANT': 'dark',
  'ROLE MEMBER': 'neutral'
}

function navLinkClass({ isActive }) {
  return clsx(
    'inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
  )
}

export default function DashboardLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const authUser = useSelector(selectAuth).user
  const { data } = useProfileQuery()
  const profile = data?.user

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

  const roleLinks =
    role === 'ROLE ADMIN' ? ADMIN_LINKS : role === 'ROLE MERCHANT' ? MERCHANT_LINKS : []

  const groups = [
    { label: 'Account', items: ACCOUNT_LINKS },
    ...(roleLinks.length ? [{ label: 'Manage', items: roleLinks }] : []),
    { label: 'Help', items: [SUPPORT_LINK] }
  ]

  const signOut = () => {
    dispatch(loggedOut())
    dispatch(toastShown({ type: 'info', message: 'You have signed out!' }))
    navigate('/login', { replace: true })
  }

  return (
    <div className="container-page py-6 lg:py-10">
      <div className="grid gap-6 lg:grid-cols-[17.5rem_1fr] lg:gap-8">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface overflow-hidden">
            <div className="flex items-center gap-3 bg-ink-950 p-4 text-white">
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
              <div className="border-b border-ink-100 bg-ink-50 px-4 py-2.5 text-xs text-ink-600">
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

            <nav className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible" aria-label="Dashboard">
              {groups.map((group) => (
                <div key={group.label} className="flex gap-1 lg:flex-col">
                  <span className="eyebrow hidden px-3 pt-3 pb-1 lg:block">{group.label}</span>
                  {group.items.map(({ to, label, icon: Icon, end }) => (
                    <NavLink key={to} to={to} end={end} className={navLinkClass}>
                      <Icon size={16} />
                      {label}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>

            <div className="border-t border-ink-100 p-3">
              <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
                <LogOut size={15} /> Sign out
              </Button>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  )
}
