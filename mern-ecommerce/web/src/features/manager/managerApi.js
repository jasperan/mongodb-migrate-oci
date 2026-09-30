import { api } from '../../app/api'

// Manager surface: everything the admin/merchant dashboard needs. Endpoints are
// grouped here (rather than per entity) because most manager screens cross-read
// several entities at once (e.g. product form needs category + brand options).
export const managerApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // ---- users (admin) -----------------------------------------------------
    users: builder.query({
      query: ({ page = 1, limit = 10 } = {}) => ({ url: '/user', params: { page, limit } }),
      providesTags: ['User']
    }),
    searchUsers: builder.query({
      query: (search) => ({ url: '/user/search', params: { search } }),
      providesTags: ['User']
    }),

    // ---- merchants (admin) -------------------------------------------------
    merchants: builder.query({
      query: ({ page = 1, limit = 10 } = {}) => ({ url: '/merchant', params: { page, limit } }),
      providesTags: ['Merchant']
    }),
    searchMerchants: builder.query({
      query: (search) => ({ url: '/merchant/search', params: { search } }),
      providesTags: ['Merchant']
    }),
    applyMerchant: builder.mutation({
      query: (merchant) => ({ url: '/merchant/add', method: 'POST', body: merchant }),
      invalidatesTags: ['Merchant']
    }),
    approveMerchant: builder.mutation({
      query: (id) => ({ url: `/merchant/approve/${id}`, method: 'PUT' }),
      invalidatesTags: ['Merchant', 'Brand', 'User']
    }),
    rejectMerchant: builder.mutation({
      query: (id) => ({ url: `/merchant/reject/${id}`, method: 'PUT' }),
      invalidatesTags: ['Merchant']
    }),
    setMerchantActive: builder.mutation({
      query: ({ id, isActive }) => ({ url: `/merchant/${id}/active`, method: 'PUT', body: { merchant: { isActive } } }),
      invalidatesTags: ['Merchant']
    }),
    deleteMerchant: builder.mutation({
      query: (id) => ({ url: `/merchant/delete/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Merchant', 'Brand']
    }),
    merchantSignup: builder.mutation({
      query: ({ token, ...body }) => ({ url: `/merchant/signup/${token}`, method: 'POST', body })
    }),

    // ---- brands ------------------------------------------------------------
    managerBrands: builder.query({
      query: () => '/brand',
      providesTags: ['Brand']
    }),
    addBrand: builder.mutation({
      query: (brand) => ({ url: '/brand/add', method: 'POST', body: { brand } }),
      invalidatesTags: ['Brand']
    }),
    updateBrand: builder.mutation({
      query: ({ id, brand }) => ({ url: `/brand/${id}`, method: 'PUT', body: { brand } }),
      invalidatesTags: ['Brand']
    }),
    setBrandActive: builder.mutation({
      query: ({ id, isActive }) => ({ url: `/brand/${id}/active`, method: 'PUT', body: { brand: { isActive } } }),
      invalidatesTags: ['Brand', 'Product']
    }),
    deleteBrand: builder.mutation({
      query: (id) => ({ url: `/brand/delete/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Brand']
    }),

    // ---- categories --------------------------------------------------------
    addCategory: builder.mutation({
      query: (category) => ({ url: '/category/add', method: 'POST', body: category }),
      invalidatesTags: ['Category']
    }),
    updateCategory: builder.mutation({
      query: ({ id, category }) => ({ url: `/category/${id}`, method: 'PUT', body: { category } }),
      invalidatesTags: ['Category']
    }),
    setCategoryActive: builder.mutation({
      query: ({ id, isActive }) => ({ url: `/category/${id}/active`, method: 'PUT', body: { category: { isActive } } }),
      invalidatesTags: ['Category', 'Product']
    }),
    deleteCategory: builder.mutation({
      query: (id) => ({ url: `/category/delete/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Category']
    }),

    // ---- products (manager) ------------------------------------------------
    managerProducts: builder.query({
      query: () => '/product',
      providesTags: ['Product']
    }),
    managerProduct: builder.query({
      query: (id) => `/product/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Product', id }]
    }),
    createProduct: builder.mutation({
      // multipart/form-data: the route expects an optional `image` file plus the fields
      query: ({ image, ...fields }) => {
        const body = new FormData()
        Object.entries(fields).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') body.append(key, value)
        })
        if (image) body.append('image', image)
        return { url: '/product/add', method: 'POST', body }
      },
      invalidatesTags: ['Product']
    }),
    updateProduct: builder.mutation({
      query: ({ id, product }) => ({ url: `/product/${id}`, method: 'PUT', body: { product } }),
      invalidatesTags: ['Product']
    }),
    setProductActive: builder.mutation({
      query: ({ id, isActive }) => ({ url: `/product/${id}/active`, method: 'PUT', body: { product: { isActive } } }),
      invalidatesTags: ['Product']
    }),
    deleteProduct: builder.mutation({
      query: (id) => ({ url: `/product/delete/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Product']
    }),

    // ---- customer messages -------------------------------------------------
    sendContactMessage: builder.mutation({
      query: (message) => ({ url: '/contact/add', method: 'POST', body: message }),
      invalidatesTags: ['Contact']
    }),
    subscribeNewsletter: builder.mutation({
      query: (email) => ({ url: '/newsletter/subscribe', method: 'POST', body: { email } }),
      invalidatesTags: ['Newsletter']
    })
  })
})

export const {
  useUsersQuery,
  useSearchUsersQuery,
  useMerchantsQuery,
  useSearchMerchantsQuery,
  useApplyMerchantMutation,
  useApproveMerchantMutation,
  useRejectMerchantMutation,
  useSetMerchantActiveMutation,
  useDeleteMerchantMutation,
  useMerchantSignupMutation,
  useManagerBrandsQuery,
  useAddBrandMutation,
  useUpdateBrandMutation,
  useSetBrandActiveMutation,
  useDeleteBrandMutation,
  useAddCategoryMutation,
  useUpdateCategoryMutation,
  useSetCategoryActiveMutation,
  useDeleteCategoryMutation,
  useManagerProductsQuery,
  useManagerProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useSetProductActiveMutation,
  useDeleteProductMutation,
  useSendContactMessageMutation,
  useSubscribeNewsletterMutation
} = managerApi
