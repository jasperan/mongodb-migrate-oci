import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Store } from 'lucide-react'
import { AuthShell } from '../../components/account/AuthShell'
import { FormAlert } from '../../components/account/FormAlert'
import { apiErrorMessage } from '../../lib/apiError'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { useMerchantSignupMutation } from '../../features/manager/managerApi'
import { toastShown } from '../../features/ui/uiSlice'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Second half of the merchant onboarding: the approval email links here with the
 * onboarding token in the path and the applicant's email in the query string.
 * Completing it only sets the password — the merchant still has to sign in.
 */
export default function MerchantSignup() {
  useDocumentTitle('Merchant signup')
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [merchantSignup, { isLoading }] = useMerchantSignupMutation()

  const [form, setForm] = useState({
    email: searchParams.get('email') || '',
    firstName: '',
    lastName: '',
    password: ''
  })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')

  const change = (name) => (event) => {
    const { value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.firstName.trim()) next.firstName = 'First name is required.'
    if (!form.lastName.trim()) next.lastName = 'Last name is required.'
    if (!form.password) next.password = 'Password is required.'
    else if (form.password.length < 6) next.password = 'Password must be at least 6 characters.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    setApiError('')
    if (!token) {
      setApiError('This onboarding link is missing its token. Ask the store team to resend it.')
      return
    }
    if (!validate()) return

    try {
      await merchantSignup({
        token,
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        password: form.password
      }).unwrap()
      dispatch(
        toastShown({
          type: 'success',
          message: 'You have signed up successfully! Please sign in with your email and password.'
        })
      )
      navigate('/login', { replace: true })
    } catch (error) {
      setApiError(
        apiErrorMessage(error, 'This onboarding link may have expired. Please contact the store team.')
      )
    }
  }

  return (
    <AuthShell
      eyebrow="Merchant onboarding"
      title="Finish your merchant account"
      subtitle="Set the name and password you will use to sign in and manage your brand."
      footer={
        <>
          Already set up?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Back to login
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {apiError && <FormAlert>{apiError}</FormAlert>}

        <Field label="Email address" error={errors.email} required hint="This must match the address you applied with">
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@business.com"
            value={form.email}
            onChange={change('email')}
            invalid={Boolean(errors.email)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName} required>
            <Input
              name="firstName"
              autoComplete="given-name"
              value={form.firstName}
              onChange={change('firstName')}
              invalid={Boolean(errors.firstName)}
            />
          </Field>
          <Field label="Last name" error={errors.lastName} required>
            <Input
              name="lastName"
              autoComplete="family-name"
              value={form.lastName}
              onChange={change('lastName')}
              invalid={Boolean(errors.lastName)}
            />
          </Field>
        </div>

        <Field label="Password" error={errors.password} required hint="At least 6 characters">
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={form.password}
            onChange={change('password')}
            invalid={Boolean(errors.password)}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" loading={isLoading}>
            <Store size={16} /> Get started
          </Button>
          <Link to="/sell" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Not a merchant yet? Apply to sell
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
