import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { ShieldAlert } from 'lucide-react'
import { AuthShell } from '../../components/account/AuthShell'
import { FormAlert } from '../../components/account/FormAlert'
import { ButtonLink } from '../../components/ui/Button'
import { LoadingBlock } from '../../components/ui/Display'
import { credentialsReceived } from '../../features/auth/authSlice'
import { toastShown } from '../../features/ui/uiSlice'

/**
 * Landing page for the OAuth callback. The server redirects here with
 * `?token=Bearer%20<jwt>`; the query string is decoded with URLSearchParams
 * (the legacy client split on the first `=` and only replaced one space).
 */
export default function AuthSuccess() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rawToken = searchParams.get('token')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!rawToken) {
      setFailed(true)
      return
    }
    // The API returns the header-ready value; normalise in case a provider
    // hands back the bare JWT instead.
    const token = rawToken.startsWith('Bearer ') ? rawToken : `Bearer ${rawToken}`
    dispatch(credentialsReceived({ token, user: null }))
    dispatch(toastShown({ type: 'success', message: 'Signed in successfully' }))
    navigate('/dashboard', { replace: true })
  }, [dispatch, navigate, rawToken])

  if (failed) {
    return (
      <AuthShell eyebrow="Sign in" title="That sign-in link did not work">
        <FormAlert>
          The provider callback arrived without a token. Provider sign-in is disabled in this
          deployment — sign in with your email address and password instead.
        </FormAlert>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink to="/login">Go to sign in</ButtonLink>
          <ButtonLink to="/" variant="outline">
            Back to the store
          </ButtonLink>
        </div>
        <p className="mt-5 flex items-center gap-2 text-sm text-ink-500">
          <ShieldAlert size={16} /> If this keeps happening, request a password reset.
        </p>
        <p className="mt-2 text-sm">
          <Link to="/forgot-password" className="font-medium text-brand-700 hover:text-brand-800">
            Reset your password
          </Link>
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell eyebrow="Sign in" title="Finishing sign-in" subtitle="One moment while we store your credentials.">
      <LoadingBlock label="Completing sign-in…" />
    </AuthShell>
  )
}
