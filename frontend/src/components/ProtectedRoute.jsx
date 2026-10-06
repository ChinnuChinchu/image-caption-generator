import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Spinner from './Spinner.jsx'

// Wraps pages that need a logged-in user (like Django's @login_required)
export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-brand-dark" role="status">
        <Spinner className="h-8 w-8" />
        <span className="sr-only">Loading</span>
      </div>
    )
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />
}