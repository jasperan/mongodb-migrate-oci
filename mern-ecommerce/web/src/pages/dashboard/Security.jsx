import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../../components/account/PageHeader'
import { FormAlert } from '../../components/account/FormAlert'
import { apiErrorMessage } from '../../lib/apiError'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { useChangePasswordMutation, useProfileQuery } from '../../features/auth/authApi'
import { loggedOut } from '../../features/auth/authSlice'
import { toastShown } from '../../features/ui/uiSlice'

const EMPTY = { current: '', next: '', confirm: '' }

export default function Security() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { data: profileData } = useProfileQuery()
  const [changePassword, { isLoading }] = useChangePasswordMutation()

  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')

  const change = (name) => (event) => {
    const { value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!form.current) next.current = 'Enter your current password.'
    if (!form.next) next.next = 'Enter a new password.'
    else if (form.next.length < 6) next.next = 'Password must be at least 6 characters.'
    else if (form.next === form.current) next.next = 'Choose a password different from your current one.'
    if (!form.confirm) next.confirm = 'Repeat the new password.'
    else if (form.confirm !== form.next) next.confirm = 'Passwords do not match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    setApiError('')
    if (!validate()) return

    try {
      // POST /auth/reset: `password` is the CURRENT password and
      // `confirmPassword` is the new one — the naming is inherited from the
      // reset-token flow, so map the fields explicitly.
      const result = await changePassword({ password: form.current, confirmPassword: form.next }).unwrap()
      setForm(EMPTY)
      dispatch(
        toastShown({
          type: 'success',
          message: result?.message || 'Password changed successfully. Please login with your new password.'
        })
      )
      dispatch(loggedOut())
      navigate('/login', { replace: true })
    } catch (error) {
      setApiError(apiErrorMessage(error, 'Your password could not be changed. Please try again.'))
    }
  }

  const provider = profileData?.user?.provider
  const isExternalAccount = Boolean(provider) && provider !== 'Email'

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Security"
        description="Change the password used to sign in to your account."
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="card-surface p-5 sm:p-6">
          {isExternalAccount ? (
            <div className="rounded-xl border border-ink-200 bg-ink-50 p-5 text-sm text-ink-600">
              This account signs in with <span className="font-medium text-ink-800">{provider}</span>, so
              it has no password to change here. Use your {provider} account settings instead.
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-base">
                <ShieldCheck size={17} /> Change password
              </h2>

              {apiError && <FormAlert>{apiError}</FormAlert>}

              <Field label="Current password" error={errors.current} required>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={form.current}
                  onChange={change('current')}
                  invalid={Boolean(errors.current)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password" error={errors.next} required hint="At least 6 characters">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={form.next}
                    onChange={change('next')}
                    invalid={Boolean(errors.next)}
                  />
                </Field>
                <Field label="Confirm new password" error={errors.confirm} required>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={change('confirm')}
                    invalid={Boolean(errors.confirm)}
                  />
                </Field>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" loading={isLoading}>
                  <KeyRound size={16} /> Update password
                </Button>
              </div>
              <p className="text-xs text-ink-500">
                Changing your password signs you out of every session so you can sign in again with the
                new one.
              </p>
            </form>
          )}
        </section>

        <aside className="card-surface h-fit p-5 text-sm text-ink-600">
          <h2 className="font-display text-base text-ink-900">Locked out?</h2>
          <p className="mt-2 leading-relaxed">
            If you cannot remember the current password, sign out and use the reset link on the sign-in
            page. The link is mailed to the address on the account and is valid for one hour.
          </p>
          <ul className="mt-4 space-y-2">
            <li>• Passwords are stored as bcrypt hashes — nobody can read yours back.</li>
            <li>• A reset link can only be used once.</li>
          </ul>
        </aside>
      </div>
    </>
  )
}
