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
      window.location.replace('/')
      return
    }

    // Fluxo novo (server-driven): backend já setou cookie e redirecionou.
    // Se alguém cair aqui sem token, tentamos confirmar sessão e seguir.
    checkCurrentUser()
      .then(() => {
        window.location.replace('/')
      })
      .catch(() => {
        navigate('/login?error=invalid_callback', { replace: true })
      })
  }, [searchParams, navigate, setUserFromToken, checkCurrentUser])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner text="Processando login com Google..." />
    </div>
  )
}

export default GoogleCallbackPage

