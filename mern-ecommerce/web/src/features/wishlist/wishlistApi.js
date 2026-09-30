import { api } from '../../app/api'

export const wishlistApi = api.injectEndpoints({
  endpoints: (builder) => ({
    wishlist: builder.query({
      query: () => '/wishlist',
      providesTags: ['Wishlist']
    }),
    toggleWishlist: builder.mutation({
      query: ({ product, isLiked }) => ({ url: '/wishlist', method: 'POST', body: { product, isLiked } }),
      invalidatesTags: ['Wishlist']
    })
  })
})

export const { useWishlistQuery, useToggleWishlistMutation } = wishlistApi
