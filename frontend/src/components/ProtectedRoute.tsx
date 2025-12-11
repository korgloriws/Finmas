import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth()

  // PERFORMANCE: Não bloquear renderização - verificar apenas se não há user
  // O loading do AuthContext não deve bloquear navegação
  // Se não houver user após um tempo curto, redirecionar
  if (!loading && !user) {
    return <Navigate to="/login" replace />
  }

  // Renderizar página imediatamente, mesmo se ainda estiver carregando
  // O AuthContext vai atualizar o estado em background
  return <>{children}</>
}

export default ProtectedRoute 