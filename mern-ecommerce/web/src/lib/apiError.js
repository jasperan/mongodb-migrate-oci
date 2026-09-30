/**
 * Redux Toolkit Query wraps non-2xx responses as `{ status, data }`. The Express
 * API replies with `{ error }`, `{ message }`, a validation envelope, or plain
 * text for 401/403; the fetch layer adds `FETCH_ERROR`/`PARSING_ERROR`. Collapse
 * all of those into one string so every screen prints the server's own words
 * instead of `[object Object]` or a bare status code.
 */
export function apiErrorMessage(error, fallback = 'Your request could not be processed. Please try again.') {
  if (!error) return fallback
  const { data } = error

  if (typeof data === 'string' && data.trim()) {
    const text = data.trim()
    if (/^unauthenticated$/i.test(text)) return 'Your session has expired. Please sign in again.'
    if (/^unauthorized$/i.test(text)) return 'You are not authorised to make this request.'
    return text
  }

  if (data && typeof data === 'object') {
    if (typeof data.error === 'string' && data.error.trim()) return data.error
    if (typeof data.message === 'string' && data.message.trim()) return data.message
    if (Array.isArray(data.errors) && data.errors[0]?.msg) return data.errors[0].msg
  }

  if (error.status === 'FETCH_ERROR') return 'Cannot reach the server. Check your connection and try again.'
  if (error.status === 'PARSING_ERROR') return 'The server returned an unexpected response.'
  if (error.status === 401) return 'Your session has expired. Please sign in again.'
  if (error.status === 403) return 'You are not allowed to make this request.'
  return fallback
}
