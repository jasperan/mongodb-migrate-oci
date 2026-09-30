import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsAuthenticated, selectRole } from '../../features/auth/authSlice'

// Client-side guard mirroring the legacy Authentication HOC: unauthenticated
// visitors are sent to /login, role mismatches to /404.
export function RequireAuth({ roles }) {
  const authenticated = useSelector(selectIsAuthenticated)
  const role = useSelector(selectRole)
  const location = useLocation()

  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (roles && role && !roles.includes(role)) {
    return <Navigate to="/404" replace />
  }
  return <Outlet />
}
