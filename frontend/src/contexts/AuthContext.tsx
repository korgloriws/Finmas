import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

interface AuthContextType {
  user: string | null
  userRole: 'usuario' | 'admin' | null
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  register: (nome: string, username: string, password: string, pergunta_seguranca?: string, resposta_seguranca?: string) => Promise<void>
  logout: () => Promise<void>
  obterPergunta: (username: string) => Promise<string>
  verificarResposta: (username: string, resposta: string) => Promise<boolean>
  redefinirSenha: (username: string, novaSenha: string) => Promise<void>
  atualizarPergunta: (username: string, pergunta: string, resposta: string) => Promise<void>
  verificarPergunta: (username: string) => Promise<{tem_pergunta: boolean, pergunta?: string}>
  setUserFromToken: (username: string, role: string) => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'usuario' | 'admin' | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  
  const isAdmin = userRole === 'admin'

  
  useEffect(() => {
    checkCurrentUser()
  }, [])

  // Revalidar usuário em foco/visibilidade e sincronizar entre abas
  useEffect(() => {
    const onFocus = () => {
      checkCurrentUser()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkCurrentUser()
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'finmas_user') {
        checkCurrentUser()
      }
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const checkCurrentUser = async () => {
    try {
      const response = await api.get('/auth/usuario-atual')
      if (response.data.username) {
        setUser(response.data.username)
        setUserRole(response.data.role || 'usuario')
      } else {
        setUser(null)
        setUserRole(null)
      }
    } catch (error) {
      setUser(null)
      setUserRole(null)
    } finally {
      setLoading(false)
    }
  }

  // Sincronizar usuário esperado no localStorage para ser enviado ao backend
  useEffect(() => {
    try {
      if (user) {
        window.localStorage.setItem('finmas_user', user)
      } else {
        window.localStorage.removeItem('finmas_user')
      }
    } catch {
      /* ignore */
    }
  }, [user])

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post('/auth/login', {
        username,
        senha: password
      })
      
      if (response.data.username) {
        setUser(response.data.username)
        setUserRole(response.data.role || 'usuario')
      } else {
        throw new Error('Erro no login')
      }
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao fazer login')
    }
  }

  const register = async (nome: string, username: string, password: string, pergunta_seguranca?: string, resposta_seguranca?: string) => {
    try {
      const response = await api.post('/auth/registro', {
        nome,
        username,
        senha: password,
        pergunta_seguranca,
        resposta_seguranca
      })
      
      if (response.status === 201) {

        setUser(null)
        navigate('/login', { replace: true })
      } else {
        throw new Error('Erro no registro')
      }
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao fazer registro')
    }
  }

  const obterPergunta = async (username: string) => {
    try {
      const response = await api.post('/auth/obter-pergunta', { username })
      return response.data.pergunta
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao obter pergunta de segurança')
    }
  }

  const verificarResposta = async (username: string, resposta: string) => {
    try {
      await api.post('/auth/verificar-resposta', { username, resposta })
      return true
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao verificar resposta')
    }
  }

  const redefinirSenha = async (username: string, novaSenha: string) => {
    try {
      await api.post('/auth/redefinir-senha', { username, nova_senha: novaSenha })
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao redefinir senha')
    }
  }

  const atualizarPergunta = async (username: string, pergunta: string, resposta: string) => {
    try {
      await api.post('/auth/atualizar-pergunta', { username, pergunta, resposta })
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao atualizar pergunta de segurança')
    }
  }

  const verificarPergunta = async (username: string) => {
    try {
      const response = await api.post('/auth/verificar-pergunta', { username })
      return response.data
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw new Error('Erro ao verificar pergunta de segurança')
    }
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
      setUser(null)
      setUserRole(null)
      
      // Invalidar todo o cache do React Query para forçar recarregamento
      queryClient.clear()
      
      // Navegar para a tela de login sem recarregar a página
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      // Mesmo com erro, limpar o estado local
      setUser(null)
      setUserRole(null)
      queryClient.clear()
      navigate('/login', { replace: true })
    }
  }

  const setUserFromToken = (username: string, role: string) => {
    setUser(username)
    setUserRole(role as 'usuario' | 'admin')
    setLoading(false)
    // Limpar cache do React Query para forçar refresh
    queryClient.clear()
  }

  const value = {
    user,
    userRole,
    isAdmin,
    login,
    register,
    logout,
    obterPergunta,
    verificarResposta,
    redefinirSenha,
    atualizarPergunta,
    verificarPergunta,
    setUserFromToken,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 