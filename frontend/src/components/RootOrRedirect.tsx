import { useAuth } from '../contexts/AuthContext'
import LandingPage from '../pages/LandingPage'
import ProtectedRoute from './ProtectedRoute'
import SecurityCheck from './SecurityCheck'
import Layout from './Layout'
import HomePage from '../pages/HomePage'

/**
 * Rota raiz (/): entrada do sistema em finmas.com.br.
 * Se o usuário estiver logado, exibe o dashboard em / (sem redirecionar para /home).
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
    return (
      <ProtectedRoute>
        <SecurityCheck>
          <Layout>
            <HomePage />
          </Layout>
        </SecurityCheck>
      </ProtectedRoute>
    )
  }

  return <LandingPage />
}
