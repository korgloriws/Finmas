import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

const GoogleCallbackPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUserFromToken, checkCurrentUser } = useAuth()

  useEffect(() => {
    const token = searchParams.get('token')
    const username = searchParams.get('username')
    const role = searchParams.get('role')
    const error = searchParams.get('error')

    if (error) {
      // Se houver erro, redirecionar para login com mensagem
      navigate('/login?error=google_auth_failed')
      return
    }

    if (token && username) {
      setUserFromToken(username, role || 'usuario')
      checkCurrentUser().then(() => navigate('/', { replace: true }))
    } else {
      // Se não houver token, redirecionar para login
      navigate('/login?error=invalid_callback')
    }
  }, [searchParams, navigate, setUserFromToken, checkCurrentUser])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner text="Processando login com Google..." />
    </div>
  )
}

export default GoogleCallbackPage

