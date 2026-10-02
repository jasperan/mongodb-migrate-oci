import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/space-grotesk/wght.css'
import { store } from './app/store'
import { authApi } from './features/auth/authApi'
import { router } from './routes'
import './index.css'

// A stored token may outlive the account or its role; ask the server who we are
// instead of trusting what localStorage remembered.
if (store.getState().auth.token) store.dispatch(authApi.endpoints.profile.initiate(undefined, { forceRefetch: true }))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>
)
