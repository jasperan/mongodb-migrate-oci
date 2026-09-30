import { api } from '../../app/api'

export const catalogApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Storefront catalogue. The API needs an explicit price window: the
    // aggregation matches on {min,max} and returns no rows when they are absent.
    products: builder.query({
      query: ({ min = 1, max = 5000, rating = 1, category, brand, page = 1, limit = 9, sortOrder = { created: -1 } }) => ({
        url: '/product/list',
        params: {
          min,
          max,
          rating,
          page,
          limit,
          sortOrder: JSON.stringify(sortOrder),
          ...(category ? { category } : {}),
          ...(brand ? { brand } : {})
        }
      }),
      providesTags: (_result, _error, arg) => [{ type: 'Product', id: `list-${JSON.stringify(arg)}` }]
    }),
    productBySlug: builder.query({
      query: (slug) => `/product/item/${slug}`,
      providesTags: (_result, _error, slug) => [{ type: 'Product', id: slug }]
    }),
    searchProducts: builder.query({
      query: (name) => `/product/list/search/${encodeURIComponent(name)}`,
      providesTags: ['Product']
    }),
    productOptions: builder.query({
      query: () => '/product/list/select',
      providesTags: ['Product']
    }),
    storeBrands: builder.query({
      query: () => '/brand/list',
      providesTags: ['Brand']
    }),
    brandById: builder.query({
      query: (id) => `/brand/${id}`,
      providesTags: ['Brand']
    }),
    brandOptions: builder.query({
      query: () => '/brand/list/select',
      providesTags: ['Brand']
    }),
    storeCategories: builder.query({
      query: () => '/category/list',
      providesTags: ['Category']
    }),
    allCategories: builder.query({
      query: () => '/category',
      providesTags: ['Category']
    }),
    categoryById: builder.query({
      query: (id) => `/category/${id}`,
      providesTags: ['Category']
    })
  })
})

export const {
  useProductsQuery,
  useProductBySlugQuery,
  useSearchProductsQuery,
  useProductOptionsQuery,
  useStoreBrandsQuery,
  useBrandByIdQuery,
  useBrandOptionsQuery,
  useStoreCategoriesQuery,
  useAllCategoriesQuery,
  useCategoryByIdQuery
} = catalogApi
