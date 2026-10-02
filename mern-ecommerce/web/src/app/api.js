import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { loggedOut } from '../features/auth/authSlice'
import { toastShown } from '../features/ui/uiSlice'
import { SESSION_EXPIRED, isUnauthorized } from '../lib/apiError'

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const { token } = getState().auth
    if (token) headers.set('authorization', token)
    return headers
  }
})

// A stale/expired token must not leave the app in a half-authenticated state.
// isUnauthorized also recognises passport's plain-text 401 (PARSING_ERROR with
// originalStatus 401). Only a request that carried a token means "session
// expired" (a wrong password on /auth/login is a 401 too), and the token check
// also makes concurrent 401s toast once: the first one clears the token.
const baseQuery = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions)
  if (result.error && isUnauthorized(result.error) && api.getState().auth.token) {
    api.dispatch(loggedOut())
    api.dispatch(toastShown({ type: 'info', message: SESSION_EXPIRED }))
  }
  return result
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Product', 'Brand', 'Category', 'Cart', 'Order', 'Wishlist', 'Review', 'User', 'Merchant', 'Address', 'Contact', 'Newsletter', 'Chat', 'Database'],
  endpoints: () => ({})
})
