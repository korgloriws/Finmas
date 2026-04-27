import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

const GoogleCallbackPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUserFromToken } = useAuth()
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

    if (!token || !username) {
      navigate('/login?error=invalid_callback', { replace: true })
      return
    }

    // Define o usuário a partir dos params da URL (síncrono).
    setUserFromToken(username, role || 'usuario')
    // IMPORTANTE: usar reload real aqui replica exatamente o cenário do F5,
    // que você confirmou funcionar. Isso elimina qualquer race de estado
    // no ciclo atual de render e garante que o app reinicie já autenticado.
    window.location.replace('/')
  }, [searchParams, navigate, setUserFromToken])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner text="Processando login com Google..." />
    </div>
  )
}

export default GoogleCallbackPage

