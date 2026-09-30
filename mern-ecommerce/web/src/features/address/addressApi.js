import { api } from '../../app/api'

export const addressApi = api.injectEndpoints({
  endpoints: (builder) => ({
    addresses: builder.query({
      query: () => '/address',
      providesTags: ['Address']
    }),
    addAddress: builder.mutation({
      query: (address) => ({ url: '/address/add', method: 'POST', body: address }),
      invalidatesTags: ['Address']
    }),
    updateAddress: builder.mutation({
      query: ({ id, ...address }) => ({ url: `/address/${id}`, method: 'PUT', body: address }),
      invalidatesTags: ['Address']
    }),
    deleteAddress: builder.mutation({
      query: (id) => ({ url: `/address/delete/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Address']
    })
  })
})

export const { useAddressesQuery, useAddAddressMutation, useUpdateAddressMutation, useDeleteAddressMutation } =
  addressApi
