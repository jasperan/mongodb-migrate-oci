import { api } from '../../app/api'

// Database showcase panels share one cache entry per endpoint. The query argument
// is a refresh counter: raising it re-requests the endpoint with `?fresh=1`, which
// skips the server's 15 s cache (the point of the Refresh buttons after a live
// write). The argument is left out of the cache key so `data` stays on screen
// while the refresh is in flight.
const databasePanel = (path) => ({
  query: (refresh = 0) => ({ url: `/admin-db/${path}`, params: refresh ? { fresh: 1 } : undefined }),
  serializeQueryArgs: ({ endpointName }) => endpointName,
  forceRefetch: ({ currentArg, previousArg }) => currentArg !== previousArg,
  providesTags: ['Database']
})

// Support surfaces: the RAG chat, the database showcase endpoints and the
// socket-backed support chat (which is not an HTTP endpoint).
export const supportApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // RAG chat: POST /api/chat { message, history? } -> { response, model, retrieval }
    chat: builder.mutation({
      query: ({ message, history }) => ({ url: '/chat', method: 'POST', body: { message, history } })
    }),
    // Which AI capabilities the server has configured: { llm, embeddings, selectAi }
    aiStatus: builder.query({
      query: () => '/ai/status'
    }),

    // Migration showcase: MongoDB API collections vs Oracle JSON collections,
    // each with its document count, in one request
    collections: builder.query(databasePanel('collections')),

    // 26ai surfaces: relational views, duality views, JSON validity
    databaseViews: builder.query(databasePanel('views')),
    dualityViews: builder.query(databasePanel('duality-views')),
    validityReport: builder.query(databasePanel('validity')),
    migrationStatus: builder.query(databasePanel('migration-status')),

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
  useAiStatusQuery,
  useCollectionsQuery,
  useDatabaseViewsQuery,
  useDualityViewsQuery,
  useValidityReportQuery,
  useMigrationStatusQuery,
  useSimilarProductsMutation,
  useAskDatabaseMutation
} = supportApi
