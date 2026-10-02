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
    }),
    removeWishlistEntry: builder.mutation({
      query: (entryId) => ({ url: `/wishlist/${entryId}`, method: 'DELETE' }),
      invalidatesTags: ['Wishlist']
    })
  })
})

export const { useWishlistQuery, useToggleWishlistMutation, useRemoveWishlistEntryMutation } = wishlistApi
