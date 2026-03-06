import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LandingPage from '../pages/LandingPage'

/**
 * Rota raiz (/): se o usuário estiver logado, redireciona para /home (dashboard).
 * Caso contrário, exibe a landing page pública.
 */
export default function RootOrRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/home" replace />
  }

  return <LandingPage />
}
