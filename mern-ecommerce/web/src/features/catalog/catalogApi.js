import { api } from '../../app/api'

export const catalogApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Storefront catalogue. `rating: 0` keeps unreviewed products in the list; `min`/`max`
    // are only sent when set, and `name` is a case-insensitive match over the whole catalogue.
    products: builder.query({
      query: ({ name, min, max, rating = 0, category, brand, page = 1, limit = 9, sortOrder = { created: -1 } }) => ({
        url: '/product/list',
        params: {
          rating,
          page,
          limit,
          sortOrder: JSON.stringify(sortOrder),
          ...(name ? { name } : {}),
          ...(min !== undefined && min !== null ? { min } : {}),
          ...(max !== undefined && max !== null ? { max } : {}),
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
    })
  })
})

export const {
  useProductsQuery,
  useProductBySlugQuery,
  useSearchProductsQuery,
  useProductOptionsQuery,
  useStoreBrandsQuery,
  useBrandOptionsQuery,
  useStoreCategoriesQuery,
  useAllCategoriesQuery
} = catalogApi
