import { api } from '../../app/api'

export const orderApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // One call reserves stock, prices every line on the server and creates the order.
    checkout: builder.mutation({
      query: (products) => ({ url: '/order/checkout', method: 'POST', body: { products } }),
      invalidatesTags: ['Order', 'Product', 'Cart']
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
      // A 409 ORDER_DISPATCHED means the cached order is stale (a line has shipped), so refetch it too.
      invalidatesTags: (_result, error) =>
        !error || error.data?.code === 'ORDER_DISPATCHED' ? ['Order', 'Product'] : []
    }),
    // The server derives the order and cart from the item; cancelling the last
    // line deletes the order and answers `orderCancelled: true`.
    updateOrderItemStatus: builder.mutation({
      query: ({ itemId, status }) => ({
        url: `/order/status/item/${itemId}`,
        method: 'PUT',
        body: { status }
      }),
      // a 409 means the cached lines are stale (e.g. the line was already cancelled)
      invalidatesTags: (_result, error) => (!error || error.status === 409 ? ['Order', 'Cart', 'Product'] : [])
    })
  })
})

export const {
  useCheckoutMutation,
  useMyOrdersQuery,
  useSearchOrdersQuery,
  useOrdersQuery,
  useOrderByIdQuery,
  useCancelOrderMutation,
  useUpdateOrderItemStatusMutation
} = orderApi
