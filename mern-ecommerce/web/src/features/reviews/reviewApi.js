import { api } from '../../app/api'

export const reviewApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // approved reviews for one product slug (storefront)
    productReviews: builder.query({
      query: (slug) => `/review/${slug}`,
      providesTags: (_result, _error, slug) => [{ type: 'Review', id: slug }]
    }),
    addReview: builder.mutation({
      // Review model fields: product, title, rating, review, isRecommended
      query: ({ product, title, rating, review, isRecommended }) => ({
        url: '/review/add',
        method: 'POST',
        body: { product, title, rating, review, isRecommended }
      }),
      invalidatesTags: ['Review', 'Product']
    }),
    reviews: builder.query({
      query: ({ page = 1, limit = 10 } = {}) => ({ url: '/review', params: { page, limit } }),
      providesTags: ['Review']
    }),
    approveReview: builder.mutation({
      query: (reviewId) => ({ url: `/review/approve/${reviewId}`, method: 'PUT' }),
      invalidatesTags: ['Review', 'Product']
    }),
    rejectReview: builder.mutation({
      query: (reviewId) => ({ url: `/review/reject/${reviewId}`, method: 'PUT' }),
      invalidatesTags: ['Review', 'Product']
    }),
    deleteReview: builder.mutation({
      query: (id) => ({ url: `/review/delete/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Review', 'Product']
    })
  })
})

export const {
  useProductReviewsQuery,
  useAddReviewMutation,
  useReviewsQuery,
  useApproveReviewMutation,
  useRejectReviewMutation,
  useDeleteReviewMutation
} = reviewApi
