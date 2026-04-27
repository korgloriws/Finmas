import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

const GoogleCallbackPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUserFromToken, checkCurrentUser } = useAuth()
  // Garante execução única mesmo se o useEffect re-disparar por mudança de deps
  // (setUserFromToken não é memoizado e causa re-runs em loop sem essa guard).
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (hasRunRef.current) return
    hasRunRef.current = true

    const token = searchParams.get('token')
    const username = searchParams.get('username')
    const role = searchParams.get('role')
    const error = searchParams.get('error')

    if (error) {
      navigate('/login?error=google_auth_failed', { replace: true })
      return
    }

    // Compatibilidade com callback antigo (token na URL).
    if (token && username) {
      setUserFromToken(username, role || 'usuario')
      navigate('/', { replace: true })
      return
    }

    // Fluxo server-driven: backend já setou cookie e redirecionou para esta rota.
    // Alguns navegadores/proxies podem atrasar o primeiro request autenticado;
    // por isso, fazemos retries curtos antes de concluir falha.
    const run = async () => {
      for (let i = 0; i < 8; i += 1) {
        const authenticated = await checkCurrentUser()
        if (authenticated) {
          navigate('/', { replace: true })
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
      navigate('/login?error=google_auth_failed', { replace: true })
    }

    run()
  }, [searchParams, navigate, setUserFromToken, checkCurrentUser])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner text="Processando login com Google..." />
    </div>
  )
}

export default GoogleCallbackPage

