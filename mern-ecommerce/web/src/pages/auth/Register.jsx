import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { AuthShell } from '../../components/account/AuthShell'
import { FormAlert, apiErrorMessage } from '../../components/account/FormAlert'
import { SocialAuthNote } from '../../components/account/SocialAuthNote'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input } from '../../components/ui/Field'
import { useRegisterMutation } from '../../features/auth/authApi'
import { selectIsAuthenticated } from '../../features/auth/authSlice'
import { toastShown } from '../../features/ui/uiSlice'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const EMPTY_FORM = {
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  confirmPassword: ''
}

export default function Register() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const authenticated = useSelector(selectIsAuthenticated)
  const [register, { isLoading }] = useRegisterMutation()

  const [form, setForm] = useState(EMPTY_FORM)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')

  if (authenticated) return <Navigate to="/dashboard" replace />

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
    if (!form.confirmPassword) next.confirmPassword = 'Please confirm your password.'
    else if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    setApiError('')
    if (!validate()) return

    try {
      await register({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        password: form.password,
        isSubscribed
      }).unwrap()
      dispatch(toastShown({ type: 'success', message: 'Your account has been created. Welcome aboard!' }))
      navigate('/', { replace: true })
    } catch (error) {
      setApiError(apiErrorMessage(error, 'Please try to signup again!'))
    }
  }

  return (
    <AuthShell
      eyebrow="Create account"
      title="Create your account"
      subtitle="Buy from the catalogue, track orders and keep a wishlist."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Back to login
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {apiError && <FormAlert>{apiError}</FormAlert>}

        <Field label="Email address" error={errors.email} required>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
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
              placeholder="Jane"
              value={form.firstName}
              onChange={change('firstName')}
              invalid={Boolean(errors.firstName)}
            />
          </Field>
          <Field label="Last name" error={errors.lastName} required>
            <Input
              name="lastName"
              autoComplete="family-name"
              placeholder="Doe"
              value={form.lastName}
              onChange={change('lastName')}
              invalid={Boolean(errors.lastName)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <Field label="Confirm password" error={errors.confirmPassword} required>
            <Input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChange={change('confirmPassword')}
              invalid={Boolean(errors.confirmPassword)}
            />
          </Field>
        </div>

        <Checkbox
          label="Subscribe to the newsletter for new arrivals"
          checked={isSubscribed}
          onChange={(event) => setIsSubscribed(event.target.checked)}
        />

        <div className="pt-1">
          <Button type="submit" loading={isLoading}>
            Create account
          </Button>
        </div>
      </form>

      <SocialAuthNote />
    </AuthShell>
  )
}
