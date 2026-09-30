import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { BadgeCheck, Building2, CheckCircle2, Mail, Sparkles, Store, Truck } from 'lucide-react'
import { Badge } from '../components/ui/Display'
import { Button, ButtonLink } from '../components/ui/Button'
import { Field, Input, Textarea } from '../components/ui/Field'
import { useApplyMerchantMutation } from '../features/manager/managerApi'
import { toastShown } from '../features/ui/uiSlice'

const EMPTY = {
  name: '',
  email: '',
  phoneNumber: '',
  brandName: '',
  brandDescription: '',
  business: '',
  address: '',
  city: '',
  country: '',
  zipCode: '',
  description: ''
}

const PHONE_PATTERN = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PERKS = [
  { icon: Store, title: 'Your own brand', body: 'Approval provisions a brand document linked to your merchant account.' },
  { icon: Truck, title: 'List products', body: 'Publish products with SKU, pricing, taxability and stock straight into the catalogue.' },
  { icon: BadgeCheck, title: 'Managed onboarding', body: 'An admin reviews your application, then you receive a signup link by email.' }
]

export default function Sell() {
  const dispatch = useDispatch()
  const [applyMerchant, { isLoading }] = useApplyMerchantMutation()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState(null)

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Name is required.'
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Email format is invalid.'
    if (!form.phoneNumber.trim()) next.phoneNumber = 'Phone number is required.'
    else if (!PHONE_PATTERN.test(form.phoneNumber.trim())) next.phoneNumber = 'Phone number format is invalid.'
    if (!form.brandName.trim()) next.brandName = 'Brand is required.'
    if (!form.business.trim()) next.business = 'Business is required.'
    else if (form.business.trim().length < 10) next.business = 'Business must be at least 10 characters.'
    return next
  }

  const submit = async (event) => {
    event.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length) {
      dispatch(toastShown({ type: 'error', message: 'Please correct the highlighted fields.' }))
      return
    }
    try {
      const response = await applyMerchant(form).unwrap()
      setResult(response)
      setForm(EMPTY)
      dispatch(toastShown({ type: 'success', message: response?.message || 'Application received' }))
    } catch (error) {
      dispatch(
        toastShown({
          type: 'error',
          message: error?.data?.error || 'We could not submit your application. Please try again.'
        })
      )
    }
  }

  if (result) {
    return (
      <div className="container-page py-16">
        <div className="card-surface mx-auto max-w-2xl p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={26} />
          </span>
          <h1 className="mt-4 font-display text-2xl">Application received</h1>
          <p className="mt-2 text-sm text-ink-600">
            {result.message || 'We received your request and will reach out shortly.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-ink-500">
            <Badge tone="warning">Waiting Approval</Badge>
            <span>An admin reviews applications in the merchant dashboard.</span>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink to="/shop">Continue shopping</ButtonLink>
            <Button variant="outline" onClick={() => setResult(null)}>
              Submit another application
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container-page py-10">
      <header className="mb-8 max-w-3xl">
        <p className="eyebrow">Sell with us</p>
        <h1 className="mt-1 font-display text-3xl">Become a MERN Store seller</h1>
        <p className="mt-2 text-sm text-ink-500">
          Apply for a merchant account. Your application is stored in the <code className="text-ink-700">merchants</code>{' '}
          collection with the status <strong className="font-medium text-ink-700">Waiting Approval</strong>; once an
          admin approves it, a brand is created and you are invited to set a password.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <form onSubmit={submit} className="card-surface p-6">
          <h2 className="font-display text-lg">Merchant application</h2>
          <p className="mt-1 text-xs text-ink-500">Fields marked with * are required.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={errors.name}>
              <Input
                value={form.name}
                onChange={(event) => change('name', event.target.value)}
                placeholder="Your full name"
                autoComplete="name"
              />
            </Field>
            <Field label="Email address" required error={errors.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => change('email', event.target.value)}
                placeholder="you@business.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Phone number" required error={errors.phoneNumber} hint="US format, e.g. 415-555-0132">
              <Input
                value={form.phoneNumber}
                onChange={(event) => change('phoneNumber', event.target.value)}
                placeholder="415-555-0132"
                autoComplete="tel"
              />
            </Field>
            <Field label="Brand name" required error={errors.brandName}>
              <Input
                value={form.brandName}
                onChange={(event) => change('brandName', event.target.value)}
                placeholder="Your storefront brand"
              />
            </Field>
            <Field label="Brand description" className="sm:col-span-2" hint="Becomes the brand description once approved.">
              <Input
                value={form.brandDescription}
                onChange={(event) => change('brandDescription', event.target.value)}
                placeholder="A one-line pitch for your brand"
              />
            </Field>
            <Field label="Business description" required error={errors.business} className="sm:col-span-2">
              <Textarea
                value={form.business}
                onChange={(event) => change('business', event.target.value)}
                rows={4}
                placeholder="What do you sell, and who do you sell it to?"
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input
                value={form.address}
                onChange={(event) => change('address', event.target.value)}
                placeholder="Street address"
                autoComplete="street-address"
              />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(event) => change('city', event.target.value)} />
            </Field>
            <Field label="Country">
              <Input value={form.country} onChange={(event) => change('country', event.target.value)} />
            </Field>
            <Field label="Zip code">
              <Input value={form.zipCode} onChange={(event) => change('zipCode', event.target.value)} />
            </Field>
            <Field label="Anything else?" className="sm:col-span-2">
              <Textarea
                value={form.description}
                onChange={(event) => change('description', event.target.value)}
                rows={3}
                placeholder="Catalogue size, warehouses, links…"
              />
            </Field>
          </div>

          {errors.name || errors.email || errors.phoneNumber ? (
            <p className="mt-5 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">
              We could not read your contact details — please check the fields marked in red.
            </p>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <Button type="submit" loading={isLoading}>
              Submit application
            </Button>
            <span className="text-xs text-ink-500">
              Already approved? <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">Sign in</Link>
            </span>
          </div>
        </form>

        <aside className="flex flex-col gap-4">
          <div className="card-surface bg-ink-950 p-6 text-white">
            <Sparkles size={20} className="text-brand-400" />
            <h2 className="mt-3 font-display text-lg text-white">Why sell on MERN Store?</h2>
            <p className="mt-2 text-sm text-ink-300">
              The catalogue is served by a document API that stores JSON documents
              and relational views over the same data.
            </p>
          </div>
          {PERKS.map((perk) => (
            <div key={perk.title} className="card-surface flex gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <perk.icon size={18} />
              </span>
              <div>
                <h3 className="font-display text-sm">{perk.title}</h3>
                <p className="mt-0.5 text-xs text-ink-500">{perk.body}</p>
              </div>
            </div>
          ))}
          <div className="card-surface flex gap-3 p-4 text-sm text-ink-600">
            <Mail size={16} className="mt-0.5 shrink-0 text-ink-400" />
            Questions first? <Link to="/contact" className="font-medium text-brand-700 hover:text-brand-800">Contact the team</Link>
          </div>
          <div className="card-surface flex gap-3 p-4 text-sm text-ink-600">
            <Building2 size={16} className="mt-0.5 shrink-0 text-ink-400" />
            Applications are reviewed by a store admin before any brand or product is published.
          </div>
        </aside>
      </div>
    </div>
  )
}
