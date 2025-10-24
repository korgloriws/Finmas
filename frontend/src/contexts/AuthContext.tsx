import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

interface AuthContextType {
  user: string | null
  login: (username: string, password: string) => Promise<void>
  register: (nome: string, username: string, password: string, pergunta_seguranca?: string, resposta_seguranca?: string) => Promise<void>
  logout: () => Promise<void>
  obterPergunta: (username: string) => Promise<string>
  verificarResposta: (username: string, resposta: string) => Promise<boolean>
  redefinirSenha: (username: string, novaSenha: string) => Promise<void>
  atualizarPergunta: (username: string, pergunta: string, resposta: string) => Promise<void>
  verificarPergunta: (username: string) => Promise<{tem_pergunta: boolean, pergunta?: string}>
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
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  
  useEffect(() => {
    checkCurrentUser()
  }, [])

  const checkCurrentUser = async () => {
    try {
      const response = await api.get('/auth/usuario-atual')
      if (response.data.username) {
        setUser(response.data.username)
      } else {
        // Se não há usuário, limpar todos os caches
        setUser(null)
        queryClient.clear()
        queryClient.invalidateQueries()
        queryClient.removeQueries()
      }
    } catch (error) {
      // Em caso de erro, garantir limpeza completa
      setUser(null)
      queryClient.clear()
      queryClient.invalidateQueries()
      queryClient.removeQueries()
    } finally {
      setLoading(false)
    }
  }

  const login = async (username: string, password: string) => {
    try {
    
      queryClient.clear()
      queryClient.invalidateQueries()
      queryClient.removeQueries()
      

      const response = await api.post('/auth/login', {
        username,
        senha: password
      })
      
      if (response.data.username) {
     
        queryClient.clear()
        

        setUser(response.data.username)
      } else {
        throw new Error('Erro no login')
      }
    } catch (error: any) {
    
      queryClient.clear()
      setUser(null)
      
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
      // 1. Fazer logout no backend
      await api.post('/auth/logout')
      
      // 2. Limpar estado do usuário
      setUser(null)
      
      // 3. Limpeza completa de todos os caches
      // Limpar todo o cache do React Query
      queryClient.clear()
      
      // Invalidar todas as queries específicas
      queryClient.invalidateQueries()
      
      // Remover todas as queries do cache
      queryClient.removeQueries()
      
      // Limpar cache do localStorage/sessionStorage se houver
      try {
        localStorage.removeItem('user')
        localStorage.removeItem('carteira')
        localStorage.removeItem('controle')
        localStorage.removeItem('marmitas')
        sessionStorage.clear()
      } catch (e) {
        // Falha silenciosa se não houver storage
      }
      
      // 4. Navegar para login
      navigate('/login', { replace: true })
      
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      
      // Mesmo com erro, fazer limpeza completa
      setUser(null)
      queryClient.clear()
      queryClient.invalidateQueries()
      queryClient.removeQueries()
      
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch (e) {
        // Falha silenciosa
      }
      
      navigate('/login', { replace: true })
    }
  }

  const value = {
    user,
    login,
    register,
    logout,
    obterPergunta,
    verificarResposta,
    redefinirSenha,
    atualizarPergunta,
    verificarPergunta,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 