import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { useSelector } from 'react-redux'
import { AuthShell } from '../../components/account/AuthShell'
import { FormAlert } from '../../components/account/FormAlert'
import { apiErrorMessage } from '../../lib/apiError'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { useForgotPasswordMutation } from '../../features/auth/authApi'
import { selectIsAuthenticated } from '../../features/auth/authSlice'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPassword() {
  useDocumentTitle('Forgot password')
  const authenticated = useSelector(selectIsAuthenticated)
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [apiError, setApiError] = useState('')
  const [sent, setSent] = useState(null)

  if (authenticated) return <Navigate to="/dashboard" replace />

  const submit = async (event) => {
    event.preventDefault()
    setApiError('')
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setError('')

    try {
      const data = await forgotPassword({ email: email.trim() }).unwrap()
      setSent(data?.message || 'Please check your email for the link to reset your password.')
    } catch (requestError) {
      setApiError(apiErrorMessage(requestError, 'Please try again!'))
    }
  }

  if (sent) {
    return (
      <AuthShell
        eyebrow="Reset password"
        title="Check your inbox"
        subtitle="The reset link is valid for one hour."
        footer={
          <>
            Remembered it?{' '}
            <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
              Back to login
            </Link>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700">
          <MailCheck size={18} className="mt-0.5 shrink-0" />
          <span className="leading-relaxed">{sent}</span>
        </div>
        <p className="mt-4 text-sm text-ink-500">
          The address we wrote to was <span className="font-medium text-ink-700">{email}</span>.
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Reset password"
      title="Forgot your password?"
      subtitle="Enter the email address on your account and we will send a reset link."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Back to login
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {apiError && <FormAlert>{apiError}</FormAlert>}

        <Field label="Email address" error={error} required>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setError('')
            }}
            invalid={Boolean(error)}
          />
        </Field>

        <div className="pt-1">
          <Button type="submit" loading={isLoading}>
            Send reset link
          </Button>
        </div>
      </form>
    </AuthShell>
  )
}
