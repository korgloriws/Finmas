import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

const GoogleCallbackPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { checkCurrentUser } = useAuth()
  // Garante execução única mesmo se o useEffect re-disparar por mudança de deps.
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (hasRunRef.current) return
    hasRunRef.current = true

    const error = searchParams.get('error')

    if (error) {
      navigate('/login?error=google_auth_failed', { replace: true })
      return
    }

    // Fluxo unificado: backend já setou cookie de sessão, igual ao login normal.
    // Fazemos retries curtos apenas para tolerar atraso transitório no primeiro request.
    const run = async () => {
      for (let i = 0; i < 8; i += 1) {
        const authenticated = await checkCurrentUser()
        if (authenticated) {
          navigate('/home', { replace: true })
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
      navigate('/login?error=google_auth_failed', { replace: true })
    }

    run()
  }, [searchParams, navigate, checkCurrentUser])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner text="Processando login com Google..." />
    </div>
  )
}

export default GoogleCallbackPage

