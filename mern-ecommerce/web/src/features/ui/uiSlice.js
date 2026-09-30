import { createSlice, nanoid } from '@reduxjs/toolkit'

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    toasts: [],
    cartOpen: false,
    searchOpen: false
  },
  reducers: {
    toastShown: {
      reducer(state, action) {
        state.toasts.push(action.payload)
      },
      prepare({ type = 'info', message, ttl = 4000 }) {
        return { payload: { id: nanoid(), type, message, ttl } }
      }
    },
    toastDismissed(state, action) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload)
    },
    cartToggled(state, action) {
      state.cartOpen = action.payload ?? !state.cartOpen
    },
    searchToggled(state, action) {
      state.searchOpen = action.payload ?? !state.searchOpen
    }
  }
})

export const { toastShown, toastDismissed, cartToggled, searchToggled } = uiSlice.actions
export const selectToasts = (state) => state.ui.toasts
export default uiSlice.reducer
