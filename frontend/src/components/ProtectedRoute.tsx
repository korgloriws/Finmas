import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Layout from './Layout'
import LoginRequiredBlock from './LoginRequiredBlock'

interface ProtectedRouteProps {
  children: ReactNode
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, canAccessScreen } = useAuth()
  const location = useLocation()
  const pathname = location.pathname

  if (!loading && !user) {
    return (
      <Layout>
        <LoginRequiredBlock />
      </Layout>
    )
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