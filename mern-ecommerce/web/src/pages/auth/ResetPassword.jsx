import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { KeyRound } from 'lucide-react'
import { AuthShell } from '../../components/account/AuthShell'
import { FormAlert, apiErrorMessage } from '../../components/account/FormAlert'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { useResetPasswordMutation } from '../../features/auth/authApi'
import { selectIsAuthenticated } from '../../features/auth/authSlice'
import { toastShown } from '../../features/ui/uiSlice'

export default function ResetPassword() {
  const { token } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const authenticated = useSelector(selectIsAuthenticated)
  const [resetPassword, { isLoading }] = useResetPasswordMutation()

  const [form, setForm] = useState({ password: '', confirmPassword: '' })
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
      const data = await resetPassword({ token, password: form.password }).unwrap()
      dispatch(
        toastShown({
          type: 'success',
          message: data?.message || 'Password changed. Please log in with your new password.'
        })
      )
      navigate('/login', { replace: true })
    } catch (error) {
      setApiError(apiErrorMessage(error, 'Your reset link may have expired. Please request a new one.'))
    }
  }

  if (!token) {
    return (
      <AuthShell eyebrow="Reset password" title="This link is not valid">
        <FormAlert>
          The reset link is missing its token. Request a new link and open it straight from your inbox.
        </FormAlert>
        <div className="mt-5">
          <Button onClick={() => navigate('/forgot-password')}>Request a new link</Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Reset password"
      title="Choose a new password"
      subtitle="Once the password changes, the reset link cannot be used again."
      footer={
        <>
          Need a new link?{' '}
          <Link to="/forgot-password" className="font-medium text-brand-700 hover:text-brand-800">
            Request another
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {apiError && <FormAlert>{apiError}</FormAlert>}

        <Field label="New password" error={errors.password} required hint="At least 6 characters">
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="New password"
            value={form.password}
            onChange={change('password')}
            invalid={Boolean(errors.password)}
          />
        </Field>

        <Field label="Confirm new password" error={errors.confirmPassword} required>
          <Input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Repeat the new password"
            value={form.confirmPassword}
            onChange={change('confirmPassword')}
            invalid={Boolean(errors.confirmPassword)}
          />
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" loading={isLoading}>
            <KeyRound size={16} /> Reset password
          </Button>
        </div>
      </form>
    </AuthShell>
  )
}
