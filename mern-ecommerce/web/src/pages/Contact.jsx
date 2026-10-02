import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { CheckCircle2, Clock, Mail, MapPin, Phone, Send } from 'lucide-react'
import { Badge } from '../components/ui/Display'
import { Button, ButtonLink } from '../components/ui/Button'
import { Field, Input, Textarea } from '../components/ui/Field'
import { useSendContactMessageMutation } from '../features/manager/managerApi'
import { toastShown } from '../features/ui/uiSlice'
import { apiErrorMessage } from '../lib/apiError'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const EMPTY = { name: '', email: '', message: '' }
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const STORE_INFO = [
  { icon: MapPin, label: 'Storefront', value: '1 Market Street, San Francisco, CA 94105' },
  { icon: Phone, label: 'Phone', value: '+1 (415) 555-0132' },
  { icon: Mail, label: 'Email', value: 'support@mern-store.dev' },
  { icon: Clock, label: 'Support hours', value: 'Mon–Fri, 08:00–18:00 PT' }
]

export default function Contact() {
  useDocumentTitle('Contact')
  const dispatch = useDispatch()
  const [sendContactMessage, { isLoading }] = useSendContactMessageMutation()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [confirmation, setConfirmation] = useState(null)

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'Name is required.'
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Email format is invalid.'
    if (!form.message.trim()) next.message = 'Message is required.'
    else if (form.message.trim().length < 10) next.message = 'Please write at least 10 characters.'
    setErrors(next)
    if (Object.keys(next).length) return

    try {
      const response = await sendContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        message: form.message.trim()
      }).unwrap()
      setConfirmation(response?.message || 'We received your message.')
      setForm(EMPTY)
      dispatch(toastShown({ type: 'success', message: 'Your message is on its way' }))
    } catch (error) {
      const message = apiErrorMessage(error, 'We could not send your message. Please try again.')
      setErrors({ form: message })
      dispatch(toastShown({ type: 'error', message }))
    }
  }

  return (
    <div className="container-page py-10">
      <header className="mb-8 max-w-3xl">
        <p className="eyebrow">Contact</p>
        <h1 className="mt-1 font-display text-3xl">Talk to the store team</h1>
        <p className="mt-2 text-sm text-ink-500">
          Questions about an order, a product or selling with us? Send us a message and a member of the team will reply by email.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="card-surface p-6">
          {confirmation ? (
            <div className="flex flex-col items-start gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 size={22} />
              </span>
              <h2 className="font-display text-xl">Message received</h2>
              <p className="text-sm text-ink-600">{confirmation}</p>
              <p className="text-xs text-ink-500">Replies go to the email address you entered.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setConfirmation(null)}>
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h2 className="font-display text-lg">Send us a message</h2>
              <div className="mt-5 space-y-4">
                <Field label="Name" required error={errors.name}>
                  <Input
                    value={form.name}
                    onChange={(event) => change('name', event.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Email address" required error={errors.email}>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => change('email', event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </Field>
                <Field label="Message" required error={errors.message} hint="Minimum 10 characters.">
                  <Textarea
                    value={form.message}
                    onChange={(event) => change('message', event.target.value)}
                    rows={6}
                    placeholder="How can we help?"
                  />
                </Field>
              </div>

              {errors.form && (
                <p className="mt-4 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">{errors.form}</p>
              )}

              <Button type="submit" className="mt-5" loading={isLoading}>
                <Send size={15} /> Send message
              </Button>
            </form>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="card-surface p-5">
            <h2 className="font-display text-base">Store information</h2>
            <ul className="mt-4 space-y-4">
              {STORE_INFO.map((item) => (
                <li key={item.label} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600">
                    <item.icon size={16} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{item.label}</p>
                    <p className="text-sm text-ink-800">{item.value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-surface p-5">
            <Badge tone="duality">Order help</Badge>
            <h3 className="mt-2 font-display text-base">Already ordered?</h3>
            <p className="mt-1 text-sm text-ink-500">
              Order status, cancellations and re-orders live in your dashboard.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink to="/dashboard/orders" size="sm">
                Manage orders
              </ButtonLink>
              <ButtonLink to="/shop" size="sm" variant="outline">
                Keep shopping
              </ButtonLink>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
