import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit'
import { api } from './api'
import authReducer, { loggedOut } from '../features/auth/authSlice'
import cartReducer from '../features/cart/cartSlice'
import uiReducer from '../features/ui/uiSlice'
import '../features' // registers every injected endpoint slice

// Cached orders, addresses and wishlists belong to the user who fetched them;
// dropping the whole API cache on sign-out keeps them from leaking to the next
// account that signs in on this tab. loggedOut is dispatched from inside the
// failing request's baseQuery on a 401, and resetApiState aborts every running
// query and mutation, that request included; waiting one macrotask lets it settle
// so its caller sees the real 401 instead of an AbortError ("Aborted").
const listener = createListenerMiddleware()
listener.startListening({
  actionCreator: loggedOut,
  effect: async (_action, { dispatch, delay }) => {
    await delay(0)
    dispatch(api.util.resetApiState())
  }
})

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
    cart: cartReducer,
    ui: uiReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: { ignoredActions: ['api/executeQuery/pending'] } })
      .prepend(listener.middleware)
      .concat(api.middleware),
  devTools: import.meta.env.DEV
})
