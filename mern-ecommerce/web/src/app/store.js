import { configureStore } from '@reduxjs/toolkit'
import { api } from './api'
import authReducer from '../features/auth/authSlice'
import cartReducer from '../features/cart/cartSlice'
import uiReducer from '../features/ui/uiSlice'
import '../features' // registers every injected endpoint slice

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
    cart: cartReducer,
    ui: uiReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: { ignoredActions: ['api/executeQuery/pending'] } }).concat(api.middleware),
  devTools: import.meta.env.DEV
})
