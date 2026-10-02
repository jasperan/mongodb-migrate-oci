import { api } from '../../app/api'
import { credentialsReceived, profileReceived } from './authSlice'

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (data?.token) dispatch(credentialsReceived({ token: data.token, user: data.user }))
        } catch {
          /* handled by the caller */
        }
      },
      invalidatesTags: ['User', 'Cart', 'Wishlist']
    }),
    register: builder.mutation({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (data?.token) dispatch(credentialsReceived({ token: data.token, user: data.user }))
        } catch {
          /* handled by the caller */
        }
      },
      invalidatesTags: ['User']
    }),
    forgotPassword: builder.mutation({
      query: (body) => ({ url: '/auth/forgot', method: 'POST', body })
    }),
    resetPassword: builder.mutation({
      // token comes from the reset e-mail link
      query: ({ token, ...body }) => ({ url: `/auth/reset/${token}`, method: 'POST', body })
    }),
    changePassword: builder.mutation({
      // POST /auth/reset expects the CURRENT password plus the new one
      query: (body) => ({ url: '/auth/reset', method: 'POST', body })
    }),
    profile: builder.query({
      query: () => '/user/me',
      // The stored user only knows what the login response carried; whenever the
      // server's view arrives (app start, dashboard) it replaces role/merchant data.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (data?.user) dispatch(profileReceived(data.user))
        } catch {
          /* a 401 is handled by the base query; other errors keep the stored user */
        }
      },
      providesTags: ['User']
    }),
    updateProfile: builder.mutation({
      query: (profile) => ({ url: '/user', method: 'PUT', body: { profile } }),
      invalidatesTags: ['User']
    })
  })
})

export const {
  useLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useProfileQuery,
  useUpdateProfileMutation
} = authApi
