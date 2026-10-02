import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Database, Heart, MapPin, Package, Store } from 'lucide-react'
import { PageHeader } from '../../components/account/PageHeader'
import { FormAlert } from '../../components/account/FormAlert'
import { apiErrorMessage } from '../../lib/apiError'
import { Badge, LoadingBlock } from '../../components/ui/Display'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { useProfileQuery, useUpdateProfileMutation } from '../../features/auth/authApi'
import { useMyOrdersQuery } from '../../features/orders/orderApi'
import { useWishlistQuery } from '../../features/wishlist/wishlistApi'
import { useAddressesQuery } from '../../features/address/addressApi'
import { toastShown } from '../../features/ui/uiSlice'
import { initials, roleLabel } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const ROLE_TONES = { 'ROLE ADMIN': 'brand', 'ROLE MERCHANT': 'dark', 'ROLE MEMBER': 'neutral' }

function StatTile({ to, icon: Icon, value, label }) {
  return (
    <Link to={to} className="card-surface hover-lift flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-xl leading-tight text-ink-900">{value}</span>
        <span className="block truncate text-xs text-ink-500">{label}</span>
      </span>
    </Link>
  )
}

export default function Overview() {
  useDocumentTitle('Account')
  const dispatch = useDispatch()
  const { data: profileData, isLoading, isError, error, refetch } = useProfileQuery()
  const profile = profileData?.user

  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation()
  const { data: orders } = useMyOrdersQuery({ page: 1, limit: 1 })
  const { data: wishlist } = useWishlistQuery()
  const { data: addresses } = useAddressesQuery()

  const [draft, setDraft] = useState({ firstName: '', lastName: '', phoneNumber: '' })
  const [hydrated, setHydrated] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    if (!profile || hydrated) return
    setDraft({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      phoneNumber: profile.phoneNumber || ''
    })
    setHydrated(true)
  }, [profile, hydrated])

  const change = (name) => (event) => {
    const { value } = event.target
    setDraft((previous) => ({ ...previous, [name]: value }))
    setFieldErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setApiError('')

    const next = {}
    if (!draft.firstName.trim()) next.firstName = 'First name is required.'
    if (!draft.lastName.trim()) next.lastName = 'Last name is required.'
    setFieldErrors(next)
    if (Object.keys(next).length) return

    try {
      // The endpoint already wraps its argument as `{ profile }` — pass the
      // bare profile object, not another `{ profile }` envelope.
      const result = await updateProfile({
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phoneNumber: draft.phoneNumber.trim()
      }).unwrap()
      if (result?.user) {
        setDraft({
          firstName: result.user.firstName || '',
          lastName: result.user.lastName || '',
          phoneNumber: result.user.phoneNumber || ''
        })
      }
      dispatch(toastShown({ type: 'success', message: result?.message || 'Your profile is successfully updated!' }))
    } catch (requestError) {
      setApiError(apiErrorMessage(requestError, 'Your profile could not be updated. Please try again.'))
    }
  }

  if (isLoading && !profile) return <LoadingBlock label="Loading your account…" />

  if (isError || !profile) {
    return (
      <>
        <PageHeader eyebrow="Account" title="Account details" />
        <FormAlert className="mb-4">{apiErrorMessage(error, 'Your profile could not be loaded.')}</FormAlert>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </>
    )
  }

  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email
  const dirty =
    draft.firstName !== (profile.firstName || '') ||
    draft.lastName !== (profile.lastName || '') ||
    draft.phoneNumber !== (profile.phoneNumber || '')

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Account details"
        description="The name and phone number we use on orders and correspondence."
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="card-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-4 border-b border-ink-200 pb-5">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-ink-950 font-display text-lg font-semibold text-white">
              {initials(displayName)}
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg leading-tight">{displayName}</p>
              <p className="truncate text-sm text-ink-500">{profile.email}</p>
            </div>
            {profile.role && (
              <Badge tone={ROLE_TONES[profile.role] || 'neutral'} className="ml-auto">
                {roleLabel(profile.role)}
              </Badge>
            )}
          </div>

          <dl className="grid gap-3 py-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="eyebrow">Signed in with</dt>
              <dd className="mt-1 text-ink-700">{profile.provider || 'Email'}</dd>
            </div>
            <div>
              <dt className="eyebrow">Member since</dt>
              <dd className="mt-1 text-ink-700">
                {profile.created ? new Date(profile.created).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
              </dd>
            </div>
            {profile.merchant?.name && (
              <div>
                <dt className="eyebrow">Merchant</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-ink-700">
                  <Store size={14} /> {profile.merchant.name}
                  {profile.merchant.status && (
                    <Badge tone="neutral" className="ml-1">
                      {profile.merchant.status}
                    </Badge>
                  )}
                </dd>
              </div>
            )}
            {profile.merchant?.brand?.name && (
              <div>
                <dt className="eyebrow">Brand</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-ink-700">
                  <Store size={14} /> {profile.merchant.brand.name}
                </dd>
              </div>
            )}
          </dl>

          <form onSubmit={submit} noValidate className="border-t border-ink-200 pt-5">
            <h2 className="font-display text-base">Edit profile</h2>
            <p className="mt-1 mb-4 text-xs text-ink-500">
              The email address on the account cannot be changed from here.
            </p>

            {apiError && (
              <FormAlert className="mb-4">{apiError}</FormAlert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" error={fieldErrors.firstName} required>
                <Input value={draft.firstName} onChange={change('firstName')} invalid={Boolean(fieldErrors.firstName)} />
              </Field>
              <Field label="Last name" error={fieldErrors.lastName} required>
                <Input value={draft.lastName} onChange={change('lastName')} invalid={Boolean(fieldErrors.lastName)} />
              </Field>
              <Field label="Phone number" hint="Used on delivery notifications">
                <Input
                  value={draft.phoneNumber}
                  onChange={change('phoneNumber')}
                  placeholder="+1 555 0100"
                  inputMode="tel"
                />
              </Field>
              <Field label="Email address" hint="Read-only">
                <Input value={profile.email || ''} readOnly disabled />
              </Field>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Button type="submit" loading={isSaving} disabled={!dirty}>
                Save changes
              </Button>
              {dirty && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setDraft({
                      firstName: profile.firstName || '',
                      lastName: profile.lastName || '',
                      phoneNumber: profile.phoneNumber || ''
                    })
                  }
                >
                  Discard
                </Button>
              )}
            </div>
          </form>
        </section>

        <div className="space-y-5">
          <section>
            <h2 className="eyebrow mb-3">At a glance</h2>
            <div className="grid gap-3">
              <StatTile to="/dashboard/orders" icon={Package} value={orders?.count ?? '—'} label="Orders placed" />
              <StatTile to="/dashboard/wishlist" icon={Heart} value={wishlist?.wishlist?.length ?? '—'} label="Wishlist items" />
              <StatTile to="/dashboard/address" icon={MapPin} value={addresses?.addresses?.length ?? '—'} label="Saved addresses" />
            </div>
          </section>

          {profile.role === 'ROLE ADMIN' && (
            <section className="card-surface p-4">
              <h2 className="font-display text-base">Database tools</h2>
              <p className="mt-1 text-sm text-ink-500">
                Inspect collections, views and the catalogue validity report.
              </p>
              <ButtonLink to="/support/admin-db" size="sm" variant="duality" className="mt-3">
                <Database size={15} /> Open admin DB
              </ButtonLink>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
