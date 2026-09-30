import { createSlice } from '@reduxjs/toolkit'

const STORAGE_KEY = 'mern26.auth'

const readStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { token: null, user: null }
  } catch {
    return { token: null, user: null }
  }
}

const persist = (state) => {
  try {
    if (state.token) localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: state.token, user: state.user }))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable (private mode) — session-only auth */
  }
}

const initialState = { ...readStored(), status: 'idle', error: null }

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsReceived(state, action) {
      state.token = action.payload.token
      state.user = action.payload.user
      state.error = null
      persist(state)
    },
    loggedOut(state) {
      state.token = null
      state.user = null
      state.error = null
      persist(state)
    },
    profileReceived(state, action) {
      state.user = { ...state.user, ...action.payload }
      persist(state)
    },
    authFailed(state, action) {
      state.error = action.payload || 'Request failed'
    },
    clearAuthError(state) {
      state.error = null
    }
  }
})

export const { credentialsReceived, loggedOut, profileReceived, authFailed, clearAuthError } = authSlice.actions
export const selectAuth = (state) => state.auth
export const selectIsAuthenticated = (state) => Boolean(state.auth.token)
export const selectRole = (state) => state.auth.user?.role || null
export default authSlice.reducer
