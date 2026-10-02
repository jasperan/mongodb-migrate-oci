const FALLBACK = 'Your request could not be processed. Please try again.'
export const SESSION_EXPIRED = 'Your session has expired. Please sign in again.'
const HTML = /<\s*(!doctype|html|head|body|pre)\b/i
const FORBIDDEN = 'You are not allowed to make this request.'

/**
 * Normalises every error shape the app can receive into `{ status, message }`.
 *
 * Redux Toolkit Query wraps a non-2xx response as `{ status, data }`, but a body
 * that is not JSON (passport's plain-text 401, an HTML error page) arrives as
 * `{ status: 'PARSING_ERROR', originalStatus, data }`, so `status` here is the
 * real HTTP status whenever one exists. The API answers `{ error }` (plus
 * optional `details`/`hint` on the AI endpoints) or `{ message }`; the fetch
 * layer adds `FETCH_ERROR`/`TIMEOUT_ERROR`. HTML bodies are never shown.
 */
export function describeApiError(error, fallback = FALLBACK) {
  if (!error) return { status: null, message: fallback }
  if (typeof error === 'string') return { status: null, message: error }

  // A non-JSON body (nginx's HTML 502/413 page, passport's plain-text 401) is
  // reported by RTK as PARSING_ERROR with the real code in originalStatus; its
  // `error` text is the JSON parser's exception and must never reach the UI.
  const unparsable = error.status === 'PARSING_ERROR'
  const status = typeof error.originalStatus === 'number' ? error.originalStatus : (error.status ?? null)
  const { data } = error
  let message = ''

  if (typeof data === 'string') {
    const text = data.trim()
    if (text && !HTML.test(text)) message = text
  } else if (data && typeof data === 'object') {
    const base = [data.error, data.message].find((value) => typeof value === 'string' && value.trim())
    message = [base, data.details, data.hint]
      .filter((value) => typeof value === 'string' && value.trim())
      .join(' ')
    if (!message && Array.isArray(data.errors) && data.errors[0]?.msg) message = data.errors[0].msg
  }

  // The auth middleware answers a bare "Unauthorized"/"Unauthenticated" (text or
  // {error}); to the user that is an expired session, or a forbidden action on 403.
  if (/^(unauthenticated|unauthorized)\.?$/i.test(message)) {
    message = status === 403 ? FORBIDDEN : SESSION_EXPIRED
  }
  if (status === 401 && !message) message = SESSION_EXPIRED

  if (!message) {
    if (status === 'FETCH_ERROR') message = 'Cannot reach the server. Check your connection and try again.'
    else if (status === 'TIMEOUT_ERROR') message = 'The server took too long to answer. Please try again.'
    else if (status === 403) message = FORBIDDEN
    else if (status === 404) message = 'Not found.'
    else if (status === 413) message = 'That request is too large for the server. Try a smaller file.'
    else if (status === 429) message = 'Too many requests. Please wait a moment and try again.'
    else if (status === 502 || status === 503 || status === 504) {
      message = 'The service is temporarily unavailable. Please try again in a moment.'
    } else if (typeof status === 'number' && status >= 500) message = 'The server ran into a problem. Please try again.'
    else if (unparsable) message = 'The server returned an unexpected response.'
    else if (typeof error.message === 'string' && error.message) message = error.message
    else if (typeof error.error === 'string' && error.error) message = error.error
    else message = fallback
  }

  return { status, message }
}

/** The printable message only; see describeApiError. */
export function apiErrorMessage(error, fallback = FALLBACK) {
  return describeApiError(error, fallback).message
}

/** True for an authentication failure (missing, invalid or expired token). */
export const isUnauthorized = (error) => describeApiError(error).status === 401
