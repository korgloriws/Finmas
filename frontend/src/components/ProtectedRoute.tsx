import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, canAccessScreen } = useAuth()
  const location = useLocation()
  const pathname = location.pathname

  if (!loading && !user) {
    return <Navigate to="/login" replace />
  }


  if (pathname === '/acesso-negado') {
    return <>{children}</>
  }


  if (!loading && user && !canAccessScreen(pathname)) {
    return <Navigate to="/acesso-negado" state={{ from: pathname }} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute 