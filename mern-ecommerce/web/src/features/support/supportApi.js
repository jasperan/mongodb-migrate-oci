import { api } from '../../app/api'

// Support surfaces: the RAG chat, the database showcase endpoints and the
// socket-backed support chat (which is not an HTTP endpoint).
export const supportApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // RAG chat: POST /api/chat {message} -> {response}
    chat: builder.mutation({
      query: (message) => ({ url: '/chat', method: 'POST', body: { message } })
    }),

    // Migration showcase: MongoDB API collections vs Oracle JSON collections
    mongoCollections: builder.query({
      query: () => '/admin-db/collections/mongo',
      providesTags: ['Database']
    }),
    mongoCollectionCount: builder.query({
      query: (name) => `/admin-db/collections/mongo/${name}/count`,
      providesTags: ['Database']
    }),
    oracleCollections: builder.query({
      query: () => '/admin-db/collections/oracle',
      providesTags: ['Database']
    }),
    oracleCollectionCount: builder.query({
      query: (name) => `/admin-db/collections/oracle/${name}/count`,
      providesTags: ['Database']
    }),

    // 26ai surfaces: relational views, duality views, JSON validity
    databaseViews: builder.query({
      query: () => '/admin-db/views',
      providesTags: ['Database']
    }),
    dualityViews: builder.query({
      query: () => '/admin-db/duality-views',
      providesTags: ['Database']
    }),
    validityReport: builder.query({
      query: () => '/admin-db/validity',
      providesTags: ['Database']
    }),
    migrationStatus: builder.query({
      query: () => '/admin-db/migration-status',
      providesTags: ['Database']
    }),

    // In-database AI: vector similarity over the migrated documents
    similarProducts: builder.mutation({
      query: (text) => ({ url: '/ai/similar', method: 'POST', body: { text } })
    }),
    // Select AI: natural language over the relational views
    askDatabase: builder.mutation({
      query: (question) => ({ url: '/ai/ask', method: 'POST', body: { question } })
    })
  })
})

export const {
  useChatMutation,
  useMongoCollectionsQuery,
  useMongoCollectionCountQuery,
  useOracleCollectionsQuery,
  useOracleCollectionCountQuery,
  useDatabaseViewsQuery,
  useDualityViewsQuery,
  useValidityReportQuery,
  useMigrationStatusQuery,
  useSimilarProductsMutation,
  useAskDatabaseMutation
} = supportApi
