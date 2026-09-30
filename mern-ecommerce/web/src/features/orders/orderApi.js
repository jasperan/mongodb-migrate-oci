import { api } from '../../app/api'

export const orderApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createOrder: builder.mutation({
      query: (cartId) => ({ url: '/order/add', method: 'POST', body: { cartId } }),
      invalidatesTags: ['Order', 'Product']
    }),
    myOrders: builder.query({
      query: ({ page = 1, limit = 10 } = {}) => ({ url: '/order/me', params: { page, limit } }),
      providesTags: ['Order']
    }),
    searchOrders: builder.query({
      query: (search) => ({ url: '/order/search', params: { search } }),
      providesTags: ['Order']
    }),
    orders: builder.query({
      query: ({ page = 1, limit = 10 } = {}) => ({ url: '/order', params: { page, limit } }),
      providesTags: ['Order']
    }),
    orderById: builder.query({
      query: (orderId) => `/order/${orderId}`,
      providesTags: (_result, _error, orderId) => [{ type: 'Order', id: orderId }]
    }),
    cancelOrder: builder.mutation({
      query: (orderId) => ({ url: `/order/cancel/${orderId}`, method: 'DELETE' }),
      invalidatesTags: ['Order', 'Product']
    }),
    updateOrderItemStatus: builder.mutation({
      // the route reads orderId, cartId and status; cartId drives the all-items-cancelled auto-cancel
      query: ({ itemId, orderId, cartId, status }) => ({
        url: `/order/status/item/${itemId}`,
        method: 'PUT',
        body: { orderId, cartId, status }
      }),
      invalidatesTags: ['Order', 'Cart', 'Product']
    })
  })
})

export const {
  useCreateOrderMutation,
  useMyOrdersQuery,
  useSearchOrdersQuery,
  useOrdersQuery,
  useOrderByIdQuery,
  useCancelOrderMutation,
  useUpdateOrderItemStatusMutation
} = orderApi
