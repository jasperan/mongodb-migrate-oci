import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { AuthShell } from '../../components/account/AuthShell'
import { FormAlert, apiErrorMessage } from '../../components/account/FormAlert'
import { SocialAuthNote } from '../../components/account/SocialAuthNote'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { useLoginMutation } from '../../features/auth/authApi'
import { selectIsAuthenticated } from '../../features/auth/authSlice'
import { toastShown } from '../../features/ui/uiSlice'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const authenticated = useSelector(selectIsAuthenticated)
  const [login, { isLoading }] = useLoginMutation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')

  // RequireAuth hands back the path the visitor was trying to reach.
  const from = location.state?.from || '/dashboard'

  if (authenticated) return <Navigate to={from} replace />

  const change = (name) => (event) => {
    const { value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.password) next.password = 'Password is required.'
    else if (form.password.length < 6) next.password = 'Password must be at least 6 characters.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    setApiError('')
    if (!validate()) return

    try {
      const data = await login({ email: form.email.trim(), password: form.password }).unwrap()
      const firstName = data?.user?.firstName
      dispatch(
        toastShown({
          type: 'success',
          message: firstName ? `Hey ${firstName}, welcome back!` : 'Signed in successfully'
        })
      )
      navigate(from, { replace: true })
    } catch (error) {
      setApiError(apiErrorMessage(error, 'Please try to login again!'))
    }
  }

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back"
      subtitle="Sign in to manage your orders, addresses and wishlist."
      footer={
        <>
          New to MERN Store?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800">
            Create an account
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

        <Field label="Password" error={errors.password} required>
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={form.password}
            onChange={change('password')}
            invalid={Boolean(errors.password)}
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button type="submit" loading={isLoading}>
            Sign in
          </Button>
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Forgot password?
          </Link>
        </div>
      </form>

      <SocialAuthNote />
    </AuthShell>
  )
}
