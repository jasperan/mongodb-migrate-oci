import { Globe, Info, Share2 } from 'lucide-react'
import { API_BASE_URL } from '../../app/api'

// The Express app only registers the Google/Facebook passport strategies when
// the deployment provides credentials (`GOOGLE_*` / `FACEBOOK_*` env keys). The
// client learns about that from a build-time variable or from a runtime hook
// that the server can inject; when neither is present the provider buttons are
// rendered disabled and a note explains why, instead of linking to an endpoint
// that would fail the handshake.
function readConfiguredProviders() {
  const runtime = typeof window !== 'undefined' ? window.__AUTH_PROVIDERS__ : null
  const raw = runtime || import.meta.env?.VITE_AUTH_PROVIDERS || ''
  const list = String(raw)
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean)

  if (!list.length && import.meta.env?.VITE_GOOGLE_CLIENT_ID) list.push('google')
  if (!list.length && import.meta.env?.VITE_FACEBOOK_APP_ID) list.push('facebook')
  return list
}

function ProviderButton({ label, Icon, href, disabled = false }) {
  const className =
    'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors'
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${className} cursor-not-allowed border-ink-200 bg-ink-50 text-ink-400`}
      >
        <Icon size={16} />
        {label}
      </span>
    )
  }
  return (
    <a href={href} className={`${className} border-ink-300 bg-white text-ink-800 hover:border-ink-400 hover:bg-ink-50`}>
      <Icon size={16} />
      {label}
    </a>
  )
}

export function SocialAuthNote() {
  const providers = readConfiguredProviders()

  if (!providers.length) {
    return (
      <div className="mt-6 border-t border-ink-200 pt-5">
        <div className="flex items-start gap-2.5 rounded-xl border border-ink-200 bg-ink-50 px-3.5 py-3 text-sm text-ink-600">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span className="leading-relaxed">
            Social sign-in is disabled in this deployment. Use the email address and password for your
            account — Google and Facebook sign-in need provider keys that are not configured here.
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          <ProviderButton label="Google" Icon={Globe} disabled />
          <ProviderButton label="Facebook" Icon={Share2} disabled />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 border-t border-ink-200 pt-5">
      <span className="eyebrow">Or continue with</span>
      <div className="mt-3 flex gap-2">
        {providers.includes('google') && (
          <ProviderButton label="Google" Icon={Globe} href={`${API_BASE_URL}/auth/google`} />
        )}
        {providers.includes('facebook') && (
          <ProviderButton label="Facebook" Icon={Share2} href={`${API_BASE_URL}/auth/facebook`} />
        )}
      </div>
    </div>
  )
}
