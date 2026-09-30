import { api } from '../../app/api'

// Cart persistence is server-side only at checkout time: POST /cart/add creates a
// cart document from the client-side line items (see cartSlice.toCartPayload).
export const cartApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createCart: builder.mutation({
      query: (products) => ({ url: '/cart/add', method: 'POST', body: { products } }),
      invalidatesTags: ['Cart', 'Product']
    }),
    appendToCart: builder.mutation({
      query: ({ cartId, product }) => ({ url: `/cart/add/${cartId}`, method: 'POST', body: { product } }),
      invalidatesTags: ['Cart']
    }),
    deleteCart: builder.mutation({
      query: (cartId) => ({ url: `/cart/delete/${cartId}`, method: 'DELETE' }),
      invalidatesTags: ['Cart']
    }),
    removeCartItem: builder.mutation({
      query: ({ cartId, productId }) => ({ url: `/cart/delete/${cartId}/${productId}`, method: 'DELETE' }),
      invalidatesTags: ['Cart']
    })
  })
})

export const { useCreateCartMutation, useAppendToCartMutation, useDeleteCartMutation, useRemoveCartItemMutation } =
  cartApi
