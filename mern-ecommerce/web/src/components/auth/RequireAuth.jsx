import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { selectIsAuthenticated, selectRole } from '../../features/auth/authSlice'
import { toastShown } from '../../features/ui/uiSlice'

function Forbidden() {
  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(toastShown({ type: 'error', message: 'You do not have access to that page.' }))
  }, [dispatch])
  return <Navigate to="/dashboard" replace />
}

// Client-side guard: visitors without a session go to /login and come back to the
// full URL they asked for; a signed-in user without the required role is sent
// back to their dashboard with an explanation.
export function RequireAuth({ roles }) {
  const authenticated = useSelector(selectIsAuthenticated)
  const role = useSelector(selectRole)
  const location = useLocation()

  if (!authenticated) {
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/login" state={{ from }} replace />
  }
  if (roles && role && !roles.includes(role)) return <Forbidden />
  return <Outlet />
}
