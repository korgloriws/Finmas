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
        setUser(null)
      }
    } catch (error) {
   
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post('/auth/login', {
        username,
        senha: password
      })
      
      if (response.data.username) {
        setUser(response.data.username)
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
      // Limpeza agressiva do cache do navegador
      try {
        // Limpar localStorage
        localStorage.clear()
        
        // Limpar sessionStorage
        sessionStorage.clear()
        
        // Limpar cache do navegador se possível
        if ('caches' in window) {
          const cacheNames = await caches.keys()
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          )
        }
      } catch (cacheError) {
        console.warn('Erro ao limpar cache do navegador:', cacheError)
      }
      
      // Fazer logout no backend
      await api.post('/auth/logout')
      setUser(null)
      
      // Invalidar todo o cache do React Query para forçar recarregamento
      queryClient.clear()
      
      // Limpar todos os dados do React Query
      queryClient.removeQueries()
      queryClient.invalidateQueries()
      
      // Navegar para a tela de login sem recarregar a página
      navigate('/login', { replace: true })
      
      // Forçar reload da página para garantir limpeza completa
      setTimeout(() => {
        window.location.reload()
      }, 100)
      
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      // Mesmo com erro, limpar o estado local
      setUser(null)
      queryClient.clear()
      queryClient.removeQueries()
      queryClient.invalidateQueries()
      
      // Limpar storage local
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch (storageError) {
        console.warn('Erro ao limpar storage:', storageError)
      }
      
      navigate('/login', { replace: true })
      
      // Forçar reload da página
      setTimeout(() => {
        window.location.reload()
      }, 100)
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