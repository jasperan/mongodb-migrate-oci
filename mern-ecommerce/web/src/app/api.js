import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { loggedOut } from '../features/auth/authSlice'

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
const baseQuery = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions)
  if (result.error?.status === 401) {
    api.dispatch(loggedOut())
  }
  return result
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Product', 'Brand', 'Category', 'Cart', 'Order', 'Wishlist', 'Review', 'User', 'Merchant', 'Address', 'Contact', 'Newsletter', 'Chat', 'Database'],
  endpoints: () => ({})
})
